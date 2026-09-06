'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const GENERIC_AVATAR =
  /photo-1534528741775-53994a69daeb|images\.unsplash\.com|api\.dicebear\.com|ui-avatars\.com/i;

function twoLetterName(value: string) {
  const raw = (value || '').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0].replace(/[^a-zA-Z0-9]/g, '')[0];
    const second = parts[1].replace(/[^a-zA-Z0-9]/g, '')[0];
    if (first && second) return (first + second).toUpperCase();
  }
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length >= 2) return clean.slice(0, 2);
  if (clean.length === 1) return (clean + clean);
  return 'PL';
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
