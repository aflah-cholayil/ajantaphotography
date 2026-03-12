import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image, Video, Loader2, Check, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const categories = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'pre-wedding', label: 'Pre-Wedding' },
  { value: 'event', label: 'Event' },
  { value: 'candid', label: 'Candid' },
  { value: 'other', label: 'Other' },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CONCURRENT_PARTS = 5;
const MAX_RETRIES = 3;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export const UploadWorkDialog = ({ open, onOpenChange, onSuccess }: UploadWorkDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('wedding');
  const [showOnHome, setShowOnHome] = useState(false);
  const [showOnGallery, setShowOnGallery] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [uploadEta, setUploadEta] = useState(0);
  const [uploadPhase, setUploadPhase] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (!selectedFile) return;

    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error(`File too large (${formatBytes(selectedFile.size)}). Maximum is 5GB.`);
      return;
    }

    if (selectedFile.size > 1024 * 1024 * 1024) {
      toast.warning(`Large file (${formatBytes(selectedFile.size)}). Upload may take a while.`);
    }

    setFile(selectedFile);
    
    // Generate preview (only for images under 20MB)
    if (selectedFile.type.startsWith('image/') && selectedFile.size < 20 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
    } else if (selectedFile.type.startsWith('video/')) {
      setPreview('video');
    } else {
      setPreview('large-image');
    }
    
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt.replace(/[_-]/g, ' '));
    }
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      'video/*': ['.mp4', '.mov', '.webm'],
    },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('wedding');
    setShowOnHome(false);
    setShowOnGallery(true);
    setFile(null);
    setPreview(null);
    setUploadProgress(0);
    setUploadSpeed(0);
    setUploadEta(0);
    setUploadPhase('');
    abortControllerRef.current = null;
  };

  const getMediaDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          resolve({ width: video.videoWidth, height: video.videoHeight });
          URL.revokeObjectURL(video.src);
        };
        video.onerror = () => resolve({ width: 0, height: 0 });
        video.src = URL.createObjectURL(file);
      } else {
        const img = document.createElement('img');
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = URL.createObjectURL(file);
      }
    });
  };

  const uploadWithXHR = (url: string, fileData: File, onProgress: (loaded: number) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      abortControllerRef.current = { abort: () => xhr.abort() } as any;
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed with status ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.onabort = () => reject(new Error('Upload cancelled'));
      
      xhr.open('PUT', url);
      xhr.send(fileData);
    });
  };

  const uploadChunkWithRetry = async (
    url: string,
    chunk: Blob,
    retries = MAX_RETRIES
  ): Promise<string> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, { method: 'PUT', body: chunk });
        if (!response.ok) throw new Error(`Part upload failed: ${response.status}`);
        const etag = response.headers.get('ETag') || '';
        return etag;
      } catch (err) {
        if (attempt === retries) throw err;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw new Error('Exhausted retries');
  };

  const handleMultipartUpload = async (
    file: File,
    session: any,
  ): Promise<{ s3Key: string; previewKey: string }> => {
    setUploadPhase('Initiating multipart upload...');

    // Initiate
    const initResponse = await fetch(
      `${supabaseUrl}/functions/v1/manage-work?action=multipart-initiate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      }
    );
    if (!initResponse.ok) throw new Error('Failed to initiate multipart upload');
    const { uploadId, s3Key, previewKey } = await initResponse.json();

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const parts: { partNumber: number; etag: string }[] = [];
    let uploadedBytes = 0;
    const startTime = Date.now();

    setUploadPhase(`Uploading ${totalChunks} chunks...`);

    // Upload chunks with concurrency limit
    const queue = Array.from({ length: totalChunks }, (_, i) => i + 1);
    const inFlight: Promise<void>[] = [];

    const uploadNextPart = async (partNumber: number) => {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      // Get signed URL for this part
      const urlResponse = await fetch(
        `${supabaseUrl}/functions/v1/manage-work?action=multipart-part-url`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ s3Key, uploadId, partNumber }),
        }
      );
      if (!urlResponse.ok) throw new Error(`Failed to get URL for part ${partNumber}`);
      const { url } = await urlResponse.json();

      const etag = await uploadChunkWithRetry(url, chunk);
      parts.push({ partNumber, etag });

      uploadedBytes += chunk.size;
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = uploadedBytes / elapsed;
      const remaining = (file.size - uploadedBytes) / speed;

      setUploadProgress(Math.round((uploadedBytes / file.size) * 85) + 5);
      setUploadSpeed(speed);
      setUploadEta(remaining);
    };

    // Process queue with concurrency
    let i = 0;
    while (i < queue.length) {
      const batch = queue.slice(i, i + MAX_CONCURRENT_PARTS);
      await Promise.all(batch.map(pn => uploadNextPart(pn)));
      i += MAX_CONCURRENT_PARTS;
    }

    // Complete multipart
    setUploadPhase('Finalizing upload...');
    parts.sort((a, b) => a.partNumber - b.partNumber);

    const completeResponse = await fetch(
      `${supabaseUrl}/functions/v1/manage-work?action=multipart-complete`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ s3Key, uploadId, parts }),
      }
    );
    if (!completeResponse.ok) throw new Error('Failed to complete multipart upload');

    return { s3Key, previewKey };
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error('Please provide a title and select a file');
      return;
    }

    setUploading(true);
    setUploadProgress(5);
    const startTime = Date.now();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to upload');
        return;
      }

      let s3Key: string;
      let previewKey: string;

      if (file.size >= MULTIPART_THRESHOLD) {
        // Multipart upload for large files
        const result = await handleMultipartUpload(file, session);
        s3Key = result.s3Key;
        previewKey = result.previewKey;
      } else {
        // Single PUT upload with XHR progress
        setUploadPhase('Getting upload URL...');
        setUploadProgress(10);

        const response = await fetch(
          `${supabaseUrl}/functions/v1/manage-work?action=upload-url`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: file.name,
              contentType: file.type,
              fileSize: file.size,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to get upload URL');
        }

        const urlData = await response.json();
        s3Key = urlData.s3Key;
        previewKey = urlData.previewKey;

        setUploadPhase('Uploading file...');
        await uploadWithXHR(urlData.uploadUrl, file, (loaded) => {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = loaded / elapsed;
          const remaining = (file.size - loaded) / speed;
          setUploadProgress(Math.round((loaded / file.size) * 80) + 10);
          setUploadSpeed(speed);
          setUploadEta(remaining);
        });
      }

      // Get dimensions
      setUploadPhase('Processing...');
      setUploadProgress(90);
      const dimensions = await getMediaDimensions(file);

      // Create work record (preview key same as original - no double upload)
      setUploadPhase('Saving record...');
      setUploadProgress(95);
      const createResponse = await fetch(
        `${supabaseUrl}/functions/v1/manage-work?action=create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            category,
            type: file.type.startsWith('video/') ? 'video' : 'photo',
            s3_key: s3Key,
            s3_preview_key: previewKey,
            width: dimensions.width,
            height: dimensions.height,
            size: file.size,
            mime_type: file.type,
            show_on_home: showOnHome,
            show_on_gallery: showOnGallery,
          }),
        }
      );

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || 'Failed to create work record');
      }

      setUploadProgress(100);
      setUploadPhase('Complete!');
      toast.success('Work uploaded successfully!');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Upload error:', {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        error: error instanceof Error ? error.message : error,
      });
      if (error instanceof Error && error.message === 'Upload cancelled') {
        toast.info('Upload cancelled');
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to upload work');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadPhase('');
  };

  const isVideo = file?.type.startsWith('video/');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!uploading) {
        onOpenChange(isOpen);
        if (!isOpen) resetForm();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Upload New Work</DialogTitle>
          <DialogDescription>
            Add a new photo or video to your portfolio (up to 5GB)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300 ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            
            <AnimatePresence mode="wait">
              {file ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative"
                >
                  {preview && preview !== 'video' && preview !== 'large-image' ? (
                    <div className="aspect-video max-h-64 mx-auto rounded-lg overflow-hidden">
                      <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-4">
                      {isVideo ? <Video className="h-12 w-12 text-muted-foreground mb-2" /> : <Image className="h-12 w-12 text-muted-foreground mb-2" />}
                      <p className="text-foreground font-medium">{file.name}</p>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">{formatBytes(file.size)}</p>
                  {file.size > 1024 * 1024 * 1024 && (
                    <p className="text-xs text-yellow-500 flex items-center justify-center gap-1 mt-1">
                      <AlertTriangle size={12} /> Large file — upload may take several minutes
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreview(null);
                    }}
                    className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background transition-colors"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-8"
                >
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-foreground font-medium mb-1">
                    {isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse (up to 5GB)
                  </p>
                  <div className="flex justify-center gap-4 mt-4">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Image size={14} /> Images
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Video size={14} /> Videos
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter work title"
              disabled={uploading}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              disabled={uploading}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={uploading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visibility Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Show on Home Page</Label>
                <p className="text-sm text-muted-foreground">Display in the featured gallery</p>
              </div>
              <Switch checked={showOnHome} onCheckedChange={setShowOnHome} disabled={uploading} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Show on Gallery Page</Label>
                <p className="text-sm text-muted-foreground">Display in the full portfolio</p>
              </div>
              <Switch checked={showOnGallery} onCheckedChange={setShowOnGallery} disabled={uploading} />
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm">{uploadPhase}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {uploadProgress}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              {uploadSpeed > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatSpeed(uploadSpeed)}</span>
                  <span>~{formatTime(uploadEta)} remaining</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={uploading ? handleCancel : () => onOpenChange(false)}
              disabled={false}
            >
              {uploading ? 'Cancel Upload' : 'Cancel'}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || !title.trim() || uploading}
              className="bg-primary hover:bg-primary/90"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Upload Work
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
