import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Image } from 'lucide-react';

interface AlbumCoverProps {
  albumId: string;
  coverImageKey: string | null;
  alt: string;
  className?: string;
}

export const AlbumCover = ({ albumId, coverImageKey, alt, className = "w-full h-full object-cover" }: AlbumCoverProps) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!coverImageKey) return;
    
    let cancelled = false;
    
    const fetchUrl = async () => {
      try {
        const response = await supabase.functions.invoke('s3-signed-url', {
          body: { s3Key: coverImageKey, albumId },
        });
        if (!cancelled && response.data?.url) {
          setUrl(response.data.url);
        }
      } catch (e) {
        // Silently handle errors - show placeholder instead
        console.warn('Failed to fetch album cover URL:', e);
      }
    };
    
    fetchUrl();
    return () => { cancelled = true; };
  }, [coverImageKey, albumId]);

  if (!coverImageKey || !url) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Image size={40} className="text-muted-foreground/30" />
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} />;
};
