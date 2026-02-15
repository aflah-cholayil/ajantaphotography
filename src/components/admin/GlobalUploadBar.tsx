import { useState } from 'react';
import { CheckCircle, AlertCircle, Loader2, XCircle, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useUploadManager } from '@/contexts/UploadManagerContext';
import { formatBytes, formatSpeed, formatTimeRemaining } from '@/lib/uploadEngine';

export const GlobalUploadBar = () => {
  const { manager, snapshot } = useUploadManager();
  const [expanded, setExpanded] = useState(false);

  if (snapshot.albums.length === 0) return null;

  const { hasActiveUploads, totalFiles, totalSuccess, totalErrors, totalProgress } = snapshot;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-lg shadow-lg overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasActiveUploads ? (
            <Loader2 size={16} className="animate-spin text-primary flex-shrink-0" />
          ) : totalErrors > 0 ? (
            <AlertCircle size={16} className="text-destructive flex-shrink-0" />
          ) : (
            <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-foreground truncate">
            {hasActiveUploads
              ? `Uploading... ${totalProgress}%`
              : totalErrors > 0
                ? `${totalSuccess} done, ${totalErrors} failed`
                : `${totalSuccess} files uploaded`
            }
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </button>

      {/* Progress bar */}
      {hasActiveUploads && (
        <div className="px-4 pb-2">
          <Progress value={totalProgress} className="h-1.5" />
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 max-h-60 overflow-y-auto">
          {snapshot.albums.map(({ albumId, state }) => {
            const success = state.files.filter(f => f.status === 'success').length;
            const errors = state.files.filter(f => f.status === 'error').length;
            const uploading = state.files.filter(f => f.status === 'uploading').length;
            const pending = state.files.filter(f => f.status === 'pending').length;
            const albumProgress = state.totalBytes > 0
              ? Math.round((state.totalBytesUploaded / state.totalBytes) * 100)
              : 0;

            const elapsed = (Date.now() - state.startTime) / 1000;
            const speed = elapsed > 0 ? state.totalBytesUploaded / elapsed : 0;
            const remaining = speed > 0 ? (state.totalBytes - state.totalBytesUploaded) / speed : 0;

            return (
              <div key={albumId} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate flex-1">
                    {state.files.length} files • {formatBytes(state.totalBytes)}
                  </span>
                  <span className="text-muted-foreground ml-2">{albumProgress}%</span>
                </div>

                <Progress value={albumProgress} className="h-1" />

                <div className="flex items-center gap-2 text-xs flex-wrap">
                  {uploading > 0 && (
                    <span className="text-primary">{uploading} uploading</span>
                  )}
                  {pending > 0 && (
                    <span className="text-muted-foreground">{pending} queued</span>
                  )}
                  {success > 0 && (
                    <span className="text-green-500">{success} done</span>
                  )}
                  {errors > 0 && (
                    <span className="text-destructive">{errors} failed</span>
                  )}
                </div>

                {state.isUploading && speed > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatSpeed(speed)} • {formatTimeRemaining(remaining)} left
                  </p>
                )}

                <div className="flex gap-1.5">
                  {state.isUploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-destructive hover:text-destructive"
                      onClick={() => manager.cancel(albumId)}
                    >
                      <XCircle size={12} className="mr-1" />
                      Cancel
                    </Button>
                  )}
                  {errors > 0 && !state.isUploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => manager.retryFailed(albumId)}
                    >
                      Retry {errors}
                    </Button>
                  )}
                  {!state.isUploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={() => manager.clearAlbum(albumId)}
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
