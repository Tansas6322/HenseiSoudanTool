"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "nobu-user-key";

export function useUserKey() {
  const [userKey, setUserKeyState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setUserKeyState(stored);
    }
    setReady(true);
  }, []);

  const setUserKey = (value: string) => {
    setUserKeyState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  };

  const clearUserKey = () => {
    setUserKeyState(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return { userKey, ready, setUserKey, clearUserKey };
}
