import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image, Video, Loader2, Check } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Generate preview
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
      
      // Auto-set title from filename if empty
      if (!title) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt.replace(/[_-]/g, ' '));
      }
    }
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      'video/*': ['.mp4', '.mov', '.webm'],
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
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
        video.src = URL.createObjectURL(file);
      } else {
        const img = document.createElement('img');
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
          URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
      }
    });
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error('Please provide a title and select a file');
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to upload');
        return;
      }

      // Get presigned URL
      setUploadProgress(20);
      const { data: urlData, error: urlError } = await supabase.functions.invoke('manage-work', {
        body: {
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        },
        headers: { 'action': 'upload-url' },
      });

      if (urlError) throw urlError;

      // Manually call with query params since invoke doesn't support them well
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-work?action=upload-url`,
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

      const { uploadUrl, previewUploadUrl, s3Key, previewKey } = await response.json();

      // Upload main file to S3
      setUploadProgress(40);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      // Also upload to preview location (same file for now - could be resized in future)
      setUploadProgress(55);
      const previewUploadResponse = await fetch(previewUploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!previewUploadResponse.ok) {
        console.warn('Failed to upload preview, using main file');
      }

      // Get dimensions
      setUploadProgress(70);
      const dimensions = await getMediaDimensions(file);

      // Create work record
      setUploadProgress(85);
      const createResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-work?action=create`,
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
      toast.success('Work uploaded successfully!');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload work');
    } finally {
      setUploading(false);
    }
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
            Add a new photo or video to your portfolio
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
              {preview ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative aspect-video max-h-64 mx-auto rounded-lg overflow-hidden"
                >
                  {isVideo ? (
                    <video
                      src={preview}
                      className="w-full h-full object-cover"
                      controls
                    />
                  ) : (
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
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
                    or click to browse (max 100MB)
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
                <p className="text-sm text-muted-foreground">
                  Display in the featured gallery on the home page
                </p>
              </div>
              <Switch
                checked={showOnHome}
                onCheckedChange={setShowOnHome}
                disabled={uploading}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Show on Gallery Page</Label>
                <p className="text-sm text-muted-foreground">
                  Display in the full portfolio gallery
                </p>
              </div>
              <Switch
                checked={showOnGallery}
                onCheckedChange={setShowOnGallery}
                disabled={uploading}
              />
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm">
                  {uploadProgress < 40 ? 'Preparing upload...' :
                   uploadProgress < 70 ? 'Uploading to storage...' :
                   uploadProgress < 85 ? 'Processing...' :
                   uploadProgress < 100 ? 'Saving...' : 'Complete!'}
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
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
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
