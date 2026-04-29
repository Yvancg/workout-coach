const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
let supabaseClientPromise = null;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabase() {
  if (!supabaseConfigured) return Promise.resolve(null);
  if (!supabaseClientPromise) {
    supabaseClientPromise = import("@supabase/supabase-js").then(({ createClient }) => createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }));
  }

  return supabaseClientPromise;
}
