'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const GENERIC_AVATAR =
  /photo-1534528741775-53994a69daeb|api\.dicebear\.com|ui-avatars\.com/i;

function twoLetterName(value: string) {
  const letters = (value || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  if (letters.length >= 2) return letters.slice(0, 2);
  if (letters.length === 1) return letters;
  return '?';
}

function isGenericAvatarSrc(src?: string) {
  return !src || GENERIC_AVATAR.test(src);
}

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
    sm: 'h-8 w-8 text-[10px] font-black',
    md: 'h-10 w-10 text-xs font-black',
    lg: 'h-12 w-12 text-sm font-black',
    xl: 'h-16 w-16 text-lg font-black',
  };

  const isSystemLogo = src === '/logo.png' || src === '/tectangle-logo.png';
  const initials = twoLetterName(fallback || alt || 'P');
  const showPhoto = Boolean(src) && !error && !isGenericAvatarSrc(src);

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
      {showPhoto ? (
        <img
          src={src}
          alt={alt || fallback}
          className={cn(
            'aspect-square h-full w-full',
            isSystemLogo ? 'object-contain p-0.5' : 'object-cover'
          )}
          onError={() => setError(true)}
        />
      ) : (
        <span className="leading-none text-center font-black tracking-tight drop-shadow-sm">
          {initials}
        </span>
      )}
    </div>
  );
}
