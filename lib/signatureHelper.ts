/**
 * LocaTrust Electronic Signature Helper
 * Generates high-resolution, certified calligraphic signature PNG data URLs
 * for official contracts, receipts, and quittances.
 */

export function getCertifiedSignatureDataUrl(
  name: string,
  role: 'bailleur' | 'locataire' | 'agence' = 'bailleur',
  existingUrl?: string | null,
  signDate: string = '01/07/2026 à 10:32'
): string {
  const effectiveUrl = existingUrl;

  // If valid image data URL, http, https, or blob URL is already provided by user canvas on this specific document, use it directly
  if (
    effectiveUrl &&
    typeof effectiveUrl === 'string' &&
    (effectiveUrl.startsWith('data:image/') ||
      effectiveUrl.startsWith('http://') ||
      effectiveUrl.startsWith('https://') ||
      effectiveUrl.startsWith('blob:'))
  ) {
    return effectiveUrl;
  }

  return '';
}

export function getStoredOwnerSignature(_ownerId?: string | null): string | null {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('locatrust_owner_signature');
      localStorage.removeItem('locatrust_user_signature');
      localStorage.removeItem('locatrust_signature_url');
      if (_ownerId) {
        localStorage.removeItem(`locatrust_owner_signature_${_ownerId}`);
        localStorage.removeItem(`locatrust_saved_signature_${_ownerId}`);
      }
    } catch {}
  }
  return null;
}

export function getStoredTenantSignature(_tenantId?: string | null): string | null {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('locatrust_tenant_signature');
      localStorage.removeItem('locatrust_user_signature');
      localStorage.removeItem('locatrust_signature_url');
      if (_tenantId) {
        localStorage.removeItem(`locatrust_tenant_signature_${_tenantId}`);
        localStorage.removeItem(`locatrust_saved_signature_${_tenantId}`);
      }
    } catch {}
  }
  return null;
}

export function persistOwnerSignature(_signatureDataUrl: string, _ownerId?: string | null): void {
  // Les signatures ne doivent jamais être stockées globalement pour être réutilisées automatiquement sur un autre document.
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('locatrust_owner_signature');
      localStorage.removeItem('locatrust_user_signature');
      localStorage.removeItem('locatrust_signature_url');
      if (_ownerId) {
        localStorage.removeItem(`locatrust_owner_signature_${_ownerId}`);
        localStorage.removeItem(`locatrust_saved_signature_${_ownerId}`);
      }
    } catch {}
  }
}

export function persistTenantSignature(_signatureDataUrl: string, _tenantId?: string | null): void {
  // Les signatures ne doivent jamais être stockées globalement pour être réutilisées automatiquement sur un autre document.
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('locatrust_tenant_signature');
      localStorage.removeItem('locatrust_user_signature');
      localStorage.removeItem('locatrust_signature_url');
      if (_tenantId) {
        localStorage.removeItem(`locatrust_tenant_signature_${_tenantId}`);
        localStorage.removeItem(`locatrust_saved_signature_${_tenantId}`);
      }
    } catch {}
  }
}

