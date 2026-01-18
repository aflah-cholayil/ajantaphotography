import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useIsMobile } from '@/hooks/use-mobile';
import { useStudioSettings } from '@/hooks/useStudioSettings';

export const CinematicVideoSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
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
      video.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Video autoplay prevented:', err);
        setIsPlaying(false);
      });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isInView, isVideoLoaded, prefersReducedMotion, hasError]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const handleVideoLoad = useCallback(() => {
    setIsVideoLoaded(true);
    setHasError(false);
  }, []);

  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Video failed to load:', e);
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

  const textVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] as const },
    },
  };

  const subtitleVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
    },
  };

  // Don't render section if loading, no custom video configured, or has error
  if (isLoading) {
    return null;
  }

  if (!hasCustomVideo || hasError) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      className="relative w-full py-12 sm:py-16 md:py-24 bg-background overflow-hidden"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onTouchStart={() => setShowControls(true)}
    >
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="relative rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden shadow-2xl shadow-black/30"
        >
          {/* Video Container - Responsive aspect ratio */}
          <div className="relative w-full" style={{ paddingBottom: isMobile ? '56.25%' : '42.86%' }}>
            {/* Placeholder/Loading state */}
            <AnimatePresence>
              {!isVideoLoaded && (
                <motion.div 
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-card flex items-center justify-center z-10"
                >
                  <div className="text-center">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-primary/20 flex items-center justify-center"
                    >
                      <Play size={isMobile ? 24 : 32} className="text-primary ml-1" />
                    </motion.div>
                    <p className="text-muted-foreground text-xs sm:text-sm">Loading cinematic preview...</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Video Element - Lazy loaded */}
            {videoUrl && (
              <video
                ref={videoRef}
                key={videoUrl}
                className="absolute inset-0 w-full h-full object-cover"
                muted={isMuted}
                loop
                playsInline
                preload="metadata"
                onLoadedData={handleVideoLoad}
                onError={handleVideoError}
              >
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )}

            {/* Cinematic Gradient Overlays - Enhanced for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-70 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-background/40 pointer-events-none" />
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />

            {/* Content Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 sm:px-6">
              <motion.span
                variants={subtitleVariants}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                className="text-primary font-sans text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-2 sm:mb-4"
              >
                Cinematic Stories
              </motion.span>

              <motion.h2
                variants={textVariants}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                className="font-serif text-xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-light text-foreground max-w-3xl leading-tight drop-shadow-lg"
              >
                A Wedding Story by{' '}
                <span className="text-gradient-gold">Ajanta Photography</span>
              </motion.h2>

              <motion.p
                variants={subtitleVariants}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                className="mt-3 sm:mt-6 text-xs sm:text-sm md:text-base text-foreground/80 max-w-xl drop-shadow-md"
              >
                Every frame tells a story of love, joy, and unforgettable moments
              </motion.p>
            </div>

            {/* Video Controls */}
            <AnimatePresence>
              {(showControls || isMobile) && isVideoLoaded && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 md:bottom-6 md:left-6 md:right-6 flex items-center justify-between z-20"
                >
                  <button
                    onClick={togglePlay}
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-background transition-colors"
                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                  >
                    {isPlaying ? <Pause size={isMobile ? 14 : 18} /> : <Play size={isMobile ? 14 : 18} />}
                    <span className="text-[10px] sm:text-sm font-sans hidden sm:inline">
                      {isPlaying ? 'Pause' : 'Play'}
                    </span>
                  </button>

                  <button
                    onClick={toggleMute}
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-background transition-colors"
                    aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                  >
                    {isMuted ? <VolumeX size={isMobile ? 14 : 18} /> : <Volume2 size={isMobile ? 14 : 18} />}
                    <span className="text-[10px] sm:text-sm font-sans hidden sm:inline">
                      {isMuted ? 'Unmute' : 'Mute'}
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-1/4 left-0 w-24 sm:w-32 h-24 sm:h-32 bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-0 w-32 sm:w-40 h-32 sm:h-40 bg-primary/5 rounded-full blur-3xl -z-10" />
    </section>
  );
};
