import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useIsMobile } from '@/hooks/use-mobile';
import { useStudioSettings } from '@/hooks/useStudioSettings';

// Default demo video URL
const DEFAULT_VIDEO_URL = 'https://videos.pexels.com/video-files/3587080/3587080-uhd_2560_1440_25fps.mp4';

export const CinematicVideoSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const { settings } = useStudioSettings();

  // Get video URL - use custom uploaded video or fallback to demo
  const videoUrl = settings.showcase_video_key
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/s3-signed-url?key=${encodeURIComponent(settings.showcase_video_key)}`
    : DEFAULT_VIDEO_URL;
  
  // Use intersection observer for scroll-triggered playback
  const isInView = useInView(sectionRef, {
    amount: 0.5,
    once: false,
  });

  // Handle video playback based on viewport
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideoLoaded) return;

    if (isInView && !prefersReducedMotion) {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        // Autoplay was prevented
        setIsPlaying(false);
      });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isInView, isVideoLoaded, prefersReducedMotion]);

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
  }, []);

  // Animation variants - using typed easing values
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
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

  return (
    <section
      ref={sectionRef}
      className="relative w-full py-16 md:py-24 bg-background overflow-hidden"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onTouchStart={() => setShowControls(true)}
    >
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="relative rounded-xl md:rounded-2xl overflow-hidden shadow-2xl shadow-black/30"
        >
          {/* Video Container */}
          <div className="relative aspect-video md:aspect-[21/9] w-full">
            {/* Placeholder/Loading state */}
            <div className="absolute inset-0 bg-card flex items-center justify-center">
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center"
                >
                  <Play size={32} className="text-primary ml-1" />
                </motion.div>
                <p className="text-muted-foreground text-sm">Loading cinematic preview...</p>
              </div>
            </div>

            {/* Video Element */}
            <video
              ref={videoRef}
              key={videoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              muted={isMuted}
              loop
              playsInline
              preload="metadata"
              onLoadedData={handleVideoLoad}
              poster=""
            >
              <source
                src={videoUrl}
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>

            {/* Cinematic Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30" />

            {/* Content Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <motion.span
                variants={subtitleVariants}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                className="text-primary font-sans text-xs sm:text-sm uppercase tracking-[0.3em] mb-3 sm:mb-4"
              >
                Cinematic Stories
              </motion.span>

              <motion.h2
                variants={textVariants}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                className="font-serif text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-foreground max-w-3xl leading-tight"
              >
                A Wedding Story by{' '}
                <span className="text-gradient-gold">Ajanta Photography</span>
              </motion.h2>

              <motion.p
                variants={subtitleVariants}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                className="mt-4 sm:mt-6 text-sm sm:text-base text-foreground/70 max-w-xl"
              >
                Every frame tells a story of love, joy, and unforgettable moments
              </motion.p>
            </div>

            {/* Video Controls */}
            <AnimatePresence>
              {(showControls || isMobile) && isVideoLoaded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex items-center justify-between"
                >
                  <button
                    onClick={togglePlay}
                    className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-background transition-colors"
                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    <span className="text-xs sm:text-sm font-sans hidden sm:inline">
                      {isPlaying ? 'Pause' : 'Play'}
                    </span>
                  </button>

                  <button
                    onClick={toggleMute}
                    className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-background transition-colors"
                    aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                  >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    <span className="text-xs sm:text-sm font-sans hidden sm:inline">
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
      <div className="absolute top-1/4 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -z-10" />
    </section>
  );
};
