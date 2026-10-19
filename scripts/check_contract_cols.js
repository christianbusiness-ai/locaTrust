const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://owaxmnanqqvbjjzpouvo.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93YXhtbmFucXF2YmpqenBvdXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDk1MzAsImV4cCI6MjEwNjUyNTUzMH0.9Uvq3qcEB7upM93xiJ528e726RH_Rp8LxOOaZ9CYKj0';

const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkContractsCols() {
  const candidateCols = [
    'id', 'contract_number', 'property_id', 'owner_id', 'tenant_id',
    'monthly_rent', 'caution_amount', 'charges_amount', 'duration_months',
    'start_date', 'end_date', 'status', 'token', 'verification_token',
    'owner_signed', 'tenant_signed', 'owner_signature', 'tenant_signature',
    'created_at', 'pdf_url'
  ];

  for (const c of candidateCols) {
    const res = await s.from('contracts').select(c).limit(1);
    if (res.error) console.log('contracts: missing', c, res.error.message);
    else console.log('contracts: HAS', c);
  }
}

checkContractsCols().catch(console.error);
