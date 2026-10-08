import { useEffect, useState } from "react";

export function usePersistentState(storageKey, loadValue) {
  const [state, setState] = useState(loadValue);
  const [storageError, setStorageError] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setStorageError(null);
    } catch (error) {
      setStorageError(error);
      console.error("Workout data could not be saved on this device.", error);
    }
  }, [state, storageKey]);

  return [state, setState, storageError];
}
