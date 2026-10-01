import { createBrowserClient } from '@supabase/ssr';
import { MOCK_PROPERTIES, MOCK_CONTRACTS, MOCK_RENT_PAYMENTS, MOCK_USERS } from '@/lib/mock/data';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Graceful fallback helper when Supabase credentials are not supplied
    return {
      isMock: true,
      async getProperties() {
        return { data: MOCK_PROPERTIES, error: null };
      },
      async getContracts() {
        return { data: MOCK_CONTRACTS, error: null };
      },
      async getRentPayments() {
        return { data: MOCK_RENT_PAYMENTS, error: null };
      }
    };
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
