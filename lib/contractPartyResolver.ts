import { supabase } from '@/src/lib/supabase';
import { getCertifiedSignatureDataUrl } from '@/lib/signatureHelper';
import { UserProfile } from '@/src/context/AuthContext';

export interface ContractPartyResolutionInput {
  contract?: any;
  app?: any;
  matchedProperty?: any;
  currentProfile?: UserProfile | null;
  currentUser?: any;
  ownerId?: string;
  tenantId?: string;
  ownerFallback?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    cni?: string;
    signatureUrl?: string | null;
  };
  tenantFallback?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    cni?: string;
    signatureUrl?: string | null;
  };
}

export interface ResolvedContractParties {
  ownerName: string;
  ownerPhone: string;
  ownerCni: string;
  ownerAddress: string;
  ownerEmail: string;
  ownerSignatureUrl: string;

  tenantName: string;
  tenantPhone: string;
  tenantCni: string;
  tenantAddress: string;
  tenantEmail: string;
  tenantSignatureUrl: string;

  owner: {
    name: string;
    phone: string;
    email: string;
    address: string;
    cni: string;
    signatureUrl: string;
  };
  tenant: {
    name: string;
    phone: string;
    email: string;
    address: string;
    cni: string;
    signatureUrl: string;
  };

  isAgency: boolean;
  mandantName?: string;
}

const ABIDJAN_COMMUNES = [
  'cocody',
  'plateau',
  'marcory',
  'treichville',
  'koumassi',
  'port-bouët',
  'port-bouet',
  'yopougon',
  'abobo',
  'adjamé',
  'adjame',
  'attécoubé',
  'attecoube',
  'bingerville',
  'songon',
  'anyama'
];

export function formatPartyLocalityAddress(
  rawAddress?: string | null,
  commune?: string | null,
  city?: string | null
): string | null {
  const cleanAddr = (rawAddress || '').trim();
  if (cleanAddr) {
    const parts = cleanAddr.split(',').map((p) => p.trim()).filter(Boolean);
    if (
      parts.length === 2 &&
      parts[1].toLowerCase() === 'abidjan' &&
      !ABIDJAN_COMMUNES.includes(parts[0].toLowerCase())
    ) {
      return parts[0];
    }
    if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
      return parts[0];
    }
    return cleanAddr;
  }

  const cleanCommune = (commune || '').trim();
  const cleanCity = (city || '').trim();

  if (cleanCommune && cleanCity) {
    if (cleanCommune.toLowerCase() === cleanCity.toLowerCase()) return cleanCommune;
    if (cleanCity.toLowerCase() === 'abidjan' && !ABIDJAN_COMMUNES.includes(cleanCommune.toLowerCase())) {
      return cleanCommune;
    }
    return `${cleanCommune}, ${cleanCity}`;
  }

  if (cleanCommune) return cleanCommune;
  if (cleanCity) return cleanCity;
  return null;
}

function clearGlobalSignatureStorage(userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('locatrust_owner_signature');
    localStorage.removeItem('locatrust_tenant_signature');
    localStorage.removeItem('locatrust_user_signature');
    localStorage.removeItem('locatrust_signature_url');
    if (userId) {
      localStorage.removeItem(`locatrust_saved_signature_${userId}`);
    }
  } catch {}
}

/**
 * Les signatures ne sont JAMAIS stockées globalement pour être réutilisées automatiquement
 * sur un autre contrat ou un autre reçu. Chaque document requiert sa propre signature.
 */
export function persistOwnerSignature(_signatureUrl: string, ownerId?: string): void {
  clearGlobalSignatureStorage(ownerId);
}

export function persistTenantSignature(_signatureUrl: string, tenantId?: string): void {
  clearGlobalSignatureStorage(tenantId);
}

export function getStoredOwnerSignature(ownerId?: string): string | null {
  clearGlobalSignatureStorage(ownerId);
  return null;
}

export function getStoredTenantSignature(tenantId?: string): string | null {
  clearGlobalSignatureStorage(tenantId);
  return null;
}

/**
 * Resolves complete, authentic party data for any contract download or preview.
 * Queries Supabase `profiles` when needed to extract the real CNI, Phone, and Address.
 */
