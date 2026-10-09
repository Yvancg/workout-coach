import { createRemoteJWKSet, jwtVerify } from "jose";

function getAllowedOriginRules(env) {
  const configured = env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) || [];
  return configured.length ? configured : [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://localhost",
    "capacitor://localhost",
  ];
}

export function originMatchesRule(origin, rule) {
  if (!origin || !rule) return false;
  if (origin === rule) return true;

  if (!rule.startsWith("https://*.")) return false;

  try {
    const originUrl = new URL(origin);
    if (originUrl.protocol !== "https:" || originUrl.username || originUrl.password || originUrl.port) return false;

    const suffix = rule.slice("https://*".length).toLowerCase();
    const hostname = originUrl.hostname.toLowerCase();
    if (!suffix.startsWith(".") || !hostname.endsWith(suffix)) return false;

    const prefix = hostname.slice(0, -suffix.length);
    return Boolean(prefix) && !prefix.includes(".");
  } catch {
    return false;
  }
}

export function isAllowedOrigin(origin, env) {
  if (!origin) return true;
  return getAllowedOriginRules(env).some((rule) => originMatchesRule(origin, rule));
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
    Vary: "Origin",
  };

  if (origin && isAllowedOrigin(origin, env)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

function json(data, request, env, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(request, env),
      ...(init.headers || {}),
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function ensureDb(env) {
  if (!env.DB) throw new Error("Missing D1 binding. Configure DB in wrangler.toml.");
  return env.DB;
}

function getWeightTotalKg(weightGuide = "") {
  const totalMatch = weightGuide.match(/\((\d+(?:\.\d+)?)\s*kg total\)/i) || weightGuide.match(/(\d+(?:\.\d+)?)\s*kg total/i);
  if (totalMatch) return Number.parseFloat(totalMatch[1]) || 0;

  const eachHandMatch = weightGuide.match(/(\d+(?:\.\d+)?)\s*kg each hand/i);
  if (eachHandMatch) return (Number.parseFloat(eachHandMatch[1]) || 0) * 2;

  const oneHandMatch = weightGuide.match(/(\d+(?:\.\d+)?)\s*kg in one hand/i);
  if (oneHandMatch) return Number.parseFloat(oneHandMatch[1]) || 0;

  const singleKgMatch = weightGuide.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (singleKgMatch && !/bodyweight/i.test(weightGuide)) return Number.parseFloat(singleKgMatch[1]) || 0;

  return 0;
}

function assertAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (!isAllowedOrigin(origin, env)) {
    throw createHttpError(403, "Origin not allowed");
  }
}

function getSupabaseUrl(env) {
  return env.SUPABASE_URL?.trim() || "";
}

function getSupabaseIssuer(env) {
  const supabaseUrl = getSupabaseUrl(env);
  return supabaseUrl ? `${supabaseUrl}/auth/v1` : "";
}

function getSupabaseJwksUrl(env) {
  const issuer = getSupabaseIssuer(env);
  return issuer ? `${issuer}/.well-known/jwks.json` : "";
}

function getSupabaseKeepAliveUrl(env) {
  const supabaseUrl = getSupabaseUrl(env);
  if (!supabaseUrl || supabaseUrl.includes("your-project-ref")) return "";

  try {
    return new URL("/auth/v1/health", supabaseUrl).toString();
  } catch {
    return "";
  }
}

async function pingSupabaseKeepAlive(env) {
  const keepAliveUrl = getSupabaseKeepAliveUrl(env);
  if (!keepAliveUrl) return;

  const response = await fetch(keepAliveUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "workout-coach-keepalive",
    },
  });

  if (response.ok) return;

  const jwksUrl = getSupabaseJwksUrl(env);
  if (!jwksUrl) throw new Error(`Supabase keep-alive failed: ${response.status}`);

  const fallbackResponse = await fetch(jwksUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "workout-coach-keepalive",
    },
  });
  if (!fallbackResponse.ok) throw new Error(`Supabase keep-alive failed: ${response.status}/${fallbackResponse.status}`);
}

function getSupabaseAudience(env) {
  return env.SUPABASE_JWT_AUDIENCE?.trim() || "authenticated";
}

