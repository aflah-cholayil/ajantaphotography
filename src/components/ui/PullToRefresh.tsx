import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const isMobile = useIsMobile();
  const { pullDistance, isRefreshing, isPulling, containerProps } = usePullToRefresh({
    onRefresh,
    threshold: 80,
    isEnabled: isMobile,
  });

  const showIndicator = pullDistance > 10 || isRefreshing;
  const progress = Math.min(pullDistance / 80, 1);
  const rotation = isRefreshing ? 360 : progress * 180;

  return (
    <div {...containerProps} className={className}>
      {/* Pull indicator */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{
          height: showIndicator ? Math.max(pullDistance, isRefreshing ? 48 : 0) : 0,
          opacity: showIndicator ? 1 : 0,
        }}
        transition={{ duration: isPulling ? 0 : 0.2 }}
        className="flex items-center justify-center overflow-hidden bg-background"
      >
        <motion.div
          animate={{ rotate: isRefreshing ? [0, 360] : rotation }}
          transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
          className="flex items-center justify-center"
        >
          <RefreshCw
            size={24}
            className={`text-primary transition-opacity ${progress >= 1 || isRefreshing ? 'opacity-100' : 'opacity-50'}`}
          />
        </motion.div>
      </motion.div>
      
      {/* Content with slight transform during pull */}
      <motion.div
        animate={{ y: isPulling && pullDistance > 0 ? pullDistance * 0.1 : 0 }}
        transition={{ duration: isPulling ? 0 : 0.2 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
