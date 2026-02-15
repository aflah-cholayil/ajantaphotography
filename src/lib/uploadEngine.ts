import { supabase } from '@/integrations/supabase/client';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CONCURRENT_FILES = 8;
const MAX_CONCURRENT_PARTS = 5;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000]; // Exponential backoff
const SMALL_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
const SESSION_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_BATCH_SIZE = 50 * 1024 * 1024 * 1024; // 50GB

export type FileUploadStatus = 'pending' | 'uploading' | 'success' | 'error' | 'cancelled';

export interface FileUploadState {
  id: string;
  file: File;
  status: FileUploadStatus;
  progress: number;
  bytesUploaded: number;
  error?: string;
  s3Key?: string;
  uploadId?: string;
  retryCount: number;
  dbSaved: boolean;
}

export interface UploadEngineState {
  files: FileUploadState[];
  totalBytes: number;
  totalBytesUploaded: number;
  startTime: number;
  isUploading: boolean;
  isCancelled: boolean;
}

export interface BatchValidation {
  valid: boolean;
  oversizedFiles: string[];
  totalSize: number;
  fileCount: number;
  exceedsBatchLimit: boolean;
}

export type UploadProgressCallback = (state: UploadEngineState) => void;
export type FileUploadedCallback = (fileState: FileUploadState) => void;

export function validateBatch(files: File[]): BatchValidation {
  const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE).map(f => f.name);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  return {
    valid: oversizedFiles.length === 0 && totalSize <= MAX_BATCH_SIZE,
    oversizedFiles,
    totalSize,
    fileCount: files.length,
    exceedsBatchLimit: totalSize > MAX_BATCH_SIZE,
  };
}

export class UploadEngine {
  private state: UploadEngineState;
  private onProgress: UploadProgressCallback;
  private onFileUploaded?: FileUploadedCallback;
  private albumId: string;
  private abortControllers: Map<string, AbortController> = new Map();
  private lastSessionRefresh: number = 0;

