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
  
  const isMobile = useIsMobile();
  const { settings, isLoading } = useStudioSettings();

  const showcaseVideoKey = settings.showcase_video_key?.trim();
  const isVideoVisible = settings.showcase_video_visible === 'true';
  const hasValidVideo = Boolean(showcaseVideoKey) && showcaseVideoKey!.length > 0;
  const shouldRenderSection = hasValidVideo && isVideoVisible;

  // Build proxy URL
  const videoSrc = shouldRenderSection && showcaseVideoKey
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-stream?key=${encodeURIComponent(showcaseVideoKey)}`
    : null;

  // Handle video playback based on viewport
  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section || !videoSrc || hasError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [videoSrc, hasError]);

  const handleVideoTap = useCallback(() => {
    const video = videoRef.current;
    if (video && video.paused) {
      video.play().catch(() => {});
    }
  }, []);

  const handleVideoLoad = useCallback(() => {
    setIsVideoLoaded(true);
    setHasError(false);
  }, []);

  const handleVideoError = useCallback(() => {
    console.error('[CinematicVideoSection] Video failed to load');
    setHasError(true);
    setIsVideoLoaded(false);
  }, []);

  if (isLoading) return null;
  if (!shouldRenderSection) return null;

  return (
    <section ref={sectionRef} className="py-16 md:py-20 bg-background overflow-hidden">
      <div className="container mx-auto px-6">
        <SectionHeading
          subtitle="Showcase"
          title="Our Cinematic Work"
          description="Experience the artistry and emotion we bring to every frame. A glimpse into the stories we tell."
        />

        <div className="relative mt-12">
          <div className="absolute -inset-3 md:-inset-4 border border-primary/20 rounded-lg pointer-events-none" />
          <div className="absolute -inset-1 md:-inset-2 border border-primary/10 rounded-lg pointer-events-none" />
          
          <div className="relative bg-card rounded-lg overflow-hidden border border-border shadow-2xl">
            <div 
              className="relative w-full overflow-hidden"
              style={{ aspectRatio: isMobile ? 16 / 9 : 21 / 9 }}
            >
              {/* Loading state */}
              {!isVideoLoaded && !hasError && (
                <div className="absolute inset-0 bg-card/80 flex flex-col items-center justify-center gap-4 z-10">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Play className="w-8 h-8 text-primary/50" />
                    </div>
                    <Loader2 className="absolute inset-0 w-16 h-16 animate-spin text-primary/30" />
                  </div>
                  <span className="text-sm text-muted-foreground font-sans">Loading cinematic preview...</span>
                </div>
              )}

              {/* Error fallback */}
              {hasError && (
                <div className="absolute inset-0 bg-card/90 flex flex-col items-center justify-center gap-4 z-10">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Play className="w-10 h-10 text-primary/40" />
                  </div>
                  <span className="text-sm text-muted-foreground">Video unavailable</span>
                </div>
              )}

              {/* Video Element */}
              {videoSrc && !hasError && (
                <video
                  ref={videoRef}
                  key={videoSrc}
                  className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                  src={videoSrc}
                  muted
                  loop
                  playsInline
                  autoPlay
                  preload="auto"
                  onLoadedData={handleVideoLoad}
                  onError={handleVideoError}
                  onClick={handleVideoTap}
                  // @ts-ignore
                  webkit-playsinline="true"
                />
              )}

              {/* Overlays */}
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
