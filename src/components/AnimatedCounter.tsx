import React from 'react';
import { formatRupiah } from '../lib/formatters';

interface AnimatedCounterProps {
  value: number;
  format?: 'rupiah' | 'number';
  className?: string;
  suffix?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = React.memo(({
  value,
  format = 'number',
  className = '',
  suffix = '',
}) => {
  const formattedText = format === 'rupiah' 
    ? formatRupiah(value) 
    : (Number(value) || 0).toLocaleString('id-ID');

  return (
    <span className={`inline-flex items-center tabular-nums transition-opacity duration-150 ${className}`}>
      <span>{formattedText}</span>
      {suffix && <span className="ml-1">{suffix}</span>}
    </span>
  );
});
