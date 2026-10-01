'use client';

import React from 'react';
import { UserRole } from '@/types/database.types';
import { ShieldAlert, User, Building2, Crown, Sparkles, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onOpenRegister?: () => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  currentRole,
  onRoleChange,
  onOpenRegister,
}) => {
  const roles: { role: UserRole; label: string; icon: any }[] = [
    { role: 'locataire', label: 'Locataire', icon: User },
    { role: 'proprietaire', label: 'Propriétaire', icon: Building2 },
    { role: 'agence', label: 'Agence', icon: Building2 },
    { role: 'admin', label: 'Admin', icon: Crown },
  ];

  return (
    <div className="bg-slate-900 text-white text-xs py-1.5 sm:py-2 px-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="font-semibold text-slate-300 whitespace-nowrap">Mode Démo :</span>
        <span className="text-slate-400 truncate hidden md:inline">Changer de rôle pour simuler les différents espaces</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-0.5 sm:pb-0 scrollbar-none">
        <button
          type="button"
          onClick={() => {
            if (onOpenRegister) {
              onOpenRegister();
            } else if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('locatrust_open_register'));
            }
          }}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] sm:text-xs shadow-sm transition-all shrink-0 active:scale-95"
          title="Créer un compte pour n'importe quel rôle"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span className="whitespace-nowrap">+ Créer un compte</span>
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
