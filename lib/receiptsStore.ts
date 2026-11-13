/**
 * Registre Unifié des Quittances et Reçus LocaTrust (lib/receiptsStore.ts)
 * 
 * Source unique de vérité pour toutes les quittances de loyer et reçus de caution.
 * Résout définitivement la dualité historique entre 'locatrust_receipts' et 'locatrust_tenant_receipts_v2'.
 * Garantit la synchronisation bidirectionnelle instantanée entre Propriétaire, Agence et Locataire.
 */

export const PRIMARY_RECEIPTS_STORAGE_KEY = 'locatrust_receipts';
export const LEGACY_RECEIPTS_STORAGE_KEY = 'locatrust_tenant_receipts_v2';

export interface UnifiedReceiptRecord {
  id: string;
  receipt_number: string;
  receiptNumber?: string;
  type: 'loyer' | 'caution' | 'solde';
  contract_id?: string;
  contract_number?: string;
  contractNumber?: string;
  tenant_id?: string;
  owner_id?: string;
  agency_id?: string;
  amount: number;
  period_covered?: string;
  target_month?: string;
  payment_date?: string;
  payment_method?: string;
  created_at?: string;
  owner_signature_url?: string | null;
  tenant_signature_url?: string | null;
  ownerSignatureUrl?: string | null;
  tenantSignatureUrl?: string | null;
  status?: string;
  token?: string;
  pdf_url?: string;
  [key: string]: any;
}

/**
 * Normalise un enregistrement de reçu pour assurer l'accès transparent aux propriétés
 */
function normalizeReceipt(r: any): UnifiedReceiptRecord {
  const num = r.receipt_number || r.receiptNumber || r.reference || r.id || '';
  const ownerSig = r.owner_signature_url || r.ownerSignatureUrl || null;
  const tenantSig = r.tenant_signature_url || r.tenantSignatureUrl || null;
  const contractNum = r.contract_number || r.contractNumber || r.contract_id || '';

  // Statut le plus avancé
  let status = r.status || 'confirme';
  if (ownerSig && tenantSig) {
    status = 'confirme';
  }

  return {
    ...r,
    id: r.id || r.receipt_id || num,
    receipt_number: num,
    receiptNumber: num,
    type: r.type || (num.startsWith('REC-CAUTION') || r.depositId ? 'caution' : 'loyer'),
    contract_id: r.contract_id || contractNum,
    contract_number: contractNum,
    contractNumber: contractNum,
    amount: Number(r.amount || r.amount_paid || 0),
    period_covered: r.period_covered || r.target_month || r.targetPeriodFormatted || '',
    target_month: r.target_month || r.period_covered || '',
    owner_signature_url: ownerSig,
    ownerSignatureUrl: ownerSig,
    tenant_signature_url: tenantSig,
    tenantSignatureUrl: tenantSig,
    status
  };
}

/**
 * Récupère l'ensemble des reçus unifiés depuis le localStorage en fusionnant
 * automatiquement 'locatrust_receipts' et 'locatrust_tenant_receipts_v2' sans perte ni doublon.
 */
export function getUnifiedReceipts(userId?: string): UnifiedReceiptRecord[] {
  if (typeof window === 'undefined') return [];

  const mergedMap = new Map<string, UnifiedReceiptRecord>();

  const deletedKeys = new Set<string>([
    'esp-364218',
    'pmt_dec_nov2026_01',
    'pmt_esp_135945',
    'rec-caution-000492',
    'wav-2026-nov-781920',
    'esp-135945',
    'cau_lt_000492',
    'rec_cau_000492',
    'rec_wav_781920',
    'rec_esp_135945'
  ]);
  try {
    const rawDel = localStorage.getItem('locatrust_deleted_payments');
    if (rawDel) {
      const arr = JSON.parse(rawDel);
      if (Array.isArray(arr)) arr.forEach((k: string) => deletedKeys.add(String(k).trim().toLowerCase()));
    }
  } catch {}

  const processList = (raw: string | null) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          if (!item) return;
          const norm = normalizeReceipt(item);
          const key = (norm.receipt_number || norm.id).trim().toLowerCase();
          if (!key || deletedKeys.has(key)) return;
          if (norm.receipt_number && deletedKeys.has(norm.receipt_number.trim().toLowerCase())) return;
          if (norm.id && deletedKeys.has(norm.id.trim().toLowerCase())) return;
          const numAmt = Number(String(norm.amount || 0).replace(/[\s\u00A0,]/g, ''));
          if (numAmt <= 0 || numAmt > 200000 || isNaN(numAmt)) return; // Bloquer les montants tests anormaux (ex: 10M, 11.4M)

          const existing = mergedMap.get(key);
          if (!existing) {
            mergedMap.set(key, norm);
          } else {
            // Fusion intelligente préservant les signatures et le statut le plus avancé
            const ownerSig = existing.owner_signature_url || norm.owner_signature_url;
            const tenantSig = existing.tenant_signature_url || norm.tenant_signature_url;
            const isConfirmed =
              existing.status === 'confirme' ||
              norm.status === 'confirme' ||
              Boolean(ownerSig && tenantSig);

            mergedMap.set(key, {
              ...existing,
              ...norm,
              owner_signature_url: ownerSig,
              ownerSignatureUrl: ownerSig,
              tenant_signature_url: tenantSig,
              tenantSignatureUrl: tenantSig,
              status: isConfirmed ? 'confirme' : (existing.status || norm.status)
            });
          }
        });
      }
    } catch { }
  };

  // Lire les deux sources
  processList(localStorage.getItem(PRIMARY_RECEIPTS_STORAGE_KEY));
  processList(localStorage.getItem(LEGACY_RECEIPTS_STORAGE_KEY));

  const allReceipts = Array.from(mergedMap.values());

  // Règle d'or : miroir automatique pour que les deux clés soient toujours 100% synchrones
  try {
    const serialized = JSON.stringify(allReceipts);
    if (localStorage.getItem(PRIMARY_RECEIPTS_STORAGE_KEY) !== serialized) {
      localStorage.setItem(PRIMARY_RECEIPTS_STORAGE_KEY, serialized);
    }
    if (localStorage.getItem(LEGACY_RECEIPTS_STORAGE_KEY) !== serialized) {
      localStorage.setItem(LEGACY_RECEIPTS_STORAGE_KEY, serialized);
    }
  } catch { }

  if (!userId) return allReceipts;

  return allReceipts.filter((r) => {
    return (
      r.owner_id === userId ||
      r.agency_id === userId ||
      r.tenant_id === userId ||
      r.user_id === userId
    );
  });
}

