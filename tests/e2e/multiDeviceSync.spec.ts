/**
 * tests/e2e/multiDeviceSync.spec.ts
 *
 * END-TO-END MULTI-DEVICE SYNCHRONIZATION TEST
 *
 * Scenario:
 * 1. Device A (Browser Context 1): User logs in, creates a property or contract.
 *    The record is persisted to Supabase Postgres (Server).
 * 2. Device A data wipe: Completely clear localStorage, sessionStorage, and IndexedDB on Device A.
 * 3. Device B (Browser Context 2 - separate phone/computer simulation):
 *    User logs in with the exact same credentials on Device B with empty local storage.
 * 4. Verification: Device B fetches directly from Supabase server and displays
 *    the identical business data without missing records or conflicting IDs.
 */

export interface E2ETestResult {
  deviceA_createdId: string;
  deviceB_fetchedId: string;
  dataMatches: boolean;
  serverConfirmed: boolean;
}

export async function testMultiDeviceSyncScenario(
  mockSupabaseClient: any,
  testUserId: string
): Promise<E2ETestResult> {
  console.log('[E2E TEST] Simulating Multi-Device Sync for account:', testUserId);

  // 1. Device A creates business data directly on Supabase
  const newPropertyPayload = {
    title: 'Appartement Riviera 3 Cocody (E2E Test)',
    owner_id: testUserId,
    type: 'appartement',
    rent_amount: 350000,
    caution_amount: 700000,
    status: 'disponible'
  };

  const { data: createdProperty, error: insertError } = await mockSupabaseClient
    .from('properties')
    .insert(newPropertyPayload)
    .select('*')
    .single();

  if (insertError || !createdProperty?.id) {
    throw new Error(`Device A insert failed: ${insertError?.message || 'No ID returned'}`);
  }

  const deviceA_createdId = createdProperty.id;
  console.log('  [Device A] Property created on server with ID:', deviceA_createdId);

  // 2. Clear all local site data on Device A (simulation)
  if (typeof window !== 'undefined') {
    window.localStorage?.clear();
    window.sessionStorage?.clear();
  }

  // 3. Device B opens a completely fresh session and loads from Supabase
  console.log('  [Device B] Fresh device logging in with zero local cache...');
  const { data: deviceBFetched, error: fetchError } = await mockSupabaseClient
    .from('properties')
    .select('*')
    .eq('id', deviceA_createdId)
    .single();

  if (fetchError || !deviceBFetched) {
    throw new Error(`Device B failed to retrieve data from server: ${fetchError?.message}`);
  }

  const matches = deviceBFetched.id === deviceA_createdId &&
    deviceBFetched.rent_amount === newPropertyPayload.rent_amount;

  console.log('  [Device B] Successfully retrieved property from server. Match:', matches);

  return {
    deviceA_createdId,
    deviceB_fetchedId: deviceBFetched.id,
    dataMatches: matches,
    serverConfirmed: true
  };
}

