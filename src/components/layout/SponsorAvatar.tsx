import * as React from 'react';
import { sponsorInitials } from '@/lib/website-cms';

type SponsorAvatarProps = {
  name: string;
  imageUrl?: string;
  size?: 'md' | 'gold';
  imageClassName?: string;
};

export function SponsorAvatar({
  name,
  imageUrl,
  imageClassName = 'object-cover',
}: SponsorAvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`h-full w-full ${imageClassName}`}
      />
    );
  }

  return (
    <span className="text-xl sm:text-2xl font-black bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent select-none tracking-wide">
      {sponsorInitials(name)}
    </span>
  );
}