/**
 * Enregistre une liste de reçus dans le registre unifié et synchronise immédiatement
 * les deux clés de stockage 'locatrust_receipts' et 'locatrust_tenant_receipts_v2'.
 */
export function saveUnifiedReceipts(receipts: any[]): void {
  if (typeof window === 'undefined') return;

  const normalizedList = (receipts || []).map(normalizeReceipt);
  const serialized = JSON.stringify(normalizedList);

  try {
    localStorage.setItem(PRIMARY_RECEIPTS_STORAGE_KEY, serialized);
    localStorage.setItem(LEGACY_RECEIPTS_STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent('locatrust:receipts_updated', { detail: { receipts: normalizedList } }));
  } catch (err) {
    console.warn('Erreur sauvegarde reçus unifiés:', err);
  }
}

/**
 * Insère ou met à jour une quittance ou un reçu dans le registre unifié
 */
export function upsertUnifiedReceipt(receipt: any): UnifiedReceiptRecord {
  const norm = normalizeReceipt(receipt);
  const current = getUnifiedReceipts();
  const key = (norm.receipt_number || norm.id).trim().toLowerCase();

  const idx = current.findIndex(
    (r) => (r.receipt_number || r.id).trim().toLowerCase() === key
  );

  let updatedList: UnifiedReceiptRecord[];
  if (idx === -1) {
    updatedList = [norm, ...current];
  } else {
    const existing = current[idx];
    const ownerSig = norm.owner_signature_url || existing.owner_signature_url;
    const tenantSig = norm.tenant_signature_url || existing.tenant_signature_url;
    const isConfirmed =
      existing.status === 'confirme' ||
      norm.status === 'confirme' ||
      Boolean(ownerSig && tenantSig);

    const merged: UnifiedReceiptRecord = {
      ...existing,
      ...norm,
      owner_signature_url: ownerSig,
      ownerSignatureUrl: ownerSig,
      tenant_signature_url: tenantSig,
      tenantSignatureUrl: tenantSig,
      status: isConfirmed ? 'confirme' : (norm.status || existing.status)
    };
    updatedList = [...current];
    updatedList[idx] = merged;
  }

  saveUnifiedReceipts(updatedList);
  return norm;
}

/**
 * Recherche si une quittance ou un reçu existe déjà pour un paiement donné
 */
export function findReceiptForPayment(receipts: UnifiedReceiptRecord[], payment: any): UnifiedReceiptRecord | null {
  if (!payment) return null;
  const pRef = String(payment.reference || payment.receipt_number || payment.id || '').trim().toLowerCase();
  const pContractId = String(payment.contract_id || payment.contract?.id || payment.contract_number || '').trim().toLowerCase();
  const pPeriod = String(payment.target_month || payment.period_covered || '').trim().toLowerCase();

  for (const r of receipts) {
    const rNum = String(r.receipt_number || r.receiptNumber || r.id || '').trim().toLowerCase();
    const rRef = String(r.reference || '').trim().toLowerCase();
    const rPayId = String(r.payment_id || '').trim().toLowerCase();

    // Correspondance directe par numéro ou référence
    if (pRef && (rNum === pRef || rRef === pRef || rPayId === pRef)) return r;

    // Correspondance par contrat + période
    if (pContractId && pPeriod) {
      const rContract = String(r.contract_id || r.contract_number || '').trim().toLowerCase();
      const rPeriod = String(r.period_covered || r.target_month || '').trim().toLowerCase();
      if (rContract && rContract === pContractId && rPeriod && rPeriod === pPeriod) {
        return r;
      }
    }
  }

  return null;
}

