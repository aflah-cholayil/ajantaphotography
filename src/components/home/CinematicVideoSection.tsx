import { useRef, useEffect, useState, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useStudioSettings } from '@/hooks/useStudioSettings';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Loader2, Play } from 'lucide-react';

export const CinematicVideoSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  
  const isMobile = useIsMobile();
  const { settings, isLoading } = useStudioSettings();

  // Get video URL from studio settings
  const showcaseVideoKey = settings.showcase_video_key?.trim();
  const isVideoVisible = settings.showcase_video_visible === 'true';
  const hasValidVideo = Boolean(showcaseVideoKey) && showcaseVideoKey.length > 0;
  
  // IMPORTANT: Show section if we have a valid video key AND visibility is enabled
  const shouldRenderSection = hasValidVideo && isVideoVisible;

  // Fetch signed URL for the video
  useEffect(() => {
    if (!shouldRenderSection || !showcaseVideoKey) {
      setSignedVideoUrl(null);
      return;
    }

    const fetchSignedUrl = async () => {
      setIsFetchingUrl(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/s3-signed-url?key=${encodeURIComponent(showcaseVideoKey)}`
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch signed URL: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.url) {
          console.log('[CinematicVideoSection] Signed URL fetched successfully');
          setSignedVideoUrl(data.url);
          setHasError(false);
        } else {
          throw new Error('No URL in response');
        }
      } catch (error) {
        console.error('[CinematicVideoSection] Failed to fetch signed URL:', error);
        setHasError(true);
        setSignedVideoUrl(null);
      } finally {
        setIsFetchingUrl(false);
      }
    };

    fetchSignedUrl();
  }, [shouldRenderSection, showcaseVideoKey]);

  // Debug logging
  useEffect(() => {
    if (!isLoading) {
      console.log('[CinematicVideoSection] Settings loaded:', {
        hasVideoKey: Boolean(showcaseVideoKey),
        videoKey: showcaseVideoKey ? showcaseVideoKey.substring(0, 30) + '...' : 'none',
        isVisible: isVideoVisible,
        shouldRender: shouldRenderSection,
        hasSignedUrl: Boolean(signedVideoUrl),
      });
    }
  }, [isLoading, showcaseVideoKey, isVideoVisible, shouldRenderSection, signedVideoUrl]);
  
  // Handle video playback based on viewport using IntersectionObserver
  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section || !isVideoLoaded || hasError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch((err) => {
              console.warn('Video autoplay prevented:', err);
            });
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [isVideoLoaded, hasError]);

  const handleVideoLoad = useCallback(() => {
    console.log('[CinematicVideoSection] Video loaded successfully');
    setIsVideoLoaded(true);
    setHasError(false);
  }, []);

  const handleVideoError = useCallback(() => {
    console.error('[CinematicVideoSection] Showcase video failed to load');
    setHasError(true);
    setIsVideoLoaded(false);
  }, []);

  // Don't render if still loading settings
  if (isLoading) {
    return null;
  }

  // Don't render if no video configured or visibility is off
  if (!shouldRenderSection) {
    return null;
  }

  // Don't render if there was an error fetching/loading
  if (hasError && !isFetchingUrl) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      className="py-24 md:py-32 bg-background overflow-hidden"
    >
      <div className="container mx-auto px-6">
        {/* Section Heading */}
        <SectionHeading
          subtitle="Showcase"
          title="Our Cinematic Work"
          description="Experience the artistry and emotion we bring to every frame. A glimpse into the stories we tell."
        />

        {/* Video Container */}
        <div className="relative mt-16">
          {/* Decorative border frame */}
          <div className="absolute -inset-3 md:-inset-4 border border-primary/20 rounded-lg pointer-events-none" />
          <div className="absolute -inset-1 md:-inset-2 border border-primary/10 rounded-lg pointer-events-none" />
          
          {/* Main video card */}
          <div className="relative bg-card rounded-lg overflow-hidden border border-border shadow-2xl">
            {/* Video wrapper with aspect ratio */}
            <div 
              className="relative w-full overflow-hidden"
              style={{ 
                aspectRatio: isMobile ? 16 / 9 : 21 / 9,
              }}
            >
              {/* Loading placeholder - show while fetching URL or loading video */}
              {(!isVideoLoaded || isFetchingUrl || !signedVideoUrl) && (
                <div className="absolute inset-0 bg-card/80 flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Play className="w-8 h-8 text-primary/50" />
                    </div>
                    <Loader2 className="absolute inset-0 w-16 h-16 animate-spin text-primary/30" />
                  </div>
                  <span className="text-sm text-muted-foreground font-sans">Loading cinematic preview...</span>
                </div>
              )}

              {/* Video Element - Only render when we have a URL */}
              {signedVideoUrl && (
                <video
                  ref={videoRef}
                  key={signedVideoUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  src={signedVideoUrl}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onLoadedData={handleVideoLoad}
                  onError={handleVideoError}
                />
              )}

              {/* Subtle dark gradient overlay for cinematic feel */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-background/20 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/20 via-transparent to-background/20 pointer-events-none" />
              
              {/* Corner accents */}
              <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-primary/40 pointer-events-none" />
              <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-primary/40 pointer-events-none" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-primary/40 pointer-events-none" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-primary/40 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
