import { useEffect, useState } from "react";

// Persist synchronously at the state update boundary so an interrupted session
// does not depend on a later React effect to reach local storage.
export function usePersistentState(storageKey, loadValue) {
  const [state, setStateInternal] = useState(loadValue);
  const [storageError, setStorageError] = useState(null);

  const setState = (update) => {
    setStateInternal((previous) => {
      const next = typeof update === "function" ? update(previous) : update;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
        queueMicrotask(() => setStorageError(null));
      } catch (error) {
        queueMicrotask(() => setStorageError(error));
      }
      return next;
    });
  };

  useEffect(() => {
    if (storageError) console.error("Workout data could not be saved on this device.", storageError);
  }, [storageError]);

  return [state, setState, storageError];
}
