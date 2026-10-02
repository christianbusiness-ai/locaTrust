'use client';

import React from 'react';
import { UserRole } from '@/types/database.types';
import { ShieldAlert, User, Building2, Crown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onOpenRegister?: () => void;
  onExitToLanding?: () => void;
  isDemo?: boolean;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  currentRole,
  onRoleChange,
  onOpenRegister,
  onExitToLanding,
  isDemo,
}) => {
  // 1. Si le rôle actuel est admin et que nous sommes en session admin privée, on n'affiche jamais la barre
  if (currentRole === 'admin') {
    return null;
  }

  // 2. Si un compte réel a été créé ou que l'on n'est pas en mode démo : CACHER CETTE PARTIE STRICTEMENT
  // "Une fois un compte est créé, le propriétaire du compte ne peut pas basculer dans n'importe quel sens.
  // Il ne peut pas aller chez le locataire, ni l'agence, ni le propriétaire. Donc il faut cacher cette partie une fois un compte est créé."
  const hasCreatedAccount = typeof window !== 'undefined' && (
    localStorage.getItem('locatrust_account_created') === 'true' ||
    localStorage.getItem('locatrust_is_demo') === 'false' ||
    Boolean(localStorage.getItem('locatrust_active_user'))
  );

  if (isDemo === false || (isDemo === undefined && hasCreatedAccount)) {
    return null;
  }

  const roles: { role: UserRole; label: string; icon: any }[] = [
    { role: 'locataire', label: 'Locataire', icon: User },
    { role: 'proprietaire', label: 'Propriétaire', icon: Building2 },
    { role: 'agence', label: 'Agence', icon: Building2 },
  ];

  return (
    <div className="bg-slate-900 text-white text-xs py-1.5 sm:py-2 px-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="font-semibold text-slate-300 whitespace-nowrap">Mode Démo :</span>
        <span className="text-slate-400 truncate hidden md:inline">Données simulées • Basculez entre les rôles pour tester la plateforme</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-0.5 sm:pb-0 scrollbar-none">
        <button
          type="button"
          onClick={() => {
            if (onExitToLanding) {
              onExitToLanding();
            } else if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('locatrust_exit_landing'));
            }
          }}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[11px] sm:text-xs border border-slate-700 transition-all shrink-0 active:scale-95"
          title="Sortir vers la Landing Page publique"
        >
          <ExternalLink className="w-3 h-3 text-blue-400" />
          <span className="whitespace-nowrap">Sortir vers la Landing Page</span>
        </button>

        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg shrink-0">
          {roles.map(({ role, label, icon: Icon }) => (
            <button
              key={role}
              onClick={() => onRoleChange(role)}
              className={cn(
                "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md transition-all font-medium text-[11px] sm:text-xs whitespace-nowrap",
                currentRole === role
                  ? "bg-blue-600 text-white shadow-sm font-bold"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
