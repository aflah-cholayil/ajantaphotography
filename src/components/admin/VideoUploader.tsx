import { useState, useRef, useCallback } from 'react';
import { Upload, Video, X, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VideoUploaderProps {
  currentVideoKey?: string;
  onUploadComplete: (s3Key: string) => void;
  onRemove?: () => void;
}

export function VideoUploader({ currentVideoKey, onUploadComplete, onRemove }: VideoUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid format',
        description: 'Please upload MP4, WebM, or MOV video files',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 500MB)
    if (file.size > 1024 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum video size is 1GB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Create local preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      // Refresh and get current session
      const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
      
      if (sessionError || !sessionData.session) {
        // Try getting existing session as fallback
        const { data: existingSession } = await supabase.auth.getSession();
        if (!existingSession.session) {
          throw new Error('Not authenticated. Please log in again.');
        }
      }

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-asset', {
        body: {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          assetType: 'showcase_video',
        },
      });

      if (uploadError) {
        console.error('Edge function error:', uploadError);
        throw new Error(uploadError.message || 'Failed to get upload URL');
      }

      if (!uploadData?.presignedUrl || !uploadData?.s3Key) {
        throw new Error('Invalid response from upload service');
      }

      const { presignedUrl, s3Key } = uploadData;

      // Upload file to S3 with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percent);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));

        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      onUploadComplete(s3Key);
      
      toast({
        title: 'Video uploaded',
        description: 'Your showcase video has been uploaded successfully',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload video',
        variant: 'destructive',
      });
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onUploadComplete, toast]);

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    onRemove?.();
  }, [onRemove]);

  const hasVideo = currentVideoKey || previewUrl;

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {/* Current Video Preview - Compact size for admin */}
      {hasVideo && !isUploading && (
        <div className="relative rounded-lg overflow-hidden bg-muted" style={{ maxHeight: '180px' }}>
          <video
            src={previewUrl || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/s3-signed-url?key=${currentVideoKey}`}
            className="w-full h-full object-cover"
            style={{ maxHeight: '180px' }}
            muted
            loop
            playsInline
            autoPlay
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              onClick={handleRemove}
            >
              <X size={16} />
            </Button>
          </div>
          <div className="absolute bottom-2 left-2 flex items-center gap-2 px-2 py-1 rounded bg-background/80 backdrop-blur-sm">
            <Check size={14} className="text-green-500" />
            <span className="text-xs font-medium">Video uploaded</span>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="rounded-lg bg-muted p-6 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Uploading video...</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-center text-xs text-muted-foreground">{uploadProgress}% complete</p>
        </div>
      )}

      {/* Upload Button */}
      {!isUploading && (
        <Button
          variant={hasVideo ? 'outline' : 'default'}
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          <Upload size={16} className="mr-2" />
          {hasVideo ? 'Replace Video' : 'Upload Showcase Video'}
        </Button>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Accepted formats: MP4, WebM, MOV • Max size: 1GB
      </p>
    </div>
  );
}
