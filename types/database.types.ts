export type UserRole = 'locataire' | 'proprietaire' | 'agence' | 'admin';
export type VerificationStatus = 'non_verifie' | 'en_attente' | 'verifie';
export type PropertyType =
  | 'maison'
  | 'appartement'
  | 'studio'
  | 'chambre-salon'
  | 'entree-coucher'
  | 'villa'
  | 'duplex'
  | 'bureau'
  | 'magasin'
  | 'boutique'
  | 'terrain'
  | 'entrepot'
  | 'parking'
  | 'autre';
export type PropertyStatus = 'disponible' | 'reserve' | 'loue' | 'fin_contrat' | 'desactive';
export type ContractStatus = 'actif' | 'termine' | 'resilie';
export type CautionStatus = 'partiel' | 'complet' | 'restitue' | 'retenu';
export type RentPaymentStatus = 'declare' | 'confirme' | 'refuse';
export type DisputeStatus = 'ouvert' | 'resolu_locataire' | 'resolu_proprietaire';
export type SubscriptionTier = '1_bien' | '2_10_biens' | '11_20_biens' | '20plus_biens';

export interface User {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  verification_status: VerificationStatus;
  created_at: string;
}

export interface VerificationDocument {
  id: string;
  user_id: string;
  doc_type: 'cni' | 'rccm';
  file_url: string;
  status: 'en_attente' | 'verifie' | 'refuse';
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface Agency {
  id: string;
  owner_user_id: string;
  name: string;
  created_at: string;
}

export interface AgencyMember {
  id: string;
  agency_id: string;
  user_id: string;
  agency_role: 'gestionnaire' | 'comptable' | 'lecture_seule';
  invited_at: string;
  accepted_at?: string;
  user?: User;
}

export interface Location {
  id: string;
  country: string;
  city: string;
  commune?: string;
  quartier?: string;
}

export interface Property {
  id: string;
  owner_id: string;
  agency_id?: string;
  location_id?: string;
  type: PropertyType;
  title: string;
  description: string;
  gps_lat?: number;
  gps_lng?: number;
  surface: number;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  caution: number;
  charges: number;
  furnished: boolean;
  equipments: string[];
  status: PropertyStatus;
  admin_validation_status?: 'en_attente' | 'validee' | 'refusee';
  admin_refusal_reason?: string;
  deleted_at?: string;
  created_at: string;

  // Joined fields
  owner?: User;
  location?: Location;
  photos?: string[];
  stats?: {
    views: number;
    favorites_count: number;
    visit_requests_count: number;
    rental_requests_count: number;
  };
}

export interface Contract {
  id: string;
  contract_number: string;
  property_id: string;
  tenant_id: string;
  owner_id: string;
  duration_months: number;
  rent: number;
  caution: number;
  charges: number;
  payment_due_day: number;
  notice_period_days: number;
  house_rules?: string;
  clauses?: string;
  pdf_url?: string;
  qr_code?: string;
  status: ContractStatus;
  signed_at: string;
  created_at: string;

  property?: Property;
  tenant?: User;
  owner?: User;
}

export interface RentPayment {
  id: string;
  contract_id: string;
  tenant_id: string;
  owner_id: string;
  target_month: string;
  amount: number;
  payment_date: string;
  reference: string;
  proof_url?: string;
  status: RentPaymentStatus;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;

  contract?: Contract;
  tenant?: User;
}

export interface Receipt {
  id: string;
  rent_payment_id: string;
  contract_id: string;
  pdf_url: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  owner_id?: string;
  agency_id?: string;
  tier: SubscriptionTier;
  price: number;
  properties_count_snapshot: number;
  status: 'actif' | 'impaye' | 'resilie';
  gateway: 'stripe' | 'cinetpay';
  external_subscription_id?: string;
  current_period_end: string;
  created_at: string;
}

export interface MaintenanceTicket {
  id: string;
  property_id: string;
  tenant_id: string;
  description: string;
  status: 'ouvert' | 'resolu';
  created_at: string;
  property?: Property;
  tenant?: User;
  responses?: { id: string; author: User; content: string; created_at: string }[];
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachment_url?: string;
  created_at: string;
  sender?: User;
}

export interface Conversation {
  id: string;
  property_id: string;
  participant_a: string;
  participant_b: string;
  created_at: string;
  property?: Property;
  other_participant?: User;
  last_message?: Message;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  payload: any;
  channel: string[];
  read: boolean;
  created_at: string;
}

export type DepositPaymentStatus = 'caution_a_confirmer' | 'paye_complet' | 'paye_partiel' | 'refuse' | 'non_paye';
export type DepositRestitutionStatus = 'conserve' | 'restitue_total' | 'restitue_partiel' | 'impute_loyers';

export interface Deposit {
  id: string;
  contract_id: string;
  tenant_id: string;
  owner_id: string;
  amount_requested: number;
  amount_paid: number;
  status: DepositPaymentStatus;
  restitution_status: DepositRestitutionStatus;
  declared_at?: string;
  declared_reference?: string;
  proof_url?: string;
  comment?: string;
  refusal_reason?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  restituted_at?: string;
  amount_restituted?: number;
  deduction_amount?: number;
  deduction_reason?: string;
  months_covered?: string;
  receipt_sent_to_tenant?: boolean;
  restitution_receipt_sent_to_tenant?: boolean;
  owner_signature?: string;
  owner_signed_at?: string;
  tenant_signature?: string;
  tenant_signed_at?: string;
  restitution_owner_signature?: string;
  restitution_owner_signed_at?: string;
  restitution_tenant_signature?: string;
  restitution_tenant_signed_at?: string;
  is_disputed?: boolean;
  created_at: string;
  tenant?: User;
  property?: Property;
  contract?: Contract;
}

