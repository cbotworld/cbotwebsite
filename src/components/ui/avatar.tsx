'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Avatar({
  src,
  alt,
  fallback,
  className,
  size = 'md',
}: {
  src?: string;
  alt?: string;
  fallback: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const [error, setError] = React.useState(false);

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs font-black',
    md: 'h-10 w-10 text-sm font-black',
    lg: 'h-12 w-12 text-base font-black',
    xl: 'h-16 w-16 text-xl font-black',
  };

  const isSystemLogo = src === '/logo.png' || src === '/tectangle-logo.png';
  const firstLetter = (fallback || alt || 'P').trim().charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full items-center justify-center select-none shadow-md transition-transform',
        isSystemLogo
          ? 'bg-black/50 border border-amber-500/30'
          : 'bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-black border border-amber-400/50 font-black',
        sizeClasses[size],
        className
      )}
    >
      {isSystemLogo && src && !error ? (
        <img
          src={src}
          alt={alt || fallback}
          className="aspect-square h-full w-full object-contain p-0.5"
          onError={() => setError(true)}
        />
      ) : (
        <span className="leading-none text-center font-black drop-shadow-sm">
          {firstLetter}
        </span>
      )}
    </div>
  );
}
