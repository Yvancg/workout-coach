function getAllowedOrigins(env) {
  const configured = env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) || [];
  return configured.length ? configured : [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://localhost",
    "capacitor://localhost",
  ];
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = getAllowedOrigins(env);
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
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
  const origin = request.headers.get("Origin");
  if (!origin) return;
  if (!getAllowedOrigins(env).includes(origin)) {
    throw new Error("Origin not allowed");
  }
}

function getAllowedEmails(env) {
  return env.ACCESS_ALLOW_EMAILS?.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean) || [];
}

function getRequestIdentity(request, env) {
  const accessEmail = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").trim().toLowerCase();
  const allowedEmails = getAllowedEmails(env);

  if (accessEmail) {
    if (allowedEmails.length && !allowedEmails.includes(accessEmail)) {
      const error = new Error("Access denied");
      error.status = 403;
      throw error;
    }

    return { ownerEmail: accessEmail };
  }

  const expectedToken = env.API_TOKEN;
  if (!expectedToken) {
    const error = new Error("Login required");
    error.status = 401;
    throw error;
  }

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token !== expectedToken) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }

  const fallbackOwner = (env.ACCESS_FALLBACK_OWNER_EMAIL || "admin-token").trim().toLowerCase();
  return { ownerEmail: fallbackOwner };
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
    warmupCompleted: Boolean(row.warmup_completed),
    stretchCompleted: Boolean(row.stretch_completed),
  };
}

function buildWhoAmI(identity) {
  return {
    authenticated: true,
    email: identity.ownerEmail,
  };
}

async function handleSnapshot(env, identity) {
  const db = ensureDb(env);
  const logsResult = await db.prepare(`
    SELECT timestamp, date, program, day_type, exercise, set_number, target, completed, is_time, weight_guide, tempo, rest_seconds, session_id, duration_minutes
    FROM workout_logs
    WHERE owner_email = ? OR owner_email = ''
    ORDER BY timestamp DESC
    LIMIT 250
  `).bind(identity.ownerEmail).all();
  const sessionsResult = await db.prepare(`
    SELECT session_id, date, program, day_type, duration_minutes, sets_completed, note, available_weights, warmup_completed, stretch_completed
    FROM session_history
    WHERE owner_email = ? OR owner_email = ''
    ORDER BY date DESC, session_id DESC
    LIMIT 50
  `).bind(identity.ownerEmail).all();

  return {
    logs: (logsResult.results || []).map(mapLogRow),
    history: (sessionsResult.results || []).map(mapSessionRow),
  };
}

