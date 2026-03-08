const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
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

async function handleSnapshot(env) {
  const db = ensureDb(env);
  const logsResult = await db.prepare(`
    SELECT timestamp, date, program, day_type, exercise, set_number, target, completed, is_time, weight_guide, tempo, rest_seconds, session_id, duration_minutes
    FROM workout_logs
    ORDER BY timestamp DESC
    LIMIT 250
  `).all();
  const sessionsResult = await db.prepare(`
    SELECT session_id, date, program, day_type, duration_minutes, sets_completed, note, available_weights, warmup_completed, stretch_completed
    FROM session_history
    ORDER BY date DESC, session_id DESC
    LIMIT 50
  `).all();

  return json({
    logs: (logsResult.results || []).map(mapLogRow),
    history: (sessionsResult.results || []).map(mapSessionRow),
  });
}

async function handleLogCreate(request, env) {
  const payload = await readJson(request);
  if (!payload?.timestamp || !payload?.exercise || !payload?.sessionId) {
    return json({ error: "Invalid log payload" }, { status: 400 });
  }

  const db = ensureDb(env);
  await db.prepare(`
    INSERT INTO workout_logs (
      timestamp, date, program, day_type, exercise, set_number, target, completed,
      is_time, weight_guide, tempo, rest_seconds, session_id, duration_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  ).run();

  return json({ ok: true });
}

async function handleSessionCreate(request, env) {
  const payload = await readJson(request);
  if (!payload?.sessionId || !payload?.date) {
    return json({ error: "Invalid session payload" }, { status: 400 });
  }

  const db = ensureDb(env);
  await db.prepare(`
    INSERT OR REPLACE INTO session_history (
      session_id, date, program, day_type, duration_minutes, sets_completed,
      note, available_weights, warmup_completed, stretch_completed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  ).run();

  return json({ ok: true });
}

async function handleSessionDelete(sessionId, env) {
  if (!sessionId) {
    return json({ error: "Missing session id" }, { status: 400 });
  }

  const db = ensureDb(env);
  await db.prepare(`DELETE FROM workout_logs WHERE session_id = ?`).bind(sessionId).run();
  await db.prepare(`DELETE FROM session_history WHERE session_id = ?`).bind(sessionId).run();

  return json({ ok: true, sessionId });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({ ok: true, service: "workout-coach-api" });
      }

      if (request.method === "GET" && url.pathname === "/api/snapshot") {
        return await handleSnapshot(env);
      }

      if (request.method === "POST" && url.pathname === "/api/logs") {
        return await handleLogCreate(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/sessions") {
        return await handleSessionCreate(request, env);
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/sessions/")) {
        const sessionId = decodeURIComponent(url.pathname.replace("/api/sessions/", ""));
        return await handleSessionDelete(sessionId, env);
      }

      return json({ error: "Not found" }, { status: 404 });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
  },
};
