import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle, AlertCircle, Image, Video, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  preview?: string;
}

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

export const MediaUploader = ({ albumId, onUploadComplete, onTriggerFaceDetection }: MediaUploaderProps) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = async (uploadFile: UploadingFile) => {
    const { file, id } = uploadFile;

    try {
      // Update status to uploading
      setUploadingFiles(prev => 
        prev.map(f => f.id === id ? { ...f, status: 'uploading' as const } : f)
      );

      // Get presigned URL from edge function
      const { data: urlData, error: urlError } = await supabase.functions.invoke('s3-upload', {
        body: {
          albumId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        },
      });

      if (urlError || urlData?.error) {
        throw new Error(urlData?.error || urlError?.message || 'Failed to get upload URL');
      }

      // Upload to S3 with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadingFiles(prev => 
              prev.map(f => f.id === id ? { ...f, progress } : f)
            );
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

        xhr.open('PUT', urlData.presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // Get image/video dimensions
      let width: number | undefined;
      let height: number | undefined;
      let duration: number | undefined;

      if (file.type.startsWith('image/')) {
        const img = new window.Image();
        img.src = URL.createObjectURL(file);
        await new Promise<void>((resolve) => {
          img.onload = () => {
            width = img.naturalWidth;
            height = img.naturalHeight;
            URL.revokeObjectURL(img.src);
            resolve();
          };
        });
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            width = video.videoWidth;
            height = video.videoHeight;
            duration = Math.round(video.duration);
            URL.revokeObjectURL(video.src);
            resolve();
          };
        });
      }

      // Save media record to database
      const mediaType = file.type.startsWith('video/') ? 'video' : 'photo';
      const { error: dbError } = await supabase.from('media').insert({
        album_id: albumId,
        s3_key: urlData.s3Key,
        file_name: file.name,
        mime_type: file.type,
        size: file.size,
        type: mediaType,
        width,
        height,
        duration,
      });

      if (dbError) {
        throw dbError;
      }

      // Mark as success
      setUploadingFiles(prev => 
        prev.map(f => f.id === id ? { ...f, status: 'success' as const, progress: 100 } : f)
      );

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadingFiles(prev => 
        prev.map(f => f.id === id ? { ...f, status: 'error' as const, error: errorMessage } : f)
      );
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Create upload entries
    const newFiles: UploadingFile[] = acceptedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending' as const,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    setUploadingFiles(prev => [...prev, ...newFiles]);
    setIsUploading(true);

    // Upload files concurrently (max 3 at a time)
    const uploadPromises: Promise<void>[] = [];
    const concurrencyLimit = 3;

    for (let i = 0; i < newFiles.length; i += concurrencyLimit) {
      const batch = newFiles.slice(i, i + concurrencyLimit);
      await Promise.all(batch.map(f => uploadFile(f)));
    }

    setIsUploading(false);
    
    // Count successful uploads
    setUploadingFiles(prev => {
      const successCount = prev.filter(f => f.status === 'success').length;
      
      if (successCount > 0) {
        toast({
          title: 'Upload complete',
          description: `${successCount} file(s) uploaded successfully`,
        });
        
        // Trigger face detection for new photos
        if (onTriggerFaceDetection) {
          onTriggerFaceDetection();
        }
      }
      
      return prev;
    });

    onUploadComplete?.();
  }, [albumId, onUploadComplete, onTriggerFaceDetection, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled: isUploading,
  });

  const removeFile = (id: string) => {
    setUploadingFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const clearCompleted = () => {
    setUploadingFiles(prev => prev.filter(f => f.status !== 'success'));
  };

  const completedCount = uploadingFiles.filter(f => f.status === 'success').length;
  const errorCount = uploadingFiles.filter(f => f.status === 'error').length;

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
          <p className="text-lg font-medium text-primary">Drop files here...</p>
        ) : (
          <>
            <p className="text-lg font-medium text-foreground mb-1">
              Drag & drop photos and videos
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse • JPEG, PNG, WebP, MP4, MOV • Max 500MB per file
            </p>
          </>
        )}
      </div>

      {/* Upload status summary */}
      {uploadingFiles.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              {uploadingFiles.length} file(s)
            </span>
            {completedCount > 0 && (
              <span className="text-green-500 flex items-center gap-1">
                <CheckCircle size={14} />
                {completedCount} completed
              </span>
            )}
            {errorCount > 0 && (
              <span className="text-destructive flex items-center gap-1">
                <AlertCircle size={14} />
                {errorCount} failed
              </span>
            )}
          </div>
          {completedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCompleted}>
              Clear completed
            </Button>
          )}
        </div>
      )}

      {/* File list */}
      <AnimatePresence>
        {uploadingFiles.length > 0 && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {uploadingFiles.map((uploadFile) => (
              <motion.div
                key={uploadFile.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border"
              >
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {uploadFile.preview ? (
                    <img 
                      src={uploadFile.preview} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  ) : uploadFile.file.type.startsWith('video/') ? (
                    <Video size={20} className="text-muted-foreground" />
                  ) : (
                    <Image size={20} className="text-muted-foreground" />
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {(uploadFile.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    {uploadFile.status === 'error' && (
                      <span className="text-xs text-destructive">{uploadFile.error}</span>
                    )}
                  </div>
                  {(uploadFile.status === 'uploading' || uploadFile.status === 'pending') && (
                    <Progress value={uploadFile.progress} className="h-1 mt-2" />
                  )}
                </div>

                {/* Status icon */}
                <div className="flex-shrink-0">
                  {uploadFile.status === 'uploading' && (
                    <Loader2 size={20} className="animate-spin text-primary" />
                  )}
                  {uploadFile.status === 'success' && (
                    <CheckCircle size={20} className="text-green-500" />
                  )}
                  {uploadFile.status === 'error' && (
                    <AlertCircle size={20} className="text-destructive" />
                  )}
                  {(uploadFile.status === 'success' || uploadFile.status === 'error') && (
                    <button
                      onClick={() => removeFile(uploadFile.id)}
                      className="ml-2 p-1 hover:bg-muted rounded"
                    >
                      <X size={16} className="text-muted-foreground" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
