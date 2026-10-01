import { Property, User, Contract, RentPayment, MaintenanceTicket, Conversation, NotificationItem, Receipt } from '@/types/database.types';

export const MOCK_USERS: Record<string, User> = {
  locataire: {
    id: 'usr_tenant_1',
    role: 'locataire',
    full_name: "Koffi N'Guessan",
    email: 'koffi.nguessan@locatrust.ci',
    phone: '+225 07 08 09 10 11',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    verification_status: 'verifie',
    created_at: '2025-01-15T10:00:00Z',
  },
  proprietaire: {
    id: 'usr_owner_1',
    role: 'proprietaire',
    full_name: 'Aicha Diallo',
    email: 'aicha.diallo@locatrust.ci',
    phone: '+225 05 04 03 02 01',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
    verification_status: 'verifie',
    created_at: '2024-11-20T14:30:00Z',
  },
  proprietaire_2: {
    id: 'usr_owner_2',
    role: 'proprietaire',
    full_name: 'Koffi Traoré',
    email: 'koffi.traore@locatrust.ci',
    phone: '+225 01 02 03 04 05',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    verification_status: 'verifie',
    created_at: '2024-12-05T09:15:00Z',
  },
  agence: {
    id: 'usr_agency_1',
    role: 'agence',
    full_name: 'Immobilière du Golf Abidjan',
    email: 'contact@immogolf.ci',
    phone: '+225 27 22 44 55 66',
    avatar_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=250&q=80',
    verification_status: 'verifie',
    created_at: '2024-09-01T08:00:00Z',
  },
  admin: {
    id: 'usr_admin_1',
    role: 'admin',
    full_name: 'Super Admin LocaTrust',
    email: 'admin@locatrust.ci',
    phone: '+225 27 20 00 00 00',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80',
    verification_status: 'verifie',
    created_at: '2024-01-01T00:00:00Z',
  }
};

export const MOCK_PROPERTIES: Property[] = [
  {
    id: 'prop_1',
    owner_id: 'usr_owner_1',
    type: 'appartement',
    title: 'Appartement 3 pièces moderne à Cocody Riviera',
    description: 'Bel appartement moderne avec 3 pièces, salon spacieux, cuisine équipée, 2 salles de bain in et balcon avec belle vue.',
    surface: 120,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 2,
    rent: 450000,
    caution: 900000,
    charges: 25000,
    furnished: true,
    equipments: ['Climatisation', 'Chauffe-eau', 'Cuisine équipée', 'Balcon', 'Gardiennage 24/7', 'Parking'],
    status: 'loue',
    created_at: '2026-08-13T09:30:00Z',
    owner: MOCK_USERS.proprietaire,
    location: { id: 'loc_1', country: 'Côte d\'Ivoire', city: 'Abidjan', commune: 'Cocody', quartier: 'Cocody Riviera' },
    photos: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    ],
    stats: { views: 420, favorites_count: 24, visit_requests_count: 8, rental_requests_count: 3 }
  },
  {
    id: 'prop_2',
    owner_id: 'usr_owner_2',
    type: 'maison',
    title: 'Villa duplex 5 pièces à Yamoussoukro',
    description: 'Villa duplex de standing avec 5 pièces, jardin, garage, chauffe-eau, climatisation et groupe électrogène.',
    surface: 250,
    rooms: 5,
    bedrooms: 4,
    bathrooms: 4,
    rent: 750000,
    caution: 1500000,
    charges: 50000,
    furnished: false,
    equipments: ['Piscine', 'Jardin', 'Garage 2 voitures', 'Groupe électrogène', 'Climatisation', 'Chauffe-eau solaire'],
    status: 'disponible',
    created_at: '2026-08-12T18:45:00Z',
    owner: MOCK_USERS.proprietaire_2,
    location: { id: 'loc_2', country: 'Côte d\'Ivoire', city: 'Yamoussoukro', commune: 'Yamoussoukro', quartier: 'Quartier Millionnaire' },
    photos: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=800&q=80',
    ],
    stats: { views: 310, favorites_count: 18, visit_requests_count: 5, rental_requests_count: 2 }
  },
  {
    id: 'prop_3',
    owner_id: 'usr_owner_1',
    type: 'studio',
    title: 'Studio meublé à Angré',
    description: 'Studio chic entièrement meublé et équipé à la 8e tranche.',
    surface: 45,
    rooms: 1,
    bedrooms: 1,
    bathrooms: 1,
    rent: 220000,
    caution: 440000,
    charges: 15000,
    furnished: true,
    equipments: ['Wifi haut débit', 'Smart TV', 'Climatisation'],
    status: 'disponible',
    created_at: '2026-08-10T14:00:00Z',
    owner: MOCK_USERS.proprietaire,
    location: { id: 'loc_3', country: 'Côte d\'Ivoire', city: 'Abidjan', commune: 'Cocody', quartier: 'Angré 8e tranche' },
    photos: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80'],
    stats: { views: 180, favorites_count: 15, visit_requests_count: 3, rental_requests_count: 1 }
  },
  {
    id: 'prop_4',
    owner_id: 'usr_agency_1',
    type: 'appartement',
    title: 'Appartement 2 pièces Marcory Zone 4',
    description: 'Superbe appartement 2 pièces sécurisé au coeur de Zone 4.',
    surface: 75,
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    rent: 300000,
    caution: 600000,
    charges: 20000,
    furnished: false,
    equipments: ['Ascenseur', 'Sécurité 24h'],
    status: 'disponible',
    created_at: '2026-08-09T11:20:00Z',
    owner: MOCK_USERS.agence,
    location: { id: 'loc_4', country: 'Côte d\'Ivoire', city: 'Abidjan', commune: 'Marcory', quartier: 'Marcory Zone 4' },
    photos: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=600&q=80'],
    stats: { views: 240, favorites_count: 22, visit_requests_count: 6, rental_requests_count: 4 }
  },
  {
    id: 'prop_5',
    owner_id: 'usr_owner_2',
    type: 'maison',
    title: 'Villa 4 pièces Riviera M\'Badon',
    description: 'Belle villa indépendante avec cour avant et arrière.',
    surface: 200,
    rooms: 4,
    bedrooms: 3,
    bathrooms: 3,
    rent: 650000,
    caution: 1300000,
    charges: 30000,
    furnished: false,
    equipments: ['Jardin', 'Garage'],
    status: 'disponible',
    created_at: '2026-08-08T16:10:00Z',
    owner: MOCK_USERS.proprietaire_2,
    location: { id: 'loc_5', country: 'Côte d\'Ivoire', city: 'Abidjan', commune: 'Cocody', quartier: 'Riviera M\'Badon' },
    photos: ['https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=600&q=80'],
    stats: { views: 510, favorites_count: 38, visit_requests_count: 12, rental_requests_count: 5 }
  }
];

