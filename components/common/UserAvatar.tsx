'use client';

import React, { useState } from 'react';
import { getDefaultRealisticAvatar } from '@/lib/avatarHelper';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  className?: string;
  sizeClassName?: string;
  isOnline?: boolean;
  borderClassName?: string;
  fallbackRole?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  className = '',
  sizeClassName = 'w-10 h-10',
  isOnline = false,
  borderClassName = 'border-2 border-emerald-500',
  fallbackRole
}) => {
  const [hasError, setHasError] = useState(false);

  const cleanName = (name || '').trim();
  const initials = cleanName
    ? cleanName
        .split(/\s+/)
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'LT';

  const defaultPhoto = getDefaultRealisticAvatar(cleanName, fallbackRole);
  const isValidCustomSrc = Boolean(src && src.trim().length > 5 && !src.includes('ui-avatars.com'));
  const currentImgSrc = hasError ? (src !== defaultPhoto ? defaultPhoto : null) : (isValidCustomSrc ? src! : defaultPhoto);

  return (
    <div className={`relative shrink-0 ${sizeClassName} ${className}`}>
      {currentImgSrc ? (
        <img
          src={currentImgSrc}
          alt={cleanName || 'Avatar'}
          className={`w-full h-full rounded-full object-cover ${borderClassName} shadow-sm`}
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className={`w-full h-full rounded-full bg-gradient-to-tr from-blue-700 via-indigo-600 to-sky-500 text-white font-black text-xs flex items-center justify-center ${borderClassName} shadow-sm select-none tracking-wider`}
        >
          {initials}
        </div>
      )}
      {isOnline && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow" />
      )}
    </div>
  );
};