function createHttpError(status, message, headers = {}) {
  const error = new Error(message);
  error.status = status;
  error.headers = headers;
  return error;
}

function getClientIp(request) {
  return (request.headers.get("CF-Connecting-IP") || "").trim();
}

function getUserAgent(request) {
  return (request.headers.get("User-Agent") || "").slice(0, 255);
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

export function boundedText(value, maxLength = 255) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function nonNegativeInteger(value, max = 1_000_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(max, Math.max(0, Math.trunc(parsed)));
}

export function nonNegativeNumber(value, max = 1_000_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(max, Math.max(0, Math.round(parsed * 10) / 10));
}

export function ratingInteger(value, min = 1, max = 10, fallback = 0) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function sessionBelongsToIdentity(session, identity) {
  if (!session || !identity) return false;
  if (session.owner_id) return session.owner_id === identity.ownerId;
  return session.owner_email === identity.ownerEmail;
}

export function decodeSessionPath(pathname) {
  const prefix = "/api/sessions/";
  if (typeof pathname !== "string" || !pathname.startsWith(prefix)) return "";

  try {
    return boundedText(decodeURIComponent(pathname.slice(prefix.length)), 160);
  } catch {
    return "";
  }
}

export function getRateLimitRouteKey(pathname) {
  if (typeof pathname !== "string") return "unknown";
  if (pathname.startsWith("/api/sessions/")) return "/api/sessions/:sessionId";
  return pathname;
}

function isValidDateLabel(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimestamp(value) {
  return Boolean(value) && Number.isFinite(Date.parse(value));
}

async function logAuditEvent(request, env, event) {
  if (env.AUDIT_LOG_ENABLED === "false") return;

  try {
    const db = ensureDb(env);
    await db.prepare(`
      INSERT INTO audit_events (
        event_type, owner_email, method, path, session_id, status_code,
        client_ip, user_agent, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.eventType,
      event.ownerEmail || "",
      event.method || request.method || "",
      event.path || new URL(request.url).pathname,
      event.sessionId || "",
      event.statusCode || 0,
      getClientIp(request),
      getUserAgent(request),
      safeJsonStringify(event.details),
    ).run();
  } catch {
    // Ignore audit logging failures so the main request path stays healthy.
  }
}

async function verifySupabaseJwt(request, env) {
  const issuer = getSupabaseIssuer(env);
  const jwksUrl = getSupabaseJwksUrl(env);
  if (!issuer || !jwksUrl) {
    throw createHttpError(500, "Supabase auth is not configured");
  }

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    throw createHttpError(401, "Login required");
  }

  const jwks = createRemoteJWKSet(new URL(jwksUrl));
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: getSupabaseAudience(env),
  });

  const ownerId = typeof payload.sub === "string" ? payload.sub.trim() : "";
  const ownerEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!ownerId || !ownerEmail) {
    throw createHttpError(403, "Supabase identity is incomplete");
  }

  return { ownerId, ownerEmail };
}

async function getRequestIdentity(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (bearerToken && env.API_TOKEN && bearerToken === env.API_TOKEN) {
    const fallbackOwnerEmail = (env.ADMIN_FALLBACK_OWNER_EMAIL || "admin-token").trim().toLowerCase();
    const fallbackOwnerId = (env.ADMIN_FALLBACK_OWNER_ID || fallbackOwnerEmail || "admin-token").trim();
    return { ownerId: fallbackOwnerId, ownerEmail: fallbackOwnerEmail };
  }

  if (bearerToken) {
    return await verifySupabaseJwt(request, env);
  }

  const expectedToken = env.API_TOKEN;
  if (!expectedToken) {
    throw createHttpError(401, "Login required");
  }

  if (bearerToken !== expectedToken) {
    throw createHttpError(401, "Unauthorized");
  }

  const fallbackOwnerEmail = (env.ADMIN_FALLBACK_OWNER_EMAIL || "admin-token").trim().toLowerCase();
  const fallbackOwnerId = (env.ADMIN_FALLBACK_OWNER_ID || fallbackOwnerEmail || "admin-token").trim();
  return { ownerId: fallbackOwnerId, ownerEmail: fallbackOwnerEmail };
}

function mapLogRow(row) {
  return {
    timestamp: row.timestamp,
    date: row.date,
    program: row.program,
    dayType: row.day_type,
    exercise: row.exercise,
    setNumber: row.set_number,
    target: row.target,
    completed: row.completed,
    isTime: Boolean(row.is_time),
    weightGuide: row.weight_guide,
    actualLoadKg: Number(row.actual_load_kg) || 0,
    effortRpe: Number(row.effort_rpe) || 0,
    tempo: row.tempo,
    rest: row.rest_seconds,
    sessionId: row.session_id,
    durationMinutes: row.duration_minutes,
  };
}

function mapSessionRow(row) {
  return {
    sessionId: row.session_id,
    date: row.date,
    program: row.program,
    dayType: row.day_type,
    durationMinutes: row.duration_minutes,
    setsCompleted: row.sets_completed,
    note: row.note,
    availableWeights: row.available_weights,
    readiness: Number(row.readiness) || 0,
    warmupCompleted: Boolean(row.warmup_completed),
    stretchCompleted: Boolean(row.stretch_completed),
  };
}

function buildWhoAmI(identity) {
  return {
    authenticated: true,
    userId: identity.ownerId,
    email: identity.ownerEmail,
  };
}

function isWriteRequest(request, url) {
  return url.pathname.startsWith("/api/") && ["POST", "PATCH", "DELETE"].includes(request.method);
}

function getRateLimitWindowSeconds(env) {
  const value = Number.parseInt(env.WRITE_RATE_LIMIT_WINDOW_SECONDS || "60", 10);
  return Number.isFinite(value) && value > 0 ? value : 60;
}

function getRateLimitMax(env) {
  const value = Number.parseInt(env.WRITE_RATE_LIMIT_MAX || "60", 10);
  return Number.isFinite(value) && value > 0 ? value : 60;
}

async function assertWriteRateLimit(request, url, env, identity) {
  if (!isWriteRequest(request, url)) return;

  const db = ensureDb(env);
  const windowSeconds = getRateLimitWindowSeconds(env);
  const maxRequests = getRateLimitMax(env);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
  const routeKey = getRateLimitRouteKey(url.pathname);
  const bucketKey = `${identity.ownerId}:${request.method}:${routeKey}:${bucket}`;

  await db.prepare(`
    INSERT INTO request_rate_limits (bucket_key, window_start, request_count, updated_at)
    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(bucket_key) DO UPDATE SET
      request_count = request_count + 1,
      updated_at = CURRENT_TIMESTAMP
  `).bind(bucketKey, bucket).run();

  const current = await db.prepare(`
    SELECT request_count
    FROM request_rate_limits
    WHERE bucket_key = ?
  `).bind(bucketKey).first();

  if ((current?.request_count || 0) > maxRequests) {
    const retryAfter = String(Math.max(1, bucket + windowSeconds - nowSeconds));
    const error = createHttpError(429, "Rate limit exceeded", { "Retry-After": retryAfter });
    error.auditEvent = {
      eventType: "rate_limit_hit",
      ownerEmail: identity.ownerEmail,
      statusCode: 429,
      details: {
        bucketKey,
        requestCount: current?.request_count || 0,
        maxRequests,
        windowSeconds,
      },
    };
    throw error;
  }

  if (Math.random() < 0.05) {
    const cutoff = new Date((nowSeconds - windowSeconds * 10) * 1000).toISOString();
    db.prepare(`DELETE FROM request_rate_limits WHERE updated_at < ?`).bind(cutoff).run().catch(() => {});
  }
}

async function handleSnapshot(env, identity) {
  const db = ensureDb(env);
  const logsResult = await db.prepare(`
    SELECT timestamp, date, program, day_type, exercise, set_number, target, completed, is_time, weight_guide, actual_load_kg, effort_rpe, tempo, rest_seconds, session_id, duration_minutes
    FROM workout_logs
    WHERE owner_id = ? OR (owner_id = '' AND owner_email = ?)
    ORDER BY timestamp DESC
    LIMIT 250
  `).bind(identity.ownerId, identity.ownerEmail).all();
  const sessionsResult = await db.prepare(`
    SELECT session_id, date, program, day_type, duration_minutes, sets_completed, note, available_weights, readiness, warmup_completed, stretch_completed
    FROM session_history
    WHERE owner_id = ? OR (owner_id = '' AND owner_email = ?)
    ORDER BY date DESC, session_id DESC
    LIMIT 50
  `).bind(identity.ownerId, identity.ownerEmail).all();

  return {
    logs: (logsResult.results || []).map(mapLogRow),
    history: (sessionsResult.results || []).map(mapSessionRow),
  };
}

async function handleHistorySummary(env, identity) {
  const db = ensureDb(env);
  const sessionsResult = await db.prepare(`
    SELECT session_id, date, program, day_type, duration_minutes, sets_completed, note, available_weights, readiness, warmup_completed, stretch_completed
    FROM session_history
    WHERE owner_id = ? OR (owner_id = '' AND owner_email = ?)
    ORDER BY date DESC, session_id DESC
    LIMIT 50
  `).bind(identity.ownerId, identity.ownerEmail).all();

  const sessions = (sessionsResult.results || []).map(mapSessionRow);
  if (!sessions.length) return { history: [] };

  const placeholders = sessions.map(() => "?").join(",");
  const logsResult = await db.prepare(`
    SELECT session_id, exercise, target, completed, is_time, weight_guide, actual_load_kg, effort_rpe, timestamp
    FROM workout_logs
    WHERE (owner_id = ? OR (owner_id = '' AND owner_email = ?)) AND session_id IN (${placeholders})
    ORDER BY timestamp DESC
  `).bind(identity.ownerId, identity.ownerEmail, ...sessions.map((session) => session.sessionId)).all();

  const logsBySession = (logsResult.results || []).reduce((acc, row) => {
    if (!acc[row.session_id]) acc[row.session_id] = {};
    if (!acc[row.session_id][row.exercise]) {
      acc[row.session_id][row.exercise] = {
        exercise: row.exercise,
        sets: 0,
        completed: 0,
        target: row.target,
        isTime: Boolean(row.is_time),
        totalKg: 0,
        targetTotal: 0,
        rpeSum: 0,
        ratedSets: 0,
        lastLoadKg: 0,
      };
    }
    const exercise = acc[row.session_id][row.exercise];
    const completed = Number(row.completed) || 0;
    const actualLoadKg = Number(row.actual_load_kg) || 0;
    const effortRpe = Number(row.effort_rpe) || 0;
    exercise.sets += 1;
    exercise.completed += completed;
    exercise.targetTotal += Number(row.target) || 0;
    exercise.totalKg += row.is_time ? 0 : completed * (actualLoadKg || getWeightTotalKg(row.weight_guide));
    if (effortRpe > 0) {
      exercise.rpeSum += effortRpe;
      exercise.ratedSets += 1;
    }
    if (!exercise.lastLoadKg && actualLoadKg > 0) exercise.lastLoadKg = actualLoadKg;
    return acc;
  }, {});

  return {
    history: sessions.map((session) => {
      const exercises = Object.values(logsBySession[session.sessionId] || {}).map((exercise) => ({
        ...exercise,
        avgRpe: exercise.ratedSets ? exercise.rpeSum / exercise.ratedSets : 0,
        completionRate: exercise.targetTotal > 0 ? exercise.completed / exercise.targetTotal : 1,
      }));
      return {
        ...session,
        exercises,
        totalKg: exercises.reduce((sum, exercise) => sum + exercise.totalKg, 0),
        totalCompleted: exercises.reduce((sum, exercise) => sum + exercise.completed, 0),
      };
    }),
  };
}

async function handleLogCreate(request, env, identity) {
  const payload = await readJson(request);
  const timestamp = boundedText(payload?.timestamp, 64);
  const date = boundedText(payload?.date, 10);
  const exercise = boundedText(payload?.exercise, 120);
  const sessionId = boundedText(payload?.sessionId, 160);

  if (!isValidTimestamp(timestamp) || !exercise || !sessionId || (date && !isValidDateLabel(date))) {
    return json({ error: "Invalid log payload" }, request, env, { status: 400 });
  }

  const clientLogId = boundedText(payload?.clientLogId || request.headers.get("Idempotency-Key") || "", 128);
  const db = ensureDb(env);
  const result = await db.prepare(`
    INSERT OR IGNORE INTO workout_logs (
      timestamp, date, program, day_type, exercise, set_number, target, completed,
      is_time, weight_guide, actual_load_kg, effort_rpe, tempo, rest_seconds, session_id, duration_minutes, owner_email, owner_id, client_log_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    timestamp,
    date,
    boundedText(payload?.program, 120),
    boundedText(payload?.dayType, 16),
    exercise,
    nonNegativeInteger(payload?.setNumber, 1000),
    nonNegativeInteger(payload?.target, 100000),
    nonNegativeInteger(payload?.completed, 100000),
    payload?.isTime === true ? 1 : 0,
    boundedText(payload?.weightGuide, 160),
    nonNegativeNumber(payload?.actualLoadKg, 1000),
    ratingInteger(payload?.effortRpe, 1, 10, 0),
    boundedText(payload?.tempo, 64),
    nonNegativeInteger(payload?.rest, 86400),
    sessionId,
    nonNegativeInteger(payload?.durationMinutes, 100000),
    identity.ownerEmail,
    identity.ownerId,
    clientLogId,
  ).run();

  return json({ ok: true, duplicate: (result.meta?.changes || 0) === 0 }, request, env);
}

async function handleSessionCreate(request, env, identity) {
  const payload = await readJson(request);
  const sessionId = boundedText(payload?.sessionId, 160);
  const date = boundedText(payload?.date, 10);
  if (!sessionId || !isValidDateLabel(date)) {
    return json({ error: "Invalid session payload" }, request, env, { status: 400 });
  }

  const db = ensureDb(env);
  const existing = await db.prepare(`
    SELECT session_id, owner_id, owner_email
    FROM session_history
    WHERE session_id = ?
  `).bind(sessionId).first();

  if (existing && !sessionBelongsToIdentity(existing, identity)) {
    return json({ error: "Session id already belongs to another user" }, request, env, { status: 409 });
  }

  await db.prepare(`
    INSERT OR REPLACE INTO session_history (
      session_id, date, program, day_type, duration_minutes, sets_completed,
      note, available_weights, readiness, warmup_completed, stretch_completed, owner_email, owner_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    sessionId,
    date,
    boundedText(payload?.program, 120),
    boundedText(payload?.dayType, 16),
    nonNegativeInteger(payload?.durationMinutes, 100000),
    nonNegativeInteger(payload?.setsCompleted, 100000),
    boundedText(payload?.note, 2000),
    boundedText(payload?.availableWeights, 240),
    ratingInteger(payload?.readiness, 1, 5, 3),
    payload?.warmupCompleted === true ? 1 : 0,
    payload?.stretchCompleted === true ? 1 : 0,
    identity.ownerEmail,
    identity.ownerId,
  ).run();

  return json({ ok: true }, request, env);
}

async function handleSessionDelete(sessionId, request, env, identity) {
  if (!sessionId) {
    return json({ error: "Missing session id" }, request, env, { status: 400 });
  }

  const db = ensureDb(env);
  await db.prepare(`DELETE FROM workout_logs WHERE session_id = ? AND (owner_id = ? OR (owner_id = '' AND owner_email = ?))`).bind(sessionId, identity.ownerId, identity.ownerEmail).run();
  await db.prepare(`DELETE FROM session_history WHERE session_id = ? AND (owner_id = ? OR (owner_id = '' AND owner_email = ?))`).bind(sessionId, identity.ownerId, identity.ownerEmail).run();

  return json({ ok: true, sessionId }, request, env);
}

async function handleSessionUpdate(sessionId, request, env, identity) {
  if (!sessionId) {
    return json({ error: "Missing session id" }, request, env, { status: 400 });
  }

  const payload = await readJson(request);
  if (!payload) {
    return json({ error: "Invalid session payload" }, request, env, { status: 400 });
  }

  const db = ensureDb(env);
  const existing = await db.prepare(`
    SELECT session_id, date, program, day_type, duration_minutes, sets_completed, note, available_weights, readiness, warmup_completed, stretch_completed
    FROM session_history
    WHERE session_id = ? AND (owner_id = ? OR (owner_id = '' AND owner_email = ?))
  `).bind(sessionId, identity.ownerId, identity.ownerEmail).first();

  if (!existing) {
    return json({ error: "Session not found" }, request, env, { status: 404 });
  }

  await db.prepare(`
    UPDATE session_history
    SET note = ?, available_weights = ?, readiness = ?, warmup_completed = ?, stretch_completed = ?, owner_email = ?, owner_id = ?
    WHERE session_id = ? AND (owner_id = ? OR (owner_id = '' AND owner_email = ?))
  `).bind(
    payload.note === undefined ? existing.note : boundedText(payload.note, 2000),
    payload.availableWeights === undefined ? existing.available_weights : boundedText(payload.availableWeights, 240),
    payload.readiness === undefined ? existing.readiness : ratingInteger(payload.readiness, 1, 5, 3),
    payload.warmupCompleted === undefined ? existing.warmup_completed : payload.warmupCompleted ? 1 : 0,
    payload.stretchCompleted === undefined ? existing.stretch_completed : payload.stretchCompleted ? 1 : 0,
    identity.ownerEmail,
    identity.ownerId,
    sessionId,
    identity.ownerId,
    identity.ownerEmail,
  ).run();

  return json({ ok: true, sessionId }, request, env);
}

export default {
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(pingSupabaseKeepAlive(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      assertAllowedOrigin(request, env);

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: getCorsHeaders(request, env) });
      }

      const identity = url.pathname === "/api/health" ? null : await getRequestIdentity(request, env);
      if (identity) {
        await assertWriteRateLimit(request, url, env, identity);
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({ ok: true, service: "workout-coach-api" }, request, env);
      }

      if (request.method === "GET" && url.pathname === "/api/snapshot") {
        return json(await handleSnapshot(env, identity), request, env);
      }

      if (request.method === "GET" && url.pathname === "/api/whoami") {
        return json(buildWhoAmI(identity), request, env);
      }

      if (request.method === "GET" && url.pathname === "/api/history-summary") {
        return json(await handleHistorySummary(env, identity), request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/logs") {
        return await handleLogCreate(request, env, identity);
      }

      if (request.method === "POST" && url.pathname === "/api/sessions") {
        return await handleSessionCreate(request, env, identity);
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/sessions/")) {
        const sessionId = decodeSessionPath(url.pathname);
        if (!sessionId) {
          return json({ error: "Invalid session id" }, request, env, { status: 400 });
        }
        const response = await handleSessionDelete(sessionId, request, env, identity);
        ctx.waitUntil(logAuditEvent(request, env, {
          eventType: "session_delete",
          ownerEmail: identity.ownerEmail,
          sessionId,
          statusCode: 200,
          details: { sessionId },
        }));
        return response;
      }

      if (request.method === "PATCH" && url.pathname.startsWith("/api/sessions/")) {
        const sessionId = decodeSessionPath(url.pathname);
        if (!sessionId) {
          return json({ error: "Invalid session id" }, request, env, { status: 400 });
        }
        const response = await handleSessionUpdate(sessionId, request, env, identity);
        ctx.waitUntil(logAuditEvent(request, env, {
          eventType: "session_update",
          ownerEmail: identity.ownerEmail,
          sessionId,
          statusCode: 200,
          details: { sessionId },
        }));
        return response;
      }

      return json({ error: "Not found" }, request, env, { status: 404 });
    } catch (error) {
      const status = typeof error?.status === "number" ? error.status : 500;
      if (status === 401 || status === 403 || status === 429) {
        const auditEvent = error?.auditEvent || {
          eventType: status === 429 ? "rate_limit_hit" : "auth_failure",
          ownerEmail: "",
          statusCode: status,
          details: { message: error instanceof Error ? error.message : "Unknown error" },
        };
        ctx.waitUntil(logAuditEvent(request, env, auditEvent));
      }
      const publicMessage = status >= 500
        ? "Internal server error"
        : error instanceof Error ? error.message : "Request failed";
      return json(
        { error: publicMessage },
        request,
        env,
        { status, headers: error?.headers || {} },
      );
    }
  },
};
