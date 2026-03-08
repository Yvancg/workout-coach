import { getSyncApiBase, getSyncHeaders } from "./workoutUtils";

function shouldSkipRemoteSync(apiBase, syncApiToken) {
  return apiBase !== null && apiBase !== "" && !syncApiToken.trim();
}

async function fetchSyncJson(path, syncApiUrl, syncApiToken = "", init = {}) {
  const apiBase = getSyncApiBase(syncApiUrl);
  if (apiBase === null) return { skipped: true, data: null };
  if (shouldSkipRemoteSync(apiBase, syncApiToken)) return { skipped: true, data: null };

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...getSyncHeaders(syncApiToken, init.body !== undefined),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Sync request failed: ${path}`);
  }

  const hasJsonBody = response.headers.get("content-type")?.includes("application/json");
  return {
    skipped: false,
    data: hasJsonBody ? await response.json() : null,
  };
}

export async function loadHistorySummary(syncApiUrl, syncApiToken) {
  return fetchSyncJson("/api/history-summary", syncApiUrl, syncApiToken);
}

export async function createRemoteSession(syncApiUrl, syncApiToken, sessionRecord) {
  return fetchSyncJson("/api/sessions", syncApiUrl, syncApiToken, {
    method: "POST",
    body: JSON.stringify(sessionRecord),
  });
}

export async function updateRemoteSession(syncApiUrl, syncApiToken, sessionId, sessionPatch) {
  return fetchSyncJson(`/api/sessions/${sessionId}`, syncApiUrl, syncApiToken, {
    method: "PATCH",
    body: JSON.stringify(sessionPatch),
  });
}

export async function deleteRemoteSession(syncApiUrl, syncApiToken, sessionId) {
  return fetchSyncJson(`/api/sessions/${sessionId}`, syncApiUrl, syncApiToken, {
    method: "DELETE",
  });
}

export async function createRemoteLog(syncApiUrl, syncApiToken, entry) {
  return fetchSyncJson("/api/logs", syncApiUrl, syncApiToken, {
    method: "POST",
    body: JSON.stringify(entry),
  });
}
