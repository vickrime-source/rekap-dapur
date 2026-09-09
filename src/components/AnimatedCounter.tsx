import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatRupiah } from '../lib/formatters';

interface AnimatedCounterProps {
  value: number;
  format?: 'rupiah' | 'number';
  className?: string;
  suffix?: string;
  duration?: number; // in ms, default 500
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  format = 'number',
  className = '',
  suffix = '',
  duration = 500,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    prevValueRef.current = value;

    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    const startTime = performance.now();

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing: easeOutExpo / cubic
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentValue = Math.round(startValue + (endValue - startValue) * easeProgress);

      setDisplayValue(currentValue);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(endValue);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateCounter);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [value, duration]);

  const formattedText = format === 'rupiah' ? formatRupiah(displayValue) : displayValue.toLocaleString('id-ID');

  return (
    <span className={`inline-flex items-center overflow-hidden ${className}`}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={`${value}`}
          initial={{ opacity: 0.6, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0.4, y: 4, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="inline-block tabular-nums"
        >
          {formattedText}
          {suffix && <span className="ml-1">{suffix}</span>}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};
