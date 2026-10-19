const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://owaxmnanqqvbjjzpouvo.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93YXhtbmFucXF2YmpqenBvdXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDk1MzAsImV4cCI6MjEwNjUyNTUzMH0.9Uvq3qcEB7upM93xiJ528e726RH_Rp8LxOOaZ9CYKj0';

const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testCols(t, cols) {
  const found = [];
  const missing = [];
  for (const c of cols) {
    const r = await s.from(t).select(c).limit(1);
    if (!r.error) found.push(c);
    else missing.push(c);
  }
  console.log(`[TABLE: ${t}]`);
  console.log(`  HAS (${found.length}):`, found.join(', '));
  if (missing.length > 0) console.log(`  MISSING (${missing.length}):`, missing.join(', '));
}

async function run() {
  await testCols('properties', ['id', 'owner_id', 'agency_id', 'type', 'title', 'description', 'country', 'city', 'commune', 'quartier', 'rent', 'caution', 'charges', 'surface', 'rooms', 'bedrooms', 'bathrooms', 'status', 'photos', 'videos', 'deleted_at', 'created_at']);
  await testCols('contracts', ['id', 'contract_number', 'property_id', 'owner_id', 'tenant_id', 'monthly_rent', 'caution_amount', 'charges_amount', 'duration_months', 'start_date', 'end_date', 'status', 'token', 'verification_token', 'owner_signed', 'tenant_signed', 'owner_signature', 'tenant_signature', 'pdf_url', 'created_at']);
  await testCols('rental_applications', ['id', 'property_id', 'tenant_id', 'owner_id', 'status', 'monthly_income', 'employment_type', 'message', 'cni_url', 'payslip_url', 'date_received', 'created_at']);
  await testCols('rent_payments', ['id', 'contract_id', 'tenant_id', 'owner_id', 'agency_id', 'amount', 'payment_date', 'payment_method', 'status', 'reference', 'receipt_number', 'proof_url', 'target_month', 'allocations', 'period_start', 'period_end', 'periods_covered', 'remaining_credit', 'created_at']);
  await testCols('cautions', ['id', 'contract_id', 'contract_number', 'tenant_id', 'owner_id', 'agency_id', 'amount_requested', 'amount_paid', 'status', 'receipt_number', 'token', 'payment_method', 'declared_reference', 'created_at']);
  await testCols('receipts', ['id', 'receipt_number', 'type', 'tenant_id', 'owner_id', 'agency_id', 'contract_id', 'payment_id', 'amount', 'token', 'verification_token', 'period_covered', 'status', 'pdf_url', 'created_at']);
  await testCols('notifications', ['id', 'user_id', 'target_role', 'title', 'message', 'description', 'type', 'category', 'read', 'is_read', 'data', 'payload', 'created_at']);
  await testCols('conversations', ['id', 'property_id', 'tenant_id', 'owner_id', 'last_message', 'last_message_at', 'created_at', 'updated_at']);
  await testCols('messages', ['id', 'conversation_id', 'sender_id', 'content', 'read', 'created_at']);
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
