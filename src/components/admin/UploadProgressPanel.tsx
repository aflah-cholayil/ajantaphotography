import { CheckCircle, AlertCircle, Loader2, RefreshCw, XCircle, Database, StopCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type UploadEngineState, formatBytes, formatSpeed, formatTimeRemaining } from '@/lib/uploadEngine';

interface UploadProgressPanelProps {
  state: UploadEngineState;
  onCancel: () => void;
  onRetryFailed: () => void;
  onClear: () => void;
}

export const UploadProgressPanel = ({ state, onCancel, onRetryFailed, onClear }: UploadProgressPanelProps) => {
  const { files, totalBytes, totalBytesUploaded, startTime, isUploading, activeConcurrency } = state;

  const overallProgress = totalBytes > 0 ? Math.round((totalBytesUploaded / totalBytes) * 100) : 0;
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  const speed = elapsedSeconds > 0 ? totalBytesUploaded / elapsedSeconds : 0;
  const remaining = speed > 0 ? (totalBytes - totalBytesUploaded) / speed : 0;

  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const uploadingCount = files.filter(f => f.status === 'uploading').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;
  const cancelledCount = files.filter(f => f.status === 'cancelled').length;
  const dbSavedCount = files.filter(f => f.dbSaved).length;

  const allDone = !isUploading && pendingCount === 0 && uploadingCount === 0;
  const showSummary = allDone && (successCount > 0 || errorCount > 0 || cancelledCount > 0);

  return (
    <div className="space-y-4 border border-border rounded-lg p-4 bg-card">
      {/* Upload Summary (shown when done) */}
      {showSummary ? (
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">Upload Summary</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {successCount > 0 && (
              <span className="flex items-center gap-2 text-green-500">
                <CheckCircle size={16} /> Completed: {successCount.toLocaleString()}
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-2 text-destructive">
                <XCircle size={16} /> Failed: {errorCount.toLocaleString()}
              </span>
            )}
            {cancelledCount > 0 && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <StopCircle size={16} /> Cancelled: {cancelledCount.toLocaleString()}
              </span>
            )}
            <span className="flex items-center gap-2 text-foreground">
              📁 Total: {files.length.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <Button variant="outline" size="sm" onClick={onRetryFailed} className="gap-1.5">
                <RefreshCw size={14} />
                Retry {errorCount} Failed
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClear}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Header stats */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Uploading {files.length.toLocaleString()} files ({formatBytes(totalBytes)})
              </p>
              {isUploading && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatSpeed(speed)} • {formatTimeRemaining(remaining)} remaining
                </p>
              )}
            </div>
            {isUploading && (
              <Button variant="destructive" size="sm" onClick={onCancel} className="gap-1.5">
                <XCircle size={14} />
                Cancel
              </Button>
            )}
          </div>

          {/* Overall progress */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{formatBytes(totalBytesUploaded)} / {formatBytes(totalBytes)}</span>
              <span>{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>

          {/* Counts summary */}
          <div className="flex gap-4 text-xs flex-wrap">
            {successCount > 0 && (
              <span className="flex items-center gap-1 text-green-500">
                <CheckCircle size={12} /> {successCount.toLocaleString()} done
              </span>
            )}
            {dbSavedCount > 0 && (
              <span className="flex items-center gap-1 text-emerald-500">
                <Database size={12} /> {dbSavedCount.toLocaleString()} saved
              </span>
            )}
            {uploadingCount > 0 && (
              <span className="flex items-center gap-1 text-primary">
                <Loader2 size={12} className="animate-spin" /> {uploadingCount} uploading (×{activeConcurrency} slots)
              </span>
            )}
            {pendingCount > 0 && (
              <span className="text-muted-foreground">{pendingCount.toLocaleString()} queued</span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertCircle size={12} /> {errorCount} failed
              </span>
            )}
            {cancelledCount > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <StopCircle size={12} /> {cancelledCount} cancelled
              </span>
            )}
          </div>

          {/* File list */}
          <ScrollArea className="max-h-60">
            <div className="space-y-1">
              {files.map((file) => (
                <div key={file.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/30 text-sm">
                  <div className="flex-shrink-0 w-5">
                    {file.status === 'success' && file.dbSaved && <CheckCircle size={14} className="text-green-500" />}
                    {file.status === 'success' && !file.dbSaved && <Database size={14} className="text-amber-500" />}
                    {file.status === 'uploading' && <Loader2 size={14} className="animate-spin text-primary" />}
                    {file.status === 'error' && <AlertCircle size={14} className="text-destructive" />}
                    {file.status === 'cancelled' && <StopCircle size={14} className="text-muted-foreground" />}
                    {file.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30" />}
                  </div>

                  <span className="flex-1 truncate text-foreground">{file.file.name}</span>

                  {file.retryCount > 0 && file.status !== 'success' && (
                    <span className="flex-shrink-0 text-xs text-amber-500">
                      retry {file.retryCount}/{3}
                    </span>
                  )}

                  <span className="flex-shrink-0 text-xs text-muted-foreground w-16 text-right">
                    {file.status === 'uploading'
                      ? `${file.progress}%`
                      : file.status === 'error'
                        ? 'Failed'
                        : file.status === 'cancelled'
                          ? 'Cancelled'
                          : file.status === 'success' && file.dbSaved
                            ? 'Saved'
                            : formatBytes(file.file.size)
                    }
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
};