export async function resolveContractParties(
  input: ContractPartyResolutionInput
): Promise<ResolvedContractParties> {
  const { contract, app, matchedProperty, currentProfile, currentUser, ownerFallback, tenantFallback } = input;

  // Determine owner & tenant IDs
  const rawOwnerId =
    input.ownerId ||
    contract?.owner_id ||
    contract?.owner?.id ||
    app?.owner_id ||
    matchedProperty?.owner_id ||
    (currentProfile?.account_type !== 'locataire' ? currentProfile?.id : undefined) ||
    currentUser?.id;

  const rawTenantId =
    input.tenantId ||
    contract?.tenant_id ||
    contract?.tenant?.id ||
    app?.tenant_id ||
    (currentProfile?.account_type === 'locataire' ? currentProfile?.id : undefined);

  // Cache or fetch profiles from Supabase if UUIDs are valid
  const isValidUuid = (str?: string) =>
    Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

  let dbOwnerProfile: any = null;
  let dbTenantProfile: any = null;

  try {
    const idsToFetch: string[] = [];
    if (isValidUuid(rawOwnerId)) idsToFetch.push(rawOwnerId);
    if (isValidUuid(rawTenantId) && rawTenantId !== rawOwnerId) idsToFetch.push(rawTenantId);

    if (idsToFetch.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', idsToFetch);

      if (profilesData && profilesData.length > 0) {
        dbOwnerProfile = profilesData.find((p) => p.id === rawOwnerId) || null;
        dbTenantProfile = profilesData.find((p) => p.id === rawTenantId) || null;
      }
    }
  } catch (e) {
    console.warn('Notice: Could not fetch profiles from Supabase in resolver:', e);
  }

  // --- RESOLVE OWNER DATA ---
  const isOwnerCurrent = currentProfile && currentProfile.account_type !== 'locataire';
  const isAgency =
    currentProfile?.account_type === 'agence' ||
    (currentProfile?.role as string) === 'agence' ||
    dbOwnerProfile?.account_type === 'agence' ||
    contract?.is_agency ||
    contract?.isAgency ||
    Boolean(matchedProperty?.mandant_name);

  const mandantName =
    contract?.mandant_name ||
    contract?.mandantName ||
    matchedProperty?.mandant_name ||
    undefined;

  const ownerName =
    ownerFallback?.name ||
    (isOwnerCurrent ? currentProfile?.full_name : null) ||
    dbOwnerProfile?.full_name ||
    contract?.owner?.full_name ||
    contract?.ownerName ||
    app?.owner_name ||
    (isOwnerCurrent ? currentUser?.user_metadata?.full_name : null) ||
    'Bailleur';

  const ownerPhone =
    ownerFallback?.phone ||
    (isOwnerCurrent ? currentProfile?.phone : null) ||
    dbOwnerProfile?.phone ||
    contract?.owner?.phone ||
    contract?.ownerPhone ||
    app?.owner_phone ||
    (isOwnerCurrent ? currentUser?.phone || currentUser?.user_metadata?.phone : null) ||
    (typeof window !== 'undefined' && isOwnerCurrent ? localStorage.getItem('locatrust_user_phone') : null) ||
    '+225 07 00 00 00 00';

  const ownerCni =
    ownerFallback?.cni ||
    (isOwnerCurrent ? currentProfile?.cni_number : null) ||
    dbOwnerProfile?.cni_number ||
    contract?.owner?.cni_number ||
    contract?.ownerCni ||
    contract?.owner?.rccm_number ||
    app?.owner_cni ||
    (isOwnerCurrent ? currentUser?.user_metadata?.cni_number : null) ||
    (typeof window !== 'undefined' && isOwnerCurrent ? localStorage.getItem('locatrust_user_cni') : null) ||
    'CI-002891048-A';

  const ownerAddress =
    formatPartyLocalityAddress(
      ownerFallback?.address ||
        (isOwnerCurrent && (currentProfile as any)?.address ? (currentProfile as any).address : null) ||
        dbOwnerProfile?.address ||
        contract?.owner?.address ||
        contract?.ownerAddress ||
        app?.owner_address,
      (isOwnerCurrent ? currentProfile?.commune : null) || dbOwnerProfile?.commune,
      (isOwnerCurrent ? currentProfile?.city : null) || dbOwnerProfile?.city
    ) || 'Côte d\'Ivoire';

  const ownerEmail =
    ownerFallback?.email ||
    (isOwnerCurrent ? (currentProfile as any)?.email || currentUser?.email : null) ||
    dbOwnerProfile?.email ||
    contract?.owner?.email ||
    app?.owner_email ||
    'contact@locatrust.ci';

  // Signature du propriétaire strictement liée à CE contrat précis (aucune réutilisation automatique)
  const resolvedOwnerSig =
    ownerFallback?.signatureUrl ||
    contract?.owner_signature_url ||
    contract?.owner_signature ||
    contract?.ownerSignatureUrl ||
    app?.owner_signature_url ||
    app?.owner_signature ||
    '';

  // --- RESOLVE TENANT DATA ---
  const isTenantCurrent = currentProfile && currentProfile.account_type === 'locataire';

  const tenantName =
    tenantFallback?.name ||
    (isTenantCurrent ? currentProfile?.full_name : null) ||
    dbTenantProfile?.full_name ||
    app?.tenant_name ||
    contract?.tenant?.full_name ||
    contract?.tenantName ||
    (isTenantCurrent ? currentUser?.user_metadata?.full_name : null) ||
    'Locataire';

  const tenantPhone =
    tenantFallback?.phone ||
    (isTenantCurrent ? currentProfile?.phone : null) ||
    dbTenantProfile?.phone ||
    app?.tenant_phone ||
    contract?.tenant?.phone ||
    contract?.tenantPhone ||
    (isTenantCurrent ? currentUser?.phone || currentUser?.user_metadata?.phone : null) ||
    (typeof window !== 'undefined' && isTenantCurrent ? localStorage.getItem('locatrust_user_phone') : null) ||
    '+225 05 00 00 00 00';

  const tenantCni =
    tenantFallback?.cni ||
    (isTenantCurrent ? currentProfile?.cni_number : null) ||
    dbTenantProfile?.cni_number ||
    app?.tenant_cni ||
    contract?.tenant?.cni_number ||
    contract?.tenantCni ||
    (isTenantCurrent ? currentUser?.user_metadata?.cni_number : null) ||
    (typeof window !== 'undefined' && isTenantCurrent ? localStorage.getItem('locatrust_user_cni') : null) ||
    'CI-001948271-B';

  const tenantAddress =
    formatPartyLocalityAddress(
      tenantFallback?.address ||
        (isTenantCurrent && (currentProfile as any)?.address ? (currentProfile as any).address : null) ||
        dbTenantProfile?.address ||
        contract?.tenant?.address ||
        contract?.tenantAddress ||
        app?.tenant_address,
      (isTenantCurrent ? currentProfile?.commune : null) || dbTenantProfile?.commune,
      (isTenantCurrent ? currentProfile?.city : null) || dbTenantProfile?.city
    ) || 'Côte d\'Ivoire';

  const tenantEmail =
    tenantFallback?.email ||
    (isTenantCurrent ? (currentProfile as any)?.email || currentUser?.email : null) ||
    dbTenantProfile?.email ||
    app?.tenant_email ||
    contract?.tenant?.email ||
    'locataire@locatrust.ci';

  // Signature du locataire strictement liée à CE contrat précis (aucune réutilisation automatique)
  const resolvedTenantSig =
    tenantFallback?.signatureUrl ||
    contract?.tenant_signature_url ||
    contract?.tenant_signature ||
    contract?.tenantSignatureUrl ||
    app?.tenant_signature_url ||
    app?.tenant_signature ||
    '';

  return {
    ownerName,
    ownerPhone,
    ownerCni,
    ownerAddress,
    ownerEmail,
    ownerSignatureUrl: resolvedOwnerSig,

    tenantName,
    tenantPhone,
    tenantCni,
    tenantAddress,
    tenantEmail,
    tenantSignatureUrl: resolvedTenantSig,

    owner: {
      name: ownerName,
      phone: ownerPhone,
      email: ownerEmail,
      address: ownerAddress,
      cni: ownerCni,
      signatureUrl: resolvedOwnerSig,
    },
    tenant: {
      name: tenantName,
      phone: tenantPhone,
      email: tenantEmail,
      address: tenantAddress,
      cni: tenantCni,
      signatureUrl: resolvedTenantSig,
    },

    isAgency,
    mandantName
  };
}
