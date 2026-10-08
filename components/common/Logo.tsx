import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  align?: 'left' | 'center';
  showSubtitle?: boolean;
  subtitleText?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'light', // Par défaut 'light' pour garantir la visibilité sur fond blanc
  align = 'center',
  showSubtitle = true,
  subtitleText = 'La gestion locative en toute confiance',
}) => {
  const isDarkBg = variant === 'dark';
  const isCenter = align === 'center';

  const imgHeights = {
    sm: 'h-7',
    md: 'h-9',
    lg: 'h-11',
  };

  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const titleSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={`flex flex-col ${isCenter ? 'items-center text-center' : 'items-start text-left'} select-none group cursor-pointer`}>
      {!isDarkBg ? (
        /* Logo officiel LocaTrust issu des fichiers du projet (public/locatrust-official-logo.png) */
        <div className={`flex flex-col ${isCenter ? 'items-center text-center' : 'items-start text-left'}`}>
          <div className="flex items-center gap-2">
            <img
              src="/locatrust-official-logo.png"
              alt="LocaTrust"
              className={`${imgHeights[size]} w-auto object-contain drop-shadow-sm`}
            />
          </div>
          {showSubtitle && (
            <span className="text-[10px] font-semibold text-slate-500 tracking-tight mt-0.5 whitespace-nowrap">
              {subtitleText}
            </span>
          )}
        </div>
      ) : (
        /* Version adaptée aux fonds sombres (ex: Sidebar sombre bg-slate-900) */
        <div className={`flex flex-col ${isCenter ? 'items-center text-center' : 'items-start text-left'}`}>
          <div className="flex items-center gap-2.5">
            {/* Icône Maison Officielle avec Bouclier et Coche */}
            <div className={`${iconSizes[size]} relative shrink-0 flex items-center justify-center`}>
              <svg
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
              >
                {/* Corps Maison Bleu */}
                <path
                  d="M12 28L32 10L52 28V52C52 54.2091 50.2091 56 48 56H16C13.7909 56 12 54.2091 12 52V28Z"
                  fill="#1D4ED8"
                />
                {/* Toit Doré Accent */}
                <path
                  d="M32 6L6 29.5L11 34L32 15L53 34L58 29.5L32 6Z"
                  fill="#F59E0B"
                />
                {/* Bouclier Certifié Intérieur */}
                <path
                  d="M32 25C38 25 43 27 43 33C43 42 32 48 32 48C32 48 21 42 21 33C21 27 26 25 32 25Z"
                  fill="#0F172A"
                  stroke="#F59E0B"
                  strokeWidth="2.5"
                />
                {/* Coche de Validation */}
                <path
                  d="M27 36L30.5 39.5L37 32"
                  stroke="#F59E0B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Typographie de Marque */}
            <div className="flex flex-col text-left">
              <div className={`font-black tracking-tight leading-none ${titleSizes[size]}`}>
                <span className="text-white">Loca</span>
                <span className="text-amber-500">Trust</span>
              </div>
            </div>
          </div>

          {showSubtitle && (
            <span className="text-[10px] font-medium tracking-normal whitespace-nowrap mt-1 text-amber-400/90 pl-0.5">
              {subtitleText}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
