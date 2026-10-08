import { Property, User, Contract, RentPayment, MaintenanceTicket, Conversation, NotificationItem, Receipt } from '@/types/database.types';

// Deprecated: All mock data has been purged in favor of real Supabase queries.
// Exporting empty collections to ensure zero runtime fake data.
export const MOCK_USERS: Record<string, User> = {};
export const MOCK_PROPERTIES: Property[] = [];
export const MOCK_APPLICATIONS: any[] = [];
export const MOCK_CONTRACTS: Contract[] = [];
export const MOCK_PAYMENTS: RentPayment[] = [];
export const MOCK_MAINTENANCE_TICKETS: MaintenanceTicket[] = [];
export const MOCK_CONVERSATIONS: Conversation[] = [];
export const MOCK_NOTIFICATIONS: NotificationItem[] = [];
export const MOCK_RECEIPTS: Receipt[] = [];
