import { useCallback, useState } from "react";

export const TOC_RAIL_STORAGE_KEY = "orbit-toc-expanded";
export const MARGINALIA_RAIL_STORAGE_KEY = "orbit-marginalia-expanded";

function readStoredExpanded(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") {
    return defaultValue;
  }
  const stored = localStorage.getItem(key);
  if (stored === null) {
    return defaultValue;
  }
  return stored === "true";
}

export function useRailExpanded(storageKey: string, defaultValue = false) {
  const [expanded, setExpandedState] = useState(() =>
    readStoredExpanded(storageKey, defaultValue)
  );

  const setExpanded = useCallback(
    (value: boolean) => {
      setExpandedState(value);
      localStorage.setItem(storageKey, String(value));
    },
    [storageKey]
  );

  return [expanded, setExpanded] as const;
}
