import { supabase } from '@/integrations/supabase/client';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CONCURRENT_FILES = 6;
const MAX_CONCURRENT_PARTS = 3;
const MAX_RETRIES = 3;
const SMALL_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB - use simple upload

export type FileUploadStatus = 'pending' | 'uploading' | 'success' | 'error';

export interface FileUploadState {
  id: string;
  file: File;
  status: FileUploadStatus;
  progress: number; // 0-100
  bytesUploaded: number;
  error?: string;
  s3Key?: string;
  uploadId?: string; // multipart uploadId
}

export interface UploadEngineState {
  files: FileUploadState[];
  totalBytes: number;
  totalBytesUploaded: number;
  startTime: number;
  isUploading: boolean;
  isCancelled: boolean;
}

export type UploadProgressCallback = (state: UploadEngineState) => void;

export class UploadEngine {
  private state: UploadEngineState;
  private onProgress: UploadProgressCallback;
  private albumId: string;
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(albumId: string, files: File[], onProgress: UploadProgressCallback) {
    this.albumId = albumId;
    this.onProgress = onProgress;

    const fileStates: FileUploadState[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending',
      progress: 0,
      bytesUploaded: 0,
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
    // Recalculate total uploaded
    this.state.totalBytesUploaded = this.state.files.reduce((sum, f) => sum + f.bytesUploaded, 0);
    this.onProgress({ ...this.state, files: [...this.state.files] });
  }

  private updateFile(id: string, updates: Partial<FileUploadState>) {
    const idx = this.state.files.findIndex(f => f.id === id);
    if (idx !== -1) {
      this.state.files[idx] = { ...this.state.files[idx], ...updates };
    }
  }

  async start() {
    this.state.isUploading = true;
    this.state.startTime = Date.now();
    this.notify();

    const pending = [...this.state.files];
    const executing: Promise<void>[] = [];

    const enqueue = async (): Promise<void> => {
      if (this.state.isCancelled) return;

      const next = pending.shift();
      if (!next) return;

      const p = this.uploadFile(next).then(() => {
        executing.splice(executing.indexOf(p), 1);
        return enqueue();
      });
      executing.push(p);

      if (executing.length >= MAX_CONCURRENT_FILES) {
        await Promise.race(executing);
      }
      return enqueue();
    };

    // Start initial batch
    const starters = [];
    for (let i = 0; i < Math.min(MAX_CONCURRENT_FILES, pending.length); i++) {
      starters.push(enqueue());
    }
    await Promise.all(starters);
    await Promise.all(executing);

    this.state.isUploading = false;
    this.notify();
  }

  cancel() {
    this.state.isCancelled = true;
    this.abortControllers.forEach(ctrl => ctrl.abort());
    this.abortControllers.clear();

    // Abort all in-progress multipart uploads
    for (const file of this.state.files) {
      if (file.status === 'uploading' && file.uploadId && file.s3Key) {
        supabase.functions.invoke('s3-multipart-upload', {
          body: { action: 'abort', s3Key: file.s3Key, uploadId: file.uploadId },
        }).catch(() => {});
        this.updateFile(file.id, { status: 'error', error: 'Cancelled' });
      }
    }
    this.state.isUploading = false;
    this.notify();
  }

  async retryFailed() {
    const failed = this.state.files.filter(f => f.status === 'error');
    if (failed.length === 0) return;

    for (const f of failed) {
      this.updateFile(f.id, { status: 'pending', progress: 0, bytesUploaded: 0, error: undefined });
    }
    this.state.isCancelled = false;
    this.notify();

    this.state.isUploading = true;
    this.state.startTime = Date.now();
    this.notify();

    const pending = [...failed];
    const executing: Promise<void>[] = [];

    const enqueue = async (): Promise<void> => {
      if (this.state.isCancelled) return;
      const next = pending.shift();
      if (!next) return;
      const fileState = this.state.files.find(f => f.id === next.id)!;
      const p = this.uploadFile(fileState).then(() => {
        executing.splice(executing.indexOf(p), 1);
        return enqueue();
      });
      executing.push(p);
      if (executing.length >= MAX_CONCURRENT_FILES) await Promise.race(executing);
      return enqueue();
    };

    const starters = [];
    for (let i = 0; i < Math.min(MAX_CONCURRENT_FILES, pending.length); i++) {
      starters.push(enqueue());
    }
    await Promise.all(starters);
    await Promise.all(executing);

    this.state.isUploading = false;
    this.notify();
  }

  private async uploadFile(fileState: FileUploadState) {
    if (this.state.isCancelled) return;

    this.updateFile(fileState.id, { status: 'uploading', progress: 0 });
    this.notify();

    try {
      if (fileState.file.size <= SMALL_FILE_THRESHOLD) {
        await this.uploadSmallFile(fileState);
      } else {
        await this.uploadMultipartFile(fileState);
      }

      // Save media record to DB
      await this.saveMediaRecord(fileState);

      this.updateFile(fileState.id, { status: 'success', progress: 100, bytesUploaded: fileState.file.size });
      this.notify();
    } catch (error) {
      if (this.state.isCancelled) return;
      const msg = error instanceof Error ? error.message : 'Upload failed';
      this.updateFile(fileState.id, { status: 'error', error: msg });
      this.notify();
    }
  }

  private async uploadSmallFile(fileState: FileUploadState) {
    // Use existing s3-upload for small files
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
    // Initiate multipart upload
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

    // Upload parts with concurrency
    const partQueue = Array.from({ length: totalParts }, (_, i) => i + 1);
    const executing: Promise<void>[] = [];

    const uploadPart = async (partNumber: number, retries = 0): Promise<void> => {
      if (this.state.isCancelled) return;

      try {
        // Get presigned URL for this part
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
              const etag = xhr.getResponseHeader('ETag') || '';
              resolve(etag);
            } else {
              reject(new Error(`Part ${partNumber} failed: ${xhr.status}`));
            }
          });
          xhr.addEventListener('error', () => reject(new Error(`Part ${partNumber} network error`)));

          xhr.open('PUT', partData.url);
          xhr.send(chunk);
        });

        completedParts.push({ PartNumber: partNumber, ETag: etag });
      } catch (err) {
        if (retries < MAX_RETRIES && !this.state.isCancelled) {
          console.log(`Retrying part ${partNumber}, attempt ${retries + 1}`);
          await new Promise(r => setTimeout(r, 1000 * (retries + 1)));
          return uploadPart(partNumber, retries + 1);
        }
        throw err;
      }
    };

    const enqueuePart = async (): Promise<void> => {
      if (this.state.isCancelled) return;
      const next = partQueue.shift();
      if (next === undefined) return;

      const p = uploadPart(next).then(() => {
        executing.splice(executing.indexOf(p), 1);
        return enqueuePart();
      });
      executing.push(p);

      if (executing.length >= MAX_CONCURRENT_PARTS) await Promise.race(executing);
      return enqueuePart();
    };

    try {
      const starters = [];
      for (let i = 0; i < Math.min(MAX_CONCURRENT_PARTS, partQueue.length); i++) {
        starters.push(enqueuePart());
      }
      await Promise.all(starters);
      await Promise.all(executing);

      if (this.state.isCancelled) return;

      // Complete multipart upload
      const { error: completeError } = await supabase.functions.invoke('s3-multipart-upload', {
        body: { action: 'complete', s3Key, uploadId, parts: completedParts },
      });

      if (completeError) throw new Error('Failed to complete multipart upload');
    } catch (err) {
      // Abort on failure
      if (!this.state.isCancelled) {
        await supabase.functions.invoke('s3-multipart-upload', {
          body: { action: 'abort', s3Key, uploadId },
        }).catch(() => {});
      }
      throw err;
    }
  }

  private async saveMediaRecord(fileState: FileUploadState) {
    const file = fileState.file;
    const s3Key = fileState.s3Key!;

    // Get dimensions
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
    const { error } = await supabase.from('media').insert({
      album_id: this.albumId,
      s3_key: s3Key,
      file_name: file.name,
      mime_type: file.type,
      size: file.size,
      type: mediaType,
      width,
      height,
      duration,
    });

    if (error) throw error;
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
