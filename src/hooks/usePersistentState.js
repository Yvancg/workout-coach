import { useEffect, useState } from "react";

export function usePersistentState(storageKey, loadValue) {
  const [state, setState] = useState(loadValue);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  return [state, setState];
}
