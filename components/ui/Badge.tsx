import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'blue' | 'gold' | 'green' | 'red' | 'gray';
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'blue',
  className,
  children,
}) => {
  const styles = {
    blue: 'bg-brand-500 text-white font-semibold',
    gold: 'bg-amber-100 text-amber-800 border border-amber-300 font-semibold',
    green: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold',
    red: 'bg-rose-100 text-rose-800 border border-rose-300 font-semibold',
    gray: 'bg-slate-100 text-slate-700 border border-slate-200 font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs transition-colors',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
