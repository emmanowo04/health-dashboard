import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lulgniwfbejahkfhmazb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bGduaXdmYmVqYWhrZmhtYXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQwNjAsImV4cCI6MjA5MDIwMDA2MH0.L6IpWtDmEJ-MXOp_bMrawUyfEFwXuD5TT_fA2JGkDrc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
