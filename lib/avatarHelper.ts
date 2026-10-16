import { supabase } from '@/src/lib/supabase';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';

/**
 * Compresse une image de profil sur canvas (max 256x256, ~15-25 Ko).
 * Évite tout QuotaExceededError dans le localStorage sur mobile (ex: Samsung Galaxy A03)
 * et garantit un chargement et une synchronisation ultra-rapides multi-appareils.
 */
export async function compressAvatarImage(
  file: File,
  maxDim: number = 256,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format d\'image non supporté.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Crop centré carré pour un avatar parfait
          const minDim = Math.min(width, height);
          const startX = (width - minDim) / 2;
          const startY = (height - minDim) / 2;

          const targetSize = Math.min(maxDim, minDim);
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }

          // Rendu haute fidélité avec lissage
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(
            img,
            startX,
            startY,
            minDim,
            minDim,
            0,
            0,
            targetSize,
            targetSize
          );

          // Format JPEG compressé propre et universel
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (e) {
          resolve(reader.result as string);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const SUGGESTED_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80', // Femme professionnelle
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80', // Homme professionnel
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80', // Manager / Agence
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80', // Homme cadre
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=256&q=80', // Femme dirigeante
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=256&q=80'  // Conseiller immobilier
];

export function getDefaultRealisticAvatar(name?: string, role?: string): string {
  const clean = (name || '').trim().toLowerCase();
  if (role && role.toLowerCase().includes('agence')) {
    return SUGGESTED_AVATARS[2]; // Photo professionnelle agence
  }
  let sum = 0;
  for (let i = 0; i < clean.length; i++) {
    sum += clean.charCodeAt(i);
  }
  return SUGGESTED_AVATARS[sum % SUGGESTED_AVATARS.length];
}

/**
 * Sauvegarde la photo de profil, la met en cache local sans dépasser le quota
 * et la synchronise en temps réel vers Supabase et tous les appareils connectés.
 */
export async function saveUserAvatarLocallyAndSync(userId: string, avatarDataUrl: string): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('locatrust_user_avatar', avatarDataUrl);
      if (userId) {
        localStorage.setItem(`locatrust_user_avatar_${userId}`, avatarDataUrl);
      }

      // Propager également dans les candidatures en cache local
      const appsRaw = localStorage.getItem('locatrust_rental_applications');
      if (appsRaw) {
        const apps = JSON.parse(appsRaw);
        if (Array.isArray(apps)) {
          const updatedApps = apps.map((a: any) => {
            if (a.owner_id === userId || a.agency_id === userId) {
              return { ...a, owner_avatar: avatarDataUrl };
            }
            if (a.tenant_id === userId) {
              return { ...a, tenant_avatar: avatarDataUrl };
            }
            return a;
          });
          localStorage.setItem('locatrust_rental_applications', JSON.stringify(updatedApps));
          window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: { updatedApps } }));
        }
      }

      // Mettre à jour le contact direct dans le cache des contacts
      if (userId) {
        const cKey = `locatrust_contact_${userId}`;
        const existing = localStorage.getItem(cKey);
        if (existing) {
          try {
            const parsed = JSON.parse(existing);
            localStorage.setItem(cKey, JSON.stringify({ ...parsed, avatar: avatarDataUrl }));
          } catch {}
        }
      }

      window.dispatchEvent(new CustomEvent('locatrust:avatar_updated', { detail: { avatarUrl: avatarDataUrl } }));
      window.dispatchEvent(new CustomEvent('locatrust:profile_updated'));
    } catch (e) {
      console.warn('LocalStorage avatar caching notice:', e);
    }
  }

  if (userId) {
    try {
      await supabase
        .from('profiles')
        .update({
          avatar_url: avatarDataUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      await broadcastLiveEvent('AVATAR_UPDATED', {
        actorId: userId,
        targetUserId: userId,
        data: { avatarUrl: avatarDataUrl }
      });
    } catch (dbErr) {
      console.warn('Supabase profile avatar update error:', dbErr);
    }
  }
}
