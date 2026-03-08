import { getSyncApiBase, getSyncHeaders } from "./workoutUtils";

async function fetchSyncJson(path, syncApiUrl, init = {}) {
  const apiBase = getSyncApiBase(syncApiUrl);
  if (apiBase === null) return { skipped: true, data: null };

  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...getSyncHeaders(init.body !== undefined),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const error = new Error(`Sync request failed: ${path}`);
    error.status = response.status;
    throw error;
  }

  const hasJsonBody = response.headers.get("content-type")?.includes("application/json");
  return {
    skipped: false,
    data: hasJsonBody ? await response.json() : null,
  };
}

export async function loadHistorySummary(syncApiUrl) {
  return fetchSyncJson("/api/history-summary", syncApiUrl);
}

export async function loadWhoAmI(syncApiUrl) {
  return fetchSyncJson("/api/whoami", syncApiUrl);
}

export async function createRemoteSession(syncApiUrl, sessionRecord) {
  return fetchSyncJson("/api/sessions", syncApiUrl, {
    method: "POST",
    body: JSON.stringify(sessionRecord),
  });
}

export async function updateRemoteSession(syncApiUrl, sessionId, sessionPatch) {
  return fetchSyncJson(`/api/sessions/${sessionId}`, syncApiUrl, {
    method: "PATCH",
    body: JSON.stringify(sessionPatch),
  });
}

export async function deleteRemoteSession(syncApiUrl, sessionId) {
  return fetchSyncJson(`/api/sessions/${sessionId}`, syncApiUrl, {
    method: "DELETE",
  });
}

export async function createRemoteLog(syncApiUrl, entry) {
  return fetchSyncJson("/api/logs", syncApiUrl, {
    method: "POST",
    body: JSON.stringify(entry),
  });
}