  constructor(
    albumId: string,
    files: File[],
    onProgress: UploadProgressCallback,
    onFileUploaded?: FileUploadedCallback
  ) {
    this.albumId = albumId;
    this.onProgress = onProgress;
    this.onFileUploaded = onFileUploaded;

    const fileStates: FileUploadState[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending' as const,
      progress: 0,
      bytesUploaded: 0,
      retryCount: 0,
      dbSaved: false,
    }));

    this.state = {
      files: fileStates,
      totalBytes: files.reduce((sum, f) => sum + f.size, 0),
      totalBytesUploaded: 0,
      startTime: Date.now(),
      isUploading: false,
      isCancelled: false,
    };
  }

  private notify() {
    this.state.totalBytesUploaded = this.state.files.reduce((sum, f) => sum + f.bytesUploaded, 0);
    this.onProgress({ ...this.state, files: [...this.state.files] });
  }

  private updateFile(id: string, updates: Partial<FileUploadState>) {
    const idx = this.state.files.findIndex(f => f.id === id);
    if (idx !== -1) {
      this.state.files[idx] = { ...this.state.files[idx], ...updates };
    }
  }

  private async refreshSessionIfNeeded() {
    const now = Date.now();
    if (now - this.lastSessionRefresh > SESSION_REFRESH_INTERVAL) {
      try {
        await supabase.auth.refreshSession();
        this.lastSessionRefresh = now;
        console.log('[UploadEngine] Session refreshed');
      } catch (e) {
        console.warn('[UploadEngine] Session refresh failed:', e);
      }
    }
  }

  async start() {
    // Refresh session before starting
    await supabase.auth.refreshSession();
    this.lastSessionRefresh = Date.now();

    this.state.isUploading = true;
    this.state.startTime = Date.now();
    this.notify();

    // Semaphore-based queue: simple pool with Promise.race
    const pending = this.state.files.filter(f => f.status === 'pending');
    let nextIndex = 0;
    const active: Set<Promise<void>> = new Set();

    const runNext = async (): Promise<void> => {
      while (nextIndex < pending.length && !this.state.isCancelled) {
        if (active.size >= MAX_CONCURRENT_FILES) {
          await Promise.race(active);
        }
        if (this.state.isCancelled) break;

        const fileState = pending[nextIndex++];
        const p = this.uploadFileWithRetry(fileState).finally(() => active.delete(p));
        active.add(p);
      }
      // Wait for all remaining
      while (active.size > 0) {
        await Promise.race(active);
      }
    };

    await runNext();

    this.state.isUploading = false;
    this.notify();
  }

  cancel() {
    this.state.isCancelled = true;
    this.abortControllers.forEach(ctrl => ctrl.abort());
    this.abortControllers.clear();

    for (const file of this.state.files) {
      if (file.status === 'uploading') {
        // Abort multipart if in progress
        if (file.uploadId && file.s3Key) {
          supabase.functions.invoke('s3-multipart-upload', {
            body: { action: 'abort', s3Key: file.s3Key, uploadId: file.uploadId },
          }).catch(() => {});
        }
        this.updateFile(file.id, { status: 'cancelled', error: 'Cancelled' });
      } else if (file.status === 'pending') {
        this.updateFile(file.id, { status: 'cancelled' });
      }
    }
    this.state.isUploading = false;
    this.notify();
  }

  async retryFailed() {
    const failed = this.state.files.filter(f => f.status === 'error');
    if (failed.length === 0) return;

    for (const f of failed) {
      this.updateFile(f.id, { status: 'pending', progress: 0, bytesUploaded: 0, error: undefined, retryCount: 0, dbSaved: false });
    }
    this.state.isCancelled = false;
    this.state.isUploading = true;
    this.state.startTime = Date.now();
    this.notify();

    await supabase.auth.refreshSession();
    this.lastSessionRefresh = Date.now();

    let nextIndex = 0;
    const active: Set<Promise<void>> = new Set();

    const runNext = async (): Promise<void> => {
      while (nextIndex < failed.length && !this.state.isCancelled) {
        if (active.size >= MAX_CONCURRENT_FILES) {
          await Promise.race(active);
        }
        if (this.state.isCancelled) break;

        const fileState = this.state.files.find(f => f.id === failed[nextIndex++]?.id);
        if (!fileState) continue;
        const p = this.uploadFileWithRetry(fileState).finally(() => active.delete(p));
        active.add(p);
      }
      while (active.size > 0) {
        await Promise.race(active);
      }
    };

    await runNext();

    this.state.isUploading = false;
    this.notify();
  }

  private async uploadFileWithRetry(fileState: FileUploadState) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (this.state.isCancelled) return;

      try {
        await this.refreshSessionIfNeeded();
        await this.uploadFile(fileState);
        return; // Success
      } catch (error) {
        if (this.state.isCancelled) return;

        const msg = error instanceof Error ? error.message : 'Upload failed';

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt] || 5000;
          this.updateFile(fileState.id, {
            status: 'uploading',
            error: `Retrying (${attempt + 1}/${MAX_RETRIES})...`,
            retryCount: attempt + 1,
            progress: 0,
            bytesUploaded: 0,
          });
          this.notify();
          await new Promise(r => setTimeout(r, delay));
        } else {
          this.updateFile(fileState.id, { status: 'error', error: msg, retryCount: attempt });
          this.notify();
        }
      }
    }
  }

  private async uploadFile(fileState: FileUploadState) {
    if (this.state.isCancelled) return;

    this.updateFile(fileState.id, { status: 'uploading', progress: 0 });
    this.notify();

    if (fileState.file.size <= SMALL_FILE_THRESHOLD) {
      await this.uploadSmallFile(fileState);
    } else {
      await this.uploadMultipartFile(fileState);
    }

    // Save media record server-side with retry
    await this.saveMediaRecordWithRetry(fileState);

    this.updateFile(fileState.id, { status: 'success', progress: 100, bytesUploaded: fileState.file.size, dbSaved: true });
    this.notify();

    // Notify per-file callback
    this.onFileUploaded?.(this.state.files.find(f => f.id === fileState.id)!);
  }

  private async uploadSmallFile(fileState: FileUploadState) {
    const { data: urlData, error } = await supabase.functions.invoke('s3-upload', {
      body: {
        albumId: this.albumId,
        fileName: fileState.file.name,
        fileType: fileState.file.type,
        fileSize: fileState.file.size,
      },
    });

    if (error || urlData?.error) throw new Error(urlData?.error || error?.message || 'Failed to get upload URL');

    this.updateFile(fileState.id, { s3Key: urlData.s3Key });

    const controller = new AbortController();
    this.abortControllers.set(fileState.id, controller);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          this.updateFile(fileState.id, { progress, bytesUploaded: e.loaded });
          this.notify();
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      });
      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.addEventListener('abort', () => reject(new Error('Cancelled')));

      controller.signal.addEventListener('abort', () => xhr.abort());

      xhr.open('PUT', urlData.presignedUrl);
      xhr.setRequestHeader('Content-Type', fileState.file.type);
      xhr.send(fileState.file);
    });

    this.abortControllers.delete(fileState.id);
  }

  private async uploadMultipartFile(fileState: FileUploadState) {
    const { data: initData, error: initError } = await supabase.functions.invoke('s3-multipart-upload', {
      body: {
        action: 'initiate',
        albumId: this.albumId,
        fileName: fileState.file.name,
        fileType: fileState.file.type,
        fileSize: fileState.file.size,
      },
    });

    if (initError || !initData?.uploadId) throw new Error(initData?.error || 'Failed to initiate multipart upload');

    const { uploadId, s3Key } = initData;
    this.updateFile(fileState.id, { uploadId, s3Key });

    const totalParts = Math.ceil(fileState.file.size / CHUNK_SIZE);
    const completedParts: { PartNumber: number; ETag: string }[] = [];
    const partProgress: number[] = new Array(totalParts).fill(0);

    // Semaphore-based part upload pool
    const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
    let partIndex = 0;
    const activeParts: Set<Promise<void>> = new Set();

    const uploadPart = async (partNumber: number): Promise<void> => {
      if (this.state.isCancelled) return;

      let lastError: Error | null = null;
      for (let retry = 0; retry <= MAX_RETRIES; retry++) {
        if (this.state.isCancelled) return;
        try {
          const { data: partData, error: partError } = await supabase.functions.invoke('s3-multipart-upload', {
            body: { action: 'get_part_url', s3Key, uploadId, partNumber },
          });

          if (partError || !partData?.url) throw new Error('Failed to get part URL');

          const start = (partNumber - 1) * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, fileState.file.size);
          const chunk = fileState.file.slice(start, end);

          const etag = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                partProgress[partNumber - 1] = e.loaded;
                const totalUploaded = partProgress.reduce((s, v) => s + v, 0);
                const progress = Math.round((totalUploaded / fileState.file.size) * 100);
                this.updateFile(fileState.id, { progress, bytesUploaded: totalUploaded });
                this.notify();
              }
            });

            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.getResponseHeader('ETag') || '');
              } else {
                reject(new Error(`Part ${partNumber} failed: ${xhr.status}`));
              }
            });
            xhr.addEventListener('error', () => reject(new Error(`Part ${partNumber} network error`)));

            xhr.open('PUT', partData.url);
            xhr.send(chunk);
          });

          completedParts.push({ PartNumber: partNumber, ETag: etag });
          return; // success
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (retry < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAYS[retry] || 5000));
          }
        }
      }
      throw lastError || new Error(`Part ${partNumber} failed after retries`);
    };

    try {
      while (partIndex < partNumbers.length && !this.state.isCancelled) {
        if (activeParts.size >= MAX_CONCURRENT_PARTS) {
          await Promise.race(activeParts);
        }
        if (this.state.isCancelled) break;

        const pn = partNumbers[partIndex++];
        const p = uploadPart(pn).finally(() => activeParts.delete(p));
        activeParts.add(p);
      }

      // Wait for remaining
      if (activeParts.size > 0) {
        await Promise.all(activeParts);
      }

      if (this.state.isCancelled) return;

      const { error: completeError } = await supabase.functions.invoke('s3-multipart-upload', {
        body: { action: 'complete', s3Key, uploadId, parts: completedParts },
      });

      if (completeError) throw new Error('Failed to complete multipart upload');
    } catch (err) {
      if (!this.state.isCancelled) {
        await supabase.functions.invoke('s3-multipart-upload', {
          body: { action: 'abort', s3Key, uploadId },
        }).catch(() => {});
      }
      throw err;
    }
  }

  private async saveMediaRecordWithRetry(fileState: FileUploadState) {
    const file = fileState.file;
    const s3Key = this.state.files.find(f => f.id === fileState.id)?.s3Key;
    if (!s3Key) throw new Error('No S3 key available');

    // Get dimensions client-side
    let width: number | undefined;
    let height: number | undefined;
    let duration: number | undefined;

    if (file.type.startsWith('image/')) {
      try {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise<void>((resolve) => {
          img.onload = () => { width = img.naturalWidth; height = img.naturalHeight; URL.revokeObjectURL(img.src); resolve(); };
          img.onerror = () => { URL.revokeObjectURL(img.src); resolve(); };
        });
      } catch {}
    } else if (file.type.startsWith('video/')) {
      try {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => { width = video.videoWidth; height = video.videoHeight; duration = Math.round(video.duration); URL.revokeObjectURL(video.src); resolve(); };
          video.onerror = () => { URL.revokeObjectURL(video.src); resolve(); };
        });
      } catch {}
    }

    const mediaType = file.type.startsWith('video/') ? 'video' : 'photo';

    // Retry DB save up to 3 times via server-side edge function
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('save-media-record', {
          body: {
            albumId: this.albumId,
            s3Key,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
            type: mediaType,
            width,
            height,
            duration,
          },
        });

        if (error || data?.error) {
          throw new Error(data?.error || error?.message || 'Failed to save media record');
        }

        this.updateFile(fileState.id, { dbSaved: true });
        return;
      } catch (err) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt] || 1000));
        } else {
          throw err;
        }
      }
    }
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
}

export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}
