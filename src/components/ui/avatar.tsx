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
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg font-bold',
  };

  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 font-semibold border border-amber-500/30 items-center justify-center',
        sizeClasses[size],
        className
      )}
    >
      {src && !error ? (
        <img
          src={src}
          alt={alt || fallback}
          className="aspect-square h-full w-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <span>{fallback.substring(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
