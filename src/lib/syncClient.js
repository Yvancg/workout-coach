import { getSyncApiBase, getSyncHeaders } from "./workoutUtils";

async function fetchSyncJson(path, syncApiUrl, accessToken = "", init = {}) {
  const apiBase = getSyncApiBase(syncApiUrl);
  if (apiBase === null) return { skipped: true, data: null };

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...getSyncHeaders(init.body !== undefined, accessToken),
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

export async function loadHistorySummary(syncApiUrl, accessToken) {
  return fetchSyncJson("/api/history-summary", syncApiUrl, accessToken);
}

export async function loadWhoAmI(syncApiUrl, accessToken) {
  return fetchSyncJson("/api/whoami", syncApiUrl, accessToken);
}

export async function createRemoteSession(syncApiUrl, accessToken, sessionRecord) {
  return fetchSyncJson("/api/sessions", syncApiUrl, accessToken, {
    method: "POST",
    body: JSON.stringify(sessionRecord),
  });
}

export async function updateRemoteSession(syncApiUrl, accessToken, sessionId, sessionPatch) {
  return fetchSyncJson(`/api/sessions/${sessionId}`, syncApiUrl, accessToken, {
    method: "PATCH",
    body: JSON.stringify(sessionPatch),
  });
}

export async function deleteRemoteSession(syncApiUrl, accessToken, sessionId) {
  return fetchSyncJson(`/api/sessions/${sessionId}`, syncApiUrl, accessToken, {
    method: "DELETE",
  });
}

export async function createRemoteLog(syncApiUrl, accessToken, entry) {
  return fetchSyncJson("/api/logs", syncApiUrl, accessToken, {
    method: "POST",
    body: JSON.stringify(entry),
  });
}
