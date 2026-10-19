const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://owaxmnanqqvbjjzpouvo.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93YXhtbmFucXF2YmpqenBvdXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDk1MzAsImV4cCI6MjEwNjUyNTUzMH0.9Uvq3qcEB7upM93xiJ528e726RH_Rp8LxOOaZ9CYKj0';

const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkRentPaymentsCols() {
  const candidateCols = [
    'notes', 'period_start', 'period_end', 'periods_covered', 'allocations', 'remaining_credit'
  ];

  for (const c of candidateCols) {
    const res = await s.from('rent_payments').select(c).limit(1);
    if (res.error) console.log('rent_payments: missing', c, res.error.message);
    else console.log('rent_payments: HAS', c);
  }
}

checkRentPaymentsCols().catch(console.error);
