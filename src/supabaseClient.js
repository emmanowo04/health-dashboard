import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qolirpmnucvcfkhuwshj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbGlycG1udWN2Y2ZraHV3c2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NzA4ODcsImV4cCI6MjEwNDM0Njg4N30.IAWsoKZAHRu2JkuDz2OdHcHkIF3dsWiAOb_84ggQ3Es';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
