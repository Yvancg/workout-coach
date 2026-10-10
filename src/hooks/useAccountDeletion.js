import { useCallback, useState } from "react";
import { clearStateBackup } from "../lib/stateBackup";
import { deleteRemoteAccountData } from "../lib/syncClient";
import { clearSyncOutbox } from "../lib/syncOutbox";
import { DEFAULT_STATE, STORAGE_KEY } from "../lib/workoutData";
import { confirmAction } from "../lib/workoutUtils";

export function useAccountDeletion({
  authSession,
  syncApiUrl,
  deleteAuthAccount,
  setState,
  clearSyncStatus,
}) {
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState("");

  const clearLocalWorkoutData = useCallback(async () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(`${STORAGE_KEY}:savedAt`);
    } catch (error) {
      console.error("Could not clear local workout storage.", error);
    }

    const results = await Promise.allSettled([
      clearStateBackup(STORAGE_KEY),
      clearSyncOutbox(),
    ]);
    results
      .filter((result) => result.status === "rejected")
      .forEach((result) => {
        console.error("Could not clear a local workout data store.", result.reason);
      });

    setState({ ...DEFAULT_STATE });
    clearSyncStatus();
  }, [clearSyncStatus, setState]);

  const clearAllData = useCallback(() => {
    confirmAction("Clear all local workout data from this device?", clearLocalWorkoutData);
  }, [clearLocalWorkoutData]);

  const deleteAccount = useCallback(async () => {
    if (deletingAccount) return;
    if (!authSession?.access_token) {
      setDeletionStatus("Sign in before deleting your account.");
      return;
    }

    const confirmation = window.prompt(
      "This permanently deletes your account and synced workout data. Type DELETE to continue.",
    );
    if (confirmation !== "DELETE") {
      setDeletionStatus("Account deletion cancelled.");
      return;
    }

    setDeletingAccount(true);
    setDeletionStatus("Deleting synced workout data...");

    try {
      const result = await deleteRemoteAccountData(syncApiUrl, authSession.access_token);
      if (result.skipped) {
        throw new Error("Cloud sync is not configured, so account deletion cannot be completed safely.");
      }

      setDeletionStatus("Synced workout data deleted. Removing login account...");
      const authDeleted = await deleteAuthAccount();
      if (!authDeleted) {
        throw new Error("Synced workout data was deleted, but the login account could not be deleted. Sign in again and retry.");
      }

      await clearLocalWorkoutData();
      setDeletionStatus("Account and synced workout data deleted.");
    } catch (error) {
      setDeletionStatus(error instanceof Error ? error.message : "Could not delete the account. Please try again.");
    } finally {
      setDeletingAccount(false);
    }
  }, [authSession?.access_token, clearLocalWorkoutData, deleteAuthAccount, deletingAccount, syncApiUrl]);

  return {
    clearAllData,
    deleteAccount,
    deletingAccount,
    deletionStatus,
  };
}
