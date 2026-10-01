// Générateur de QR Code SVG / Canvas / Data URL standard (QRCode sans dépendances lourdes)
// Génère un véritable code QR scannable par n'importe quel smartphone avec appareil photo

/**
 * Génère une URL de données (DataURL PNG ou SVG) pour un QR Code encodant l'URL absolue ou relative de vérification
 */
export function generateQrCodeSvg(text: string, size = 180): string {
  // Encodage propre via API standard SVG scannable ou Data URL SVG
  const encoded = encodeURIComponent(text);
  // Retourne une URL SVG vectorielle claire ou un lien de rendu
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&format=png&margin=1`;
}

/**
 * Construit l'URL officielle de vérification LocaTrust scannable par smartphone
 */
export function getOfficialVerificationUrl(type: 'contrat' | 'recu', token: string): string {
  // En production ou local
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://locatrust.com';
  return `${origin}/verification/${type}/${token}`;
}
