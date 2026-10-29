'use client';

import React, { useState } from 'react';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  className?: string;
  sizeClassName?: string;
  isOnline?: boolean;
  borderClassName?: string;
  fallbackRole?: string;
}

// Couleurs de fond distinctives et stables selon le nom de l'utilisateur
const AVATAR_GRADIENTS = [
  'from-blue-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-indigo-600 to-purple-700',
  'from-amber-600 to-orange-700',
  'from-rose-600 to-pink-700',
  'from-cyan-600 to-blue-700'
];

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  className = '',
  sizeClassName = 'w-10 h-10',
  isOnline = false,
  borderClassName = 'border-2 border-emerald-500',
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

  // Déterminer un gradient stable et unique basé sur le nom
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const gradientClass = AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];

  // Vérifier si le src fourni est une vraie photo réelle (non fictive)
  const isRealPhoto = Boolean(
    src &&
    typeof src === 'string' &&
    src.trim().length > 10 &&
    !src.includes('ui-avatars.com') &&
    !src.includes('images.unsplash.com') &&
    (src.startsWith('data:image') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/'))
  );

  const showImage = isRealPhoto && !hasError;

  return (
    <div className={`relative shrink-0 ${sizeClassName} ${className}`}>
      {showImage ? (
        <img
          src={src!}
          alt={cleanName || 'Avatar'}
          className={`w-full h-full rounded-full object-cover ${borderClassName} shadow-sm`}
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className={`w-full h-full rounded-full bg-gradient-to-tr ${gradientClass} text-white font-black text-xs flex items-center justify-center ${borderClassName} shadow-sm select-none tracking-wider`}
          title={cleanName}
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
