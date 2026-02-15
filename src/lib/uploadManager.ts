import { UploadEngine, validateBatch, formatBytes, type UploadEngineState, type FileUploadState } from './uploadEngine';

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

export interface AlbumUploadState {
  albumId: string;
  state: UploadEngineState;
}

export interface UploadManagerSnapshot {
  albums: AlbumUploadState[];
  hasActiveUploads: boolean;
  totalFiles: number;
  totalSuccess: number;
  totalErrors: number;
  totalProgress: number; // 0-100
}

type Listener = () => void;

class UploadManager {
  private engines = new Map<string, UploadEngine>();
  private states = new Map<string, UploadEngineState>();
  private listeners = new Set<Listener>();
  private beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
  private autoClearTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (this.hasActiveUploads()) {
        e.preventDefault();
        e.returnValue = 'Uploads are still in progress. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  private hasActiveUploads(): boolean {
    for (const state of this.states.values()) {
      if (state.isUploading) return true;
    }
    return false;
  }

  getSnapshot(): UploadManagerSnapshot {
    const albums: AlbumUploadState[] = [];
    let totalFiles = 0;
    let totalSuccess = 0;
    let totalErrors = 0;
    let totalBytes = 0;
    let totalBytesUploaded = 0;

    for (const [albumId, state] of this.states.entries()) {
      albums.push({ albumId, state });
      totalFiles += state.files.length;
      totalSuccess += state.files.filter(f => f.status === 'success').length;
      totalErrors += state.files.filter(f => f.status === 'error').length;
      totalBytes += state.totalBytes;
      totalBytesUploaded += state.totalBytesUploaded;
    }

    return {
      albums,
      hasActiveUploads: this.hasActiveUploads(),
      totalFiles,
      totalSuccess,
      totalErrors,
      totalProgress: totalBytes > 0 ? Math.round((totalBytesUploaded / totalBytes) * 100) : 0,
    };
  }

  getAlbumState(albumId: string): UploadEngineState | null {
    return this.states.get(albumId) ?? null;
  }

  startUpload(
    albumId: string,
    files: File[],
    callbacks?: {
      onFileUploaded?: () => void;
      onUploadComplete?: () => void;
      onTriggerFaceDetection?: () => void;
    }
  ): { started: boolean; message?: string } {
    const mediaFiles = files.filter(f => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
      return validTypes.includes(f.type) || /\.(jpg|jpeg|png|webp|heic|mp4|mov|avi)$/i.test(f.name);
    });

    if (mediaFiles.length === 0) {
      return { started: false, message: 'No valid media files found.' };
    }

    const validation = validateBatch(mediaFiles);
    if (validation.exceedsBatchLimit) {
      return { started: false, message: `Total size ${formatBytes(validation.totalSize)} exceeds the 50GB batch limit.` };
    }

    const validFiles = mediaFiles.filter(f => f.size <= MAX_FILE_SIZE);
    const oversizedCount = mediaFiles.length - validFiles.length;
    if (validFiles.length === 0) {
      return { started: false, message: 'All files exceed the 2GB limit.' };
    }

    // Clear any existing auto-clear timer for this album
    const existingTimer = this.autoClearTimers.get(albumId);
    if (existingTimer) clearTimeout(existingTimer);

    const engine = new UploadEngine(
      albumId,
      validFiles,
      (state) => {
        this.states.set(albumId, { ...state, files: [...state.files] });
        this.notify();

        // Auto-clear completed uploads after 5s
        const pending = state.files.filter(f => f.status === 'pending').length;
        const uploading = state.files.filter(f => f.status === 'uploading').length;
        const errors = state.files.filter(f => f.status === 'error').length;
        const cancelled = state.files.filter(f => f.status === 'cancelled').length;
        const allDone = !state.isUploading && pending === 0 && uploading === 0;

        if (allDone && errors === 0 && cancelled === 0 && state.files.length > 0) {
          const timer = setTimeout(() => {
            this.clearAlbum(albumId);
          }, 5000);
          this.autoClearTimers.set(albumId, timer);
        }
      },
      callbacks?.onFileUploaded ? () => callbacks.onFileUploaded!() : undefined
    );

    this.engines.set(albumId, engine);

    engine.start().then(() => {
      callbacks?.onUploadComplete?.();
      callbacks?.onTriggerFaceDetection?.();
    });

    return {
      started: true,
      message: oversizedCount > 0
        ? `${oversizedCount} files exceed 2GB and were skipped. Uploading ${validFiles.length} files.`
        : undefined,
    };
  }

  cancel(albumId: string) {
    this.engines.get(albumId)?.cancel();
  }

  cancelAll() {
    this.engines.forEach(engine => engine.cancel());
  }

  retryFailed(albumId: string) {
    this.engines.get(albumId)?.retryFailed();
  }

  clearAlbum(albumId: string) {
    const timer = this.autoClearTimers.get(albumId);
    if (timer) clearTimeout(timer);
    this.autoClearTimers.delete(albumId);
    this.engines.delete(albumId);
    this.states.delete(albumId);
    this.notify();
  }

  clearAll() {
    this.autoClearTimers.forEach(timer => clearTimeout(timer));
    this.autoClearTimers.clear();
    this.engines.clear();
    this.states.clear();
    this.notify();
  }
}

// Global singleton
export const uploadManager = new UploadManager();
