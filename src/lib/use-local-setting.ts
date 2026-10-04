"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

/** A preference kept in localStorage, shared live by every component that reads it.
 * useSyncExternalStore because the server can't read it — the fallback renders first. */
export function useLocalSetting<T extends string>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    () => (localStorage.getItem(key) as T | null) ?? fallback,
    () => fallback
  );
  const set = (next: T) => {
    localStorage.setItem(key, next);
    listeners.forEach((notify) => notify());
  };
  return [value, set];
}
