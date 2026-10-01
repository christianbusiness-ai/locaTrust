import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'dark',
  showSubtitle = true,
}) => {
  const isDarkBg = variant === 'dark'; // dark sidebar vs light header

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
    <div className="flex items-center gap-2.5 select-none group cursor-pointer">
      {/* House Icon with Gold Shield Badge & Checkmark */}
      <div className={`${iconSizes[size]} relative shrink-0 flex items-center justify-center`}>
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
        >
          {/* Blue House Body */}
          <path
            d="M12 28L32 10L52 28V52C52 54.2091 50.2091 56 48 56H16C13.7909 56 12 54.2091 12 52V28Z"
            fill="#1D4ED8"
          />
          {/* Gold Roof Accent */}
          <path
            d="M32 6L6 29.5L11 34L32 15L53 34L58 29.5L32 6Z"
            fill="#F59E0B"
          />
          {/* Outer Gold Shield Emblem */}
          <path
            d="M32 25C32 25 43 27 43 36C43 45 32 50 32 50C32 50 21 45 21 36C21 27 32 25 32 25Z"
            fill="#0F172A"
            stroke="#F59E0B"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Inner Gold Checkmark */}
          <path
            d="M27 36.5L30.5 40L37.5 32"
            stroke="#F59E0B"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Brand Text */}
      <div className="flex flex-col text-left">
        <div className={`font-black tracking-tight leading-none ${titleSizes[size]}`}>
          <span className={isDarkBg ? 'text-white' : 'text-slate-900'}>Loca</span>
          <span className="text-amber-500">Trust</span>
        </div>
        {showSubtitle && (
          <span className="text-[9px] font-medium tracking-wide text-amber-400/90 whitespace-nowrap mt-0.5">
            — Gestion Locative Premium —
          </span>
        )}
      </div>
    </div>
  );
};
