// api/verify.js
// Vercel Serverless Function pour la vérification publique et anonyme de tous les documents LocaTrust
// Conforme Loi n° 2019-576 et AUDCG OHADA
// Accessible publiquement par tout scanner QR (smartphones, banques, notaires, administrations).
// Interroge EXCLUSIVEMENT les fonctions RPC sécurisées (verify_contract et verify_receipt) par jeton aléatoire.

export const config = {
  runtime: 'nodejs',
};

// Limitation de débit par IP en mémoire pour la fonction serverless
const rateLimitMap = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 30;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const timestamps = rateLimitMap.get(ip).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anonymous';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      isFound: false,
      status: 'rate_limited',
      statusLabel: 'Limite de requêtes atteinte',
      statusDescription: 'Trop de vérifications successives. Veuillez patienter une minute avant de réessayer.'
    });
  }

  const queryToken = (req.query?.token || req.body?.token || '').toString().trim();

  if (!queryToken || queryToken.length < 8) {
    return res.status(400).json({
      success: false,
      isFound: false,
      status: 'introuvable',
      statusLabel: 'Jeton de vérification manquant ou invalide',
      statusDescription: 'Aucun jeton conforme n\'a été fourni pour la vérification.'
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://owaxmnanqqvbjjzpouvo.supabase.co';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93YXhtbmFucXF2YmpqenBvdXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDk1MzAsImV4cCI6MjEwNjUyNTUzMH0.9Uvq3qcEB7upM93xiJ528e726RH_Rp8LxOOaZ9CYKj0';

  try {
    // 1. Appel RPC verify_receipt
    const receiptRes = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ p_token: queryToken })
    });

    if (receiptRes.ok) {
      const data = await receiptRes.json();
      if (data && data.isFound) {
        return res.status(200).json({
          success: true,
          isFound: true,
          status: data.status,
          statusLabel: data.status === 'valide' ? 'DOCUMENT LOCATRUST AUTHENTIQUE' : 'EN ATTENTE DE SIGNATURE',
          statusDescription: data.status === 'valide' 
            ? 'Ce reçu de paiement de loyer a été certifié conforme par LocaTrust.' 
            : 'Ce reçu est en cours de validation.',
          receipt: data,
          recu: data,
          diagnostics: {
            tokenSearched: queryToken,
            source: 'rpc_verify_receipt',
            verifiedAt: new Date().toISOString()
          }
        });
      }
    }

    // 2. Appel RPC verify_contract
    const contractRes = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_contract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ p_token: queryToken })
    });

    if (contractRes.ok) {
      const data = await contractRes.json();
      if (data && data.isFound) {
        return res.status(200).json({
          success: true,
          isFound: true,
          status: data.status,
          statusLabel: data.status === 'valide' ? 'CONTRAT DE BAIL AUTHENTIQUE ET SCELLÉ' : 'CONTRAT EN ATTENTE DE SIGNATURE',
          statusDescription: data.status === 'valide'
            ? 'Ce contrat de bail certifié conforme à la Loi n° 2019-576 est scellé et authentique sur LocaTrust.'
            : 'Ce contrat est en cours de formalisation contractuelle.',
          contract: data,
          contrat: data,
          diagnostics: {
            tokenSearched: queryToken,
            source: 'rpc_verify_contract',
            verifiedAt: new Date().toISOString()
          }
        });
      }
    }

    // 3. Document non trouvé
    return res.status(200).json({
      success: false,
      isFound: false,
      status: 'introuvable',
      statusLabel: 'Document introuvable',
      statusDescription: 'Ce jeton de vérification ne correspond à aucun document certifié et archivé sur le registre de LocaTrust.'
    });
  } catch (err) {
    console.error('API verify error:', err);
    return res.status(500).json({
      success: false,
      isFound: false,
      status: 'erreur_serveur',
      statusLabel: 'Erreur lors de la vérification',
      statusDescription: 'Une anomalie technique temporaire empêche la vérification du document.'
    });
  }
}
