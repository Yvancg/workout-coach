import { useEffect, useState } from "react";
import { readStateBackup, writeStateBackup } from "../lib/stateBackup";

export function usePersistentState(storageKey, loadValue) {
  const [state, setState] = useState(loadValue);
  const [storageError, setStorageError] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromBestLocalCopy() {
      let localSavedAt = 0;
      try {
        localSavedAt = Number(localStorage.getItem(`${storageKey}:savedAt`) || 0);
      } catch {
        localSavedAt = 0;
      }

      try {
        const backup = await readStateBackup(storageKey);
        if (!cancelled && backup?.value && Number(backup.savedAt || 0) > localSavedAt) {
          setState(backup.value);
        }
      } catch (error) {
        console.error("Workout IndexedDB backup could not be read.", error);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    hydrateFromBestLocalCopy();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return undefined;

    let cancelled = false;
    const savedAt = Date.now();
    let localError = null;

    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      localStorage.setItem(`${storageKey}:savedAt`, String(savedAt));
    } catch (error) {
      localError = error;
    }

    writeStateBackup(storageKey, state, savedAt)
      .then((saved) => {
        if (cancelled) return;
        if (localError && !saved) {
          setStorageError(localError);
          console.error("Workout data could not be saved on this device.", localError);
        } else {
          setStorageError(null);
        }
      })
      .catch((indexedDbError) => {
        if (cancelled) return;
        if (localError) {
          setStorageError(localError);
          console.error("Workout data could not be saved on this device.", localError, indexedDbError);
        } else {
          setStorageError(null);
          console.error("Workout IndexedDB backup could not be written.", indexedDbError);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, state, storageKey]);

  return [state, setState, storageError];
}
