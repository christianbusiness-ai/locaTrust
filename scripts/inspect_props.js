const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://owaxmnanqqvbjjzpouvo.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93YXhtbmFucXF2YmpqenBvdXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDk1MzAsImV4cCI6MjEwNjUyNTUzMH0.9Uvq3qcEB7upM93xiJ528e726RH_Rp8LxOOaZ9CYKj0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectPropertiesAndProfiles() {
  const { data: props, error: prErr } = await supabase.from('properties').select('*');
  console.log('Properties:', props, 'Error:', prErr);

  const { data: profs, error: pErr } = await supabase.from('profiles').select('*');
  console.log('Profiles count:', profs?.length, 'Error:', pErr);
}

inspectPropertiesAndProfiles().catch(console.error);