async function handleHistorySummary(env, identity) {
  const db = ensureDb(env);
  const sessionsResult = await db.prepare(`
    SELECT session_id, date, program, day_type, duration_minutes, sets_completed, note, available_weights, warmup_completed, stretch_completed
    FROM session_history
    WHERE owner_email = ? OR owner_email = ''
    ORDER BY date DESC, session_id DESC
    LIMIT 50
  `).bind(identity.ownerEmail).all();

  const sessions = (sessionsResult.results || []).map(mapSessionRow);
  if (!sessions.length) return { history: [] };

  const placeholders = sessions.map(() => "?").join(",");
  const logsResult = await db.prepare(`
    SELECT session_id, exercise, target, completed, is_time, weight_guide
    FROM workout_logs
    WHERE (owner_email = ? OR owner_email = '') AND session_id IN (${placeholders})
    ORDER BY timestamp DESC
  `).bind(identity.ownerEmail, ...sessions.map((session) => session.sessionId)).all();

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
      };
    }
    acc[row.session_id][row.exercise].sets += 1;
    acc[row.session_id][row.exercise].completed += Number(row.completed) || 0;
    acc[row.session_id][row.exercise].totalKg += (Number(row.completed) || 0) * getWeightTotalKg(row.weight_guide);
    return acc;
  }, {});

  return {
    history: sessions.map((session) => {
      const exercises = Object.values(logsBySession[session.sessionId] || {});
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
  if (!payload?.timestamp || !payload?.exercise || !payload?.sessionId) {
    return json({ error: "Invalid log payload" }, request, env, { status: 400 });
  }

  const db = ensureDb(env);
  await db.prepare(`
    INSERT INTO workout_logs (
      timestamp, date, program, day_type, exercise, set_number, target, completed,
      is_time, weight_guide, tempo, rest_seconds, session_id, duration_minutes, owner_email
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    payload.timestamp,
    payload.date || "",
    payload.program || "",
    payload.dayType || "",
    payload.exercise,
    payload.setNumber || 0,
    payload.target || 0,
    payload.completed || 0,
    payload.isTime ? 1 : 0,
    payload.weightGuide || "",
    payload.tempo || "",
    payload.rest || 0,
    payload.sessionId,
    payload.durationMinutes || 0,
    identity.ownerEmail,
  ).run();

  return json({ ok: true }, request, env);
}

async function handleSessionCreate(request, env, identity) {
  const payload = await readJson(request);
  if (!payload?.sessionId || !payload?.date) {
    return json({ error: "Invalid session payload" }, request, env, { status: 400 });
  }

  const db = ensureDb(env);
  await db.prepare(`
    INSERT OR REPLACE INTO session_history (
      session_id, date, program, day_type, duration_minutes, sets_completed,
      note, available_weights, warmup_completed, stretch_completed, owner_email
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    payload.sessionId,
    payload.date,
    payload.program || "",
    payload.dayType || "",
    payload.durationMinutes || 0,
    payload.setsCompleted || 0,
    payload.note || "",
    payload.availableWeights || "",
    payload.warmupCompleted ? 1 : 0,
    payload.stretchCompleted ? 1 : 0,
    identity.ownerEmail,
  ).run();

  return json({ ok: true }, request, env);
}

async function handleSessionDelete(sessionId, request, env, identity) {
  if (!sessionId) {
    return json({ error: "Missing session id" }, request, env, { status: 400 });
  }

  const db = ensureDb(env);
  await db.prepare(`DELETE FROM workout_logs WHERE session_id = ? AND (owner_email = ? OR owner_email = '')`).bind(sessionId, identity.ownerEmail).run();
  await db.prepare(`DELETE FROM session_history WHERE session_id = ? AND (owner_email = ? OR owner_email = '')`).bind(sessionId, identity.ownerEmail).run();

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
    SELECT session_id, date, program, day_type, duration_minutes, sets_completed, note, available_weights, warmup_completed, stretch_completed
    FROM session_history
    WHERE session_id = ? AND (owner_email = ? OR owner_email = '')
  `).bind(sessionId, identity.ownerEmail).first();

  if (!existing) {
    return json({ error: "Session not found" }, request, env, { status: 404 });
  }

  await db.prepare(`
    UPDATE session_history
    SET note = ?, available_weights = ?, warmup_completed = ?, stretch_completed = ?, owner_email = ?
    WHERE session_id = ? AND (owner_email = ? OR owner_email = '')
  `).bind(
    payload.note ?? existing.note,
    payload.availableWeights ?? existing.available_weights,
    payload.warmupCompleted === undefined ? existing.warmup_completed : payload.warmupCompleted ? 1 : 0,
    payload.stretchCompleted === undefined ? existing.stretch_completed : payload.stretchCompleted ? 1 : 0,
    identity.ownerEmail,
    sessionId,
    identity.ownerEmail,
  ).run();

  return json({ ok: true, sessionId }, request, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      assertAllowedOrigin(request, env);
      const identity = url.pathname === "/api/health" ? null : getRequestIdentity(request, env);

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
        const sessionId = decodeURIComponent(url.pathname.replace("/api/sessions/", ""));
        return await handleSessionDelete(sessionId, request, env, identity);
      }

      if (request.method === "PATCH" && url.pathname.startsWith("/api/sessions/")) {
        const sessionId = decodeURIComponent(url.pathname.replace("/api/sessions/", ""));
        return await handleSessionUpdate(sessionId, request, env, identity);
      }

      return json({ error: "Not found" }, request, env, { status: 404 });
    } catch (error) {
      const status = typeof error?.status === "number" ? error.status : error?.message === "Origin not allowed" ? 403 : 500;
      return json({ error: error instanceof Error ? error.message : "Unknown error" }, request, env, { status });
    }
  },
};
