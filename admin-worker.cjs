// admin-worker.js
import { createClient } from '@supabase/supabase-js';

// The rest of the code remains the same...
const SUPABASE_URL = 'https://slohvgiamzfsndmsjmak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsb2h2Z2lhbXpmc25kbXNqbWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyOTEwNjgsImV4cCI6MjA4ODg2NzA2OH0.5grn5snzfj5XoaOQ1ilQQ-8DnVv_0cCrpRxNoZffdV0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function generateDailyReport() {
  console.log('--- ParcelPal Admin Worker Starting ---');
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('price, status');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  const revenue = orders?.reduce((sum, o) => sum + (o.price || 0), 0);
  console.log(`Total Revenue: ₹${revenue}`);
  console.log('--- Task Completed ---');
}

generateDailyReport();