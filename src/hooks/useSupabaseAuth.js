import { useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "../lib/supabaseClient";

export function useSupabaseAuth() {
  const [authEmail, setAuthEmail] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [authSession, setAuthSession] = useState(null);

  useEffect(() => {
    if (!supabaseConfigured) return undefined;

    let mounted = true;
    let subscription = null;

    getSupabase().then((supabase) => {
      if (!mounted || !supabase) return;

      supabase.auth.getSession().then(({ data }) => {
        if (mounted) setAuthSession(data.session || null);
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuthSession(session || null);
        setAuthStatus("");
      });
      subscription = listener.subscription;
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signInWithMagicLink = async () => {
    const supabase = await getSupabase();
    if (!supabase || !authEmail.trim()) {
      setAuthStatus("Enter your email to receive a magic link.");
      return;
    }

    const email = authEmail.trim();
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    setAuthStatus(error ? error.message : `Magic link sent to ${email}.`);
  };

  const signInWithGoogle = async () => {
    const supabase = await getSupabase();
    if (!supabase) {
      setAuthStatus("Supabase auth is not configured.");
      return;
    }

    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) setAuthStatus(error.message);
  };

  const signOut = async () => {
    const supabase = await getSupabase();
    if (!supabase) return false;

    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthStatus(error.message);
      return false;
    }

    setAuthStatus("Signed out.");
    return true;
  };

  return {
    authConfigured: supabaseConfigured,
    authEmail,
    authSession,
    authStatus,
    setAuthEmail,
    signInWithGoogle,
    signInWithMagicLink,
    signOut,
  };
}
