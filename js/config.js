// config.js
// Configuración de Supabase

export const SUPABASE_URL = 'https://rurrvcekirilqgqwezmc.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cnJ2Y2VraXJpbHFncXdlem1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3OTUyMTUsImV4cCI6MjA4NzM3MTIxNX0.8dF03A4GDKNi-EwPCGK5iRxcVbPpGlMeKp_GuK2Ks9E';

let supabaseClient = null;

export const getSupabase = () => {
    if (!supabaseClient && window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
};
