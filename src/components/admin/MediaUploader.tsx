import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FolderUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { UploadProgressPanel } from '@/components/admin/UploadProgressPanel';
import { UploadEngine, type UploadEngineState } from '@/lib/uploadEngine';

interface MediaUploaderProps {
  albumId: string;
  onUploadComplete?: () => void;
  onTriggerFaceDetection?: () => void;
}

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
};

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const isMediaFile = (file: File) => {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
  return validTypes.includes(file.type) || /\.(jpg|jpeg|png|webp|heic|mp4|mov|avi)$/i.test(file.name);
};

export const MediaUploader = ({ albumId, onUploadComplete, onTriggerFaceDetection }: MediaUploaderProps) => {
  const [uploadState, setUploadState] = useState<UploadEngineState | null>(null);
  const engineRef = useRef<UploadEngine | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const startUpload = useCallback((files: File[]) => {
    const mediaFiles = files.filter(isMediaFile);
    if (mediaFiles.length === 0) {
      toast({ title: 'No valid files', description: 'No supported image or video files found.', variant: 'destructive' });
      return;
    }

    const engine = new UploadEngine(albumId, mediaFiles, (state) => {
      setUploadState({ ...state });
    });
    engineRef.current = engine;

    engine.start().then(() => {
      const finalState = engineRef.current;
      if (finalState) {
        onUploadComplete?.();
        onTriggerFaceDetection?.();
      }
    });
  }, [albumId, onUploadComplete, onTriggerFaceDetection, toast]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    startUpload(acceptedFiles);
  }, [startUpload]);

  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) startUpload(files);
    // Reset input so same folder can be selected again
    e.target.value = '';
  }, [startUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled: uploadState?.isUploading,
  });

  const isUploading = uploadState?.isUploading ?? false;

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        {isDragActive ? (
          <p className="text-lg font-medium text-primary">Drop files or folder here...</p>
        ) : (
          <>
            <p className="text-lg font-medium text-foreground mb-1">
              Drag & drop photos, videos, or a folder
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse • JPEG, PNG, WebP, MP4, MOV • Max 500MB per file
            </p>
          </>
        )}
      </div>

      {/* Folder picker button */}
      <div className="flex gap-2">
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore - webkitdirectory is not in TS types
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleFolderSelect}
        />
        <Button
          variant="outline"
          onClick={() => folderInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2"
        >
          <FolderUp size={16} />
          Upload Folder
        </Button>
      </div>

      {/* Upload progress panel */}
      {uploadState && uploadState.files.length > 0 && (
        <UploadProgressPanel
          state={uploadState}
          onCancel={() => engineRef.current?.cancel()}
          onRetryFailed={() => engineRef.current?.retryFailed()}
          onClear={() => setUploadState(null)}
        />
      )}
    </div>
  );
};
