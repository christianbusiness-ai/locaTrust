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
