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
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const { settings, isLoading } = useStudioSettings();

  // Get video URL from studio settings - check both key exists AND visibility is true
  const showcaseVideoKey = settings.showcase_video_key?.trim();
  const isVideoVisible = settings.showcase_video_visible === 'true';
  const hasValidVideo = Boolean(showcaseVideoKey) && showcaseVideoKey.length > 0;
  const shouldRenderSection = hasValidVideo && isVideoVisible;

  // Fetch signed URL for the video
  useEffect(() => {
    if (!shouldRenderSection || !showcaseVideoKey) {
      setSignedVideoUrl(null);
      return;
    }

    const fetchSignedUrl = async () => {
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
    console.log('[CinematicVideoSection] Video loaded successfully');
    setIsVideoLoaded(true);
    setHasError(false);
  }, []);

  const handleVideoError = useCallback(() => {
    console.error('[CinematicVideoSection] Showcase video failed to load');
    setHasError(true);
    setIsVideoLoaded(false);
  }, []);

  // Animation variants with smooth zoom effect
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] as const },
    },
  };

  // Don't render section if loading, no video, not visible, or has error
  if (isLoading) {
    return null;
  }

  if (!shouldRenderSection || hasError || !signedVideoUrl) {
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
