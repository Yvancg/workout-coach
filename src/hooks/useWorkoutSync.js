import { useCallback, useEffect, useState } from "react";
import { loadHistorySummary, sendQueuedSyncOperation } from "../lib/syncClient.js";
import { createOperationId, enqueueSyncOperation, flushSyncOutbox } from "../lib/syncOutbox.js";
import { getSyncApiBase } from "../lib/workoutUtils.js";

export function useWorkoutSync({ authSession, syncApiUrl, setState }) {
  const [syncStatus, setSyncStatus] = useState("");
  const activeOwnerId = authSession?.user?.id || "";
  const activeOwnerEmail = authSession?.user?.email || "";
  const activeOwnerKey = activeOwnerId || activeOwnerEmail;
  const accessToken = authSession?.access_token || "";

  useEffect(() => {
    const syncTarget = getSyncApiBase(syncApiUrl);
    if (syncTarget === null || !accessToken) return undefined;

    let cancelled = false;

    async function loadRemoteSnapshot() {
      try {
        setSyncStatus("Loading sync...");
        const historyResult = await loadHistorySummary(syncApiUrl, accessToken);
        if (historyResult.skipped || cancelled) return;

        setState((prev) => ({
          ...prev,
          history: [
            ...(Array.isArray(historyResult.data?.history)
              ? historyResult.data.history.map((session) => ({
                ...session,
                ownerId: activeOwnerId,
                ownerEmail: activeOwnerEmail,
              }))
              : []),
            ...prev.history.filter((session) => (
              (session.ownerId || session.ownerEmail || "") !== (activeOwnerId || activeOwnerEmail)
            )),
          ],
        }));
        setSyncStatus("Sync connected");
      } catch (error) {
        if (cancelled) return;
        if (error?.status === 429) {
          setSyncStatus("Sync is temporarily rate limited.");
        } else if (error?.status === 401 || error?.status === 403) {
          setSyncStatus("Supabase login required for sync.");
        } else {
          setSyncStatus("Sync unavailable. Local save only.");
        }
      }
    }

    loadRemoteSnapshot();
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeOwnerEmail, activeOwnerId, setState, syncApiUrl]);

  const flushPendingSync = useCallback(async () => {
    if (!accessToken) return { synced: 0, pending: 0 };

    const result = await flushSyncOutbox(
      (operation) => sendQueuedSyncOperation(syncApiUrl, accessToken, operation),
      { ownerId: activeOwnerId, ownerEmail: activeOwnerEmail },
    );

    if (result.pending > 0) {
      setSyncStatus(`${result.pending} change${result.pending === 1 ? "" : "s"} waiting to sync.`);
    } else if (result.synced > 0) {
      setSyncStatus("Synced");
    }
    return result;
  }, [accessToken, activeOwnerEmail, activeOwnerId, syncApiUrl]);

  const queueSyncOperation = useCallback(async (operation) => {
    if (!accessToken) return { queued: false, pending: 0 };

    try {
      const queuedId = await enqueueSyncOperation({
        ...operation,
        ownerId: activeOwnerId,
        ownerEmail: activeOwnerEmail,
      });

      if (!queuedId) {
        await sendQueuedSyncOperation(syncApiUrl, accessToken, operation);
        setSyncStatus("Synced");
        return { queued: false, pending: 0 };
      }

      setSyncStatus("Saved locally. Sync pending...");
      const result = await flushPendingSync();
      return { queued: result.pending > 0, pending: result.pending };
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        setSyncStatus("Supabase login required for sync.");
      } else if (error?.status === 429) {
        setSyncStatus("Sync is rate limited. Saved locally and queued.");
      } else {
        setSyncStatus("Offline or sync unavailable. Saved locally and queued.");
      }
      return { queued: true };
    }
  }, [accessToken, activeOwnerEmail, activeOwnerId, flushPendingSync, syncApiUrl]);

  useEffect(() => {
    if (!accessToken) return undefined;

    let cancelled = false;
    const flush = async () => {
      try {
        await flushPendingSync();
      } catch (error) {
        if (cancelled) return;
        if (error?.status === 401 || error?.status === 403) {
          setSyncStatus("Supabase login required for sync.");
        } else {
          setSyncStatus("Offline or sync unavailable. Saved locally and queued.");
        }
      }
    };

    flush();
    const intervalId = window.setInterval(flush, 60_000);
    window.addEventListener("online", flush);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("online", flush);
    };
  }, [accessToken, flushPendingSync]);

  const entryBelongsToActiveUser = useCallback((entry) => {
    const entryOwnerId = entry?.ownerId || "";
    const entryOwnerEmail = entry?.ownerEmail || "";

    if (activeOwnerKey) {
      return entryOwnerId === activeOwnerId || (!entryOwnerId && entryOwnerEmail === activeOwnerEmail);
    }
    return !entryOwnerId && !entryOwnerEmail;
  }, [activeOwnerEmail, activeOwnerId, activeOwnerKey]);

  const syncSessionToRemote = async (sessionRecord) => {
    await queueSyncOperation({
      id: `session-create:${sessionRecord.sessionId}`,
      type: "session.create",
      payload: sessionRecord,
    });
  };

  const deleteSessionRemote = async (sessionId) => {
    await queueSyncOperation({
      id: `session-delete:${sessionId}`,
      type: "session.delete",
      sessionId,
    });
    return true;
  };

  const updateSessionRemote = async (sessionId, sessionPatch) => {
    await queueSyncOperation({
      id: createOperationId(`session-update:${sessionId}`),
      type: "session.update",
      sessionId,
      payload: sessionPatch,
    });
    return true;
  };

  const saveSetLocally = async (entry) => {
    setState((prev) => ({ ...prev, logs: [...prev.logs, entry] }));
    await queueSyncOperation({
      id: entry.clientLogId,
      type: "log.create",
      payload: entry,
    });
  };

  const syncTarget = getSyncApiBase(syncApiUrl);
  const displayedSyncStatus = !accessToken && syncTarget !== null && syncTarget !== ""
    ? "Login required for sync."
    : syncStatus;
  const syncConnected = syncTarget !== null && /connected|synced/i.test(syncStatus || "");

  return {
    activeOwnerEmail,
    activeOwnerId,
    clearSyncStatus: () => setSyncStatus(""),
    deleteSessionRemote,
    displayedSyncStatus,
    entryBelongsToActiveUser,
    saveSetLocally,
    syncConnected,
    syncSessionToRemote,
    updateSessionRemote,
  };
}
