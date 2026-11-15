import { createClient } from '@supabase/supabase-js';

// Configuration officielle du projet Supabase LocaTrust (owaxmnanqqvbjjzpouvo)
// Les valeurs par défaut garantissent un démarrage 100% résilient même si une variable Vercel n'a pas été saisie
const DEFAULT_SUPABASE_URL = 'https://owaxmnanqqvbjjzpouvo.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93YXhtbmFucXF2YmpqenBvdXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDk1MzAsImV4cCI6MjEwNjUyNTUzMH0.9Uvq3qcEB7upM93xiJ528e726RH_Rp8LxOOaZ9CYKj0';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {}) as any;
const supabaseUrl = env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey =
  env?.VITE_SUPABASE_ANON_KEY ||
  env?.VITE_SUPABASE_ANON ||
  DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: async (url, options = {}) => {
      // Timeout de protection 10s contre les erreurs 522 (Cloudflare connection timed out) de Supabase
      const controller = new AbortController();
      const timer = setTimeout(() => {
        try { controller.abort(); } catch {}
      }, 10000);
      const signal = options?.signal || controller.signal;
      try {
        const res = await fetch(url, { ...options, signal });
        // Si Supabase renvoie une page d'erreur Cloudflare 520/522/524 HTML, la convertir en JSON valide
        if (res.status === 522 || res.status === 520 || res.status === 524) {
          return new Response(
            JSON.stringify({
              message: 'Supabase project paused or unreachable (Cloudflare Error 522)',
              error: 'Connection timed out',
              code: '522'
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
        return res;
      } finally {
        clearTimeout(timer);
      }
    }
  }
});

export default supabase;

