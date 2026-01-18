import { motion, Variants } from 'framer-motion';
import { ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type AnimationType = 'fadeUp' | 'fadeIn' | 'scaleIn' | 'slideLeft' | 'slideRight' | 'kenBurns';

interface ScrollRevealProps {
  children: ReactNode;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

const animations: Record<AnimationType, Variants> = {
  fadeUp: {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
  },
  slideLeft: {
    hidden: { opacity: 0, x: 60 },
    visible: { opacity: 1, x: 0 },
  },
  slideRight: {
    hidden: { opacity: 0, x: -60 },
    visible: { opacity: 1, x: 0 },
  },
  kenBurns: {
    hidden: { opacity: 0, scale: 1 },
    visible: { opacity: 1, scale: 1.05 },
  },
};

const reducedAnimations: Record<AnimationType, Variants> = {
  fadeUp: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  scaleIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  slideLeft: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  slideRight: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  kenBurns: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
};

export function ScrollReveal({
  children,
  animation = 'fadeUp',
  delay = 0,
  duration = 0.6,
  className = '',
  once = true,
}: ScrollRevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const selectedAnimations = prefersReducedMotion ? reducedAnimations : animations;

  return (
    <motion.div
      variants={selectedAnimations[animation]}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.2 }}
      transition={{
        duration: prefersReducedMotion ? 0.2 : duration,
        delay: prefersReducedMotion ? 0 : delay,
        ease: 'easeOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