export const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'cnt_1',
    contract_number: 'LT-2026-0042',
    property_id: 'prop_1',
    tenant_id: 'usr_tenant_1',
    owner_id: 'usr_owner_1',
    duration_months: 12,
    rent: 450000,
    caution: 900000,
    charges: 25000,
    payment_due_day: 5,
    notice_period_days: 90,
    house_rules: 'Règlement d\'immeuble strict : pas de nuisances sonores après 22h.',
    clauses: 'Clause résolutoire automatique en cas d\'impayé supérieur à 30 jours.',
    status: 'actif',
    signed_at: '2026-01-01T10:00:00Z',
    created_at: '2025-12-20T00:00:00Z',
    property: MOCK_PROPERTIES[0],
    tenant: MOCK_USERS.locataire,
    owner: MOCK_USERS.proprietaire
  }
];

export const MOCK_RENT_PAYMENTS: RentPayment[] = [
  {
    id: 'pmt_1',
    contract_id: 'cnt_1',
    tenant_id: 'usr_tenant_1',
    owner_id: 'usr_owner_1',
    target_month: '2026-08-01',
    amount: 475000,
    payment_date: '2026-08-03',
    reference: 'OM-225-88492019',
    proof_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
    status: 'confirme',
    confirmed_by: 'usr_owner_1',
    confirmed_at: '2026-08-04T11:00:00Z',
    created_at: '2026-08-03T14:20:00Z',
    contract: MOCK_CONTRACTS[0],
    tenant: MOCK_USERS.locataire
  },
  {
    id: 'pmt_2',
    contract_id: 'cnt_1',
    tenant_id: 'usr_tenant_1',
    owner_id: 'usr_owner_1',
    target_month: '2026-07-01',
    amount: 475000,
    payment_date: '2026-07-02',
    reference: 'WAVE-CI-77382109',
    proof_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
    status: 'confirme',
    confirmed_by: 'usr_owner_1',
    confirmed_at: '2026-07-03T09:15:00Z',
    created_at: '2026-07-02T16:00:00Z',
    contract: MOCK_CONTRACTS[0],
    tenant: MOCK_USERS.locataire
  }
];

export const MOCK_RECEIPTS: Receipt[] = [
  {
    id: 'rcp_1',
    rent_payment_id: 'pmt_1',
    contract_id: 'cnt_1',
    pdf_url: '/api/pdf/quittance?id=pmt_1',
    created_at: '2026-08-04T11:00:00Z'
  },
  {
    id: 'rcp_2',
    rent_payment_id: 'pmt_2',
    contract_id: 'cnt_1',
    pdf_url: '/api/pdf/quittance?id=pmt_2',
    created_at: '2026-07-03T09:15:00Z'
  }
];

export const MOCK_MAINTENANCE_TICKETS: MaintenanceTicket[] = [
  {
    id: 'tkt_1',
    property_id: 'prop_1',
    tenant_id: 'usr_tenant_1',
    description: 'Fuite d\'eau légère au niveau du robinet sous le lavabo de la salle de bain principale.',
    status: 'ouvert',
    created_at: '2026-08-11T15:30:00Z',
    property: MOCK_PROPERTIES[0],
    tenant: MOCK_USERS.locataire,
    responses: [
      {
        id: 'rsp_1',
        author: MOCK_USERS.proprietaire,
        content: 'Bonjour Koffi, bien reçu. J\'ai mandaté notre plombier M. Yao qui passera demain vers 10h.',
        created_at: '2026-08-11T17:00:00Z'
      }
    ]
  }
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_1',
    user_id: 'usr_tenant_1',
    type: 'paiement_confirme',
    payload: { title: 'Paiement confirmé !', message: 'Votre bailleur Aicha Diallo a confirmé la réception du loyer d\'Août 2026.' },
    channel: ['app', 'email'],
    read: false,
    created_at: '2026-08-04T11:00:00Z'
  },
  {
    id: 'notif_2',
    user_id: 'usr_tenant_1',
    type: 'visite_acceptee',
    payload: { title: 'Visite confirmée', message: 'Votre demande de visite pour la villa à Yamoussoukro a été acceptée.' },
    channel: ['app'],
    read: true,
    created_at: '2026-08-12T09:00:00Z'
  }
];

export const MOCK_RECENT_SEARCHES = [
  { term: 'Appartements à Cocody', count: '20 résultats' },
  { term: 'Maisons à Yamoussoukro', count: '15 résultats' },
  { term: 'Studios à Marcory', count: '12 résultats' },
];
