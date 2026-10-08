'use client';

import { User, UserRole, VerificationStatus } from '@/types/database.types';

export interface SingleAdminInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  registeredAt: string;
  isLocked: boolean;
}

const STORAGE_KEY_ADMIN = 'locatrust_single_admin_state';
const STORAGE_KEY_REGISTERED_USERS = 'locatrust_registered_users';
const STORAGE_KEY_ACTIVE_USER = 'locatrust_active_user';

// Initial Single Admin status (Loaded from localStorage or default configured)
export function getSingleAdminInfo(): SingleAdminInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading admin status:', err);
  }
  return null;
}

export function isSingleAdminRegistered(): boolean {
  if (typeof window === 'undefined') return false;
  const admin = getSingleAdminInfo();
  return !!admin && admin.isLocked === true;
}

export function registerSingleAdmin(data: {
  name: string;
  email: string;
  phone: string;
  password?: string;
  token?: string;
}): { success: boolean; error?: string; admin?: SingleAdminInfo } {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Environnement client non disponible.' };
  }

  // Vérifier si un administrateur existe déjà (règle stricte : un seul administrateur)
  if (isSingleAdminRegistered()) {
    return {
      success: false,
      error: 'Un Super Administrateur unique a déjà été enregistré sur cette instance LocaTrust. L\'inscription administrative est fermée.'
    };
  }

  // Token de sécurité Master (configurable via .env.local)
  const masterToken = import.meta.env?.VITE_ADMIN_SETUP_TOKEN || 'LOCATRUST_MASTER_ADMIN_2026_CI';
  if (data.token && data.token.trim() !== masterToken.trim()) {
    return {
      success: false,
      error: 'Le code de sécurité d\'initialisation Super Admin est incorrect. Consultez le fichier .env.local.'
    };
  }

  const adminInfo: SingleAdminInfo = {
    id: 'usr_master_admin_unique',
    name: data.name.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    registeredAt: new Date().toISOString(),
    isLocked: true // Verrouille définitivement l'inscription admin
  };

  try {
    localStorage.setItem(STORAGE_KEY_ADMIN, JSON.stringify(adminInfo));
    
    // Enregistrer aussi comme utilisateur actif
    const userObj: User = {
      id: adminInfo.id,
      role: 'admin',
      full_name: adminInfo.name,
      email: adminInfo.email,
      phone: adminInfo.phone,
      avatar_url: '',
      verification_status: 'verifie',
      created_at: adminInfo.registeredAt
    };
    saveActiveUser(userObj);

    return { success: true, admin: adminInfo };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors de la sauvegarde.' };
  }
}

// Réinitialiser uniquement pour les besoins de démonstration
export function resetSingleAdminForDemo(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_ADMIN);
}

// ---------------------------------------------------------------------------
// GESTION DES UTILISATEURS GÉNÉRAUX (Locataires, Propriétaires, Agences)
// ---------------------------------------------------------------------------

export interface RegisterUserData {
  id?: string;
  role: 'locataire' | 'proprietaire' | 'agence';
  name: string;
  email: string;
  phone: string;
  cniOrRccm: string;
  city?: string;
  commune?: string;
  profession?: string;
  agencyName?: string;
  managerName?: string;
  rccmNumber?: string;
  licenseNumber?: string;
  documentFileName?: string;
  password?: string;
}

export function registerUserAccount(data: RegisterUserData): { success: boolean; user?: User; error?: string } {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Client indisponible.' };
  }

  const id = data.id || `usr_${data.role}_${Date.now()}`;
  const fullName = data.role === 'agence' ? (data.agencyName || data.name) : data.name;

  const newUser: User = {
    id,
    role: data.role,
    full_name: fullName.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    avatar_url: '',
    verification_status: 'en_attente', // En attente de certification KYC
    created_at: new Date().toISOString()
  };

  try {
    const existing = getStoredUsers();
    existing.push(newUser);
    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(existing));
    saveActiveUser(newUser);

    // Déclencher un événement global pour notifier les composants
    window.dispatchEvent(new CustomEvent('locatrust_user_registered', { detail: { user: newUser } }));

    return { success: true, user: newUser };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur d\'inscription.' };
  }
}

export function getStoredUsers(): User[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGISTERED_USERS);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return [];
}

export function saveActiveUser(user: User): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(user));
  } catch {}
}

export function getActiveUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/**
 * Réinitialise complètement les données locales à 0 pour garantir
 * que seules les données réelles des vrais utilisateurs s'affichent.
 */
export function clearAllStoredMockData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('locatrust_properties');
    localStorage.removeItem('locatrust_rental_applications');
    localStorage.removeItem('locatrust_contracts');
    localStorage.removeItem('locatrust_cautions');
    localStorage.removeItem('locatrust_rent_payments');
    localStorage.removeItem('locatrust_receipts');
    localStorage.removeItem('locatrust_maintenance_tickets');
    localStorage.removeItem('locatrust_conversations');
    localStorage.removeItem('locatrust_messages');
  } catch (err) {
    console.warn('Error clearing mock data:', err);
  }
}
