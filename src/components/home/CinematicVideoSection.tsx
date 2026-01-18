import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useIsMobile } from '@/hooks/use-mobile';
import { useStudioSettings } from '@/hooks/useStudioSettings';

export const CinematicVideoSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const { settings, isLoading } = useStudioSettings();

  // Get video URL from studio settings - only show if a custom video is configured
  const showcaseVideoKey = settings.showcase_video_key?.trim();
  const hasCustomVideo = Boolean(showcaseVideoKey);
  
  const videoUrl = hasCustomVideo
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/s3-signed-url?key=${encodeURIComponent(showcaseVideoKey)}`
    : null;
  
  // Use intersection observer for scroll-triggered playback
  const isInView = useInView(sectionRef, {
    amount: 0.3,
    once: false,
  });

  // Handle video playback based on viewport
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideoLoaded || hasError) return;

    if (isInView && !prefersReducedMotion) {
      video.play().catch((err) => {
        console.warn('Video autoplay prevented:', err);
      });
    } else {
      video.pause();
    }
  }, [isInView, isVideoLoaded, prefersReducedMotion, hasError]);

  const handleVideoLoad = useCallback(() => {
    setIsVideoLoaded(true);
    setHasError(false);
  }, []);

  const handleVideoError = useCallback(() => {
    console.error('Showcase video failed to load');
    setHasError(true);
    setIsVideoLoaded(false);
  }, []);

  // Animation variants with smooth zoom effect
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.96 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 1, ease: [0.25, 0.1, 0.25, 1] as const },
    },
  };

  // Don't render section if loading, no custom video configured, or has error
  if (isLoading || !hasCustomVideo || hasError) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-background overflow-hidden"
    >
      {/* Full-width cinematic container */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        className="relative w-full"
      >
        {/* Video Container - Responsive aspect ratio */}
        <div 
          className="relative w-full overflow-hidden"
          style={{ 
            aspectRatio: isMobile ? '16/9' : '21/9',
          }}
        >
          {/* Loading placeholder */}
          {!isVideoLoaded && (
            <div className="absolute inset-0 bg-card animate-pulse" />
          )}

          {/* Video Element - Lazy loaded, no controls, muted, looping */}
          {videoUrl && (
            <video
              ref={videoRef}
              key={videoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              src={videoUrl}
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
          
          {/* Top and bottom edge blending */}
          <div className="absolute top-0 left-0 right-0 h-8 sm:h-12 bg-gradient-to-b from-background to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-8 sm:h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </div>
      </motion.div>
    </section>
  );
};
