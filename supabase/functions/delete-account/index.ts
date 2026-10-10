import { createClient } from "jsr:@supabase/supabase-js@2.117.3";

const exactAllowedOrigins = new Set([
  "https://workout-coach.pages.dev",
  "https://localhost",
  "capacitor://localhost",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function isAllowedOrigin(origin: string) {
  if (!origin) return true;
  if (exactAllowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.port
    ) return false;

    const suffix = ".workout-coach.pages.dev";
    const hostname = url.hostname.toLowerCase();
    if (!hostname.endsWith(suffix)) return false;

    const previewLabel = hostname.slice(0, -suffix.length);
    return Boolean(previewLabel) && !previewLabel.includes(".");
  } catch {
    return false;
  }
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Vary": "Origin",
  };

  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  if (origin && !isAllowedOrigin(origin)) {
    return json(req, { error: "Origin not allowed" }, 403);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req),
    });
  }

  if (!["POST", "DELETE"].includes(req.method)) {
    return json(req, { error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json(req, { error: "Login required" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(req, { error: "Account deletion is not configured" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) {
    return json(req, { error: "Invalid or expired login" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    console.error("Could not delete Supabase account", deleteError);
    return json(req, { error: "Could not delete account" }, 500);
  }

  return json(req, { ok: true, deleted: "auth_account" });
});
