"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

/** Loads one API path once `ready` is true. Call reload() after a change. */
export function useLoad<T>(path: string, ready: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }, [path]);

  useEffect(() => {
    if (ready) void reload();
  }, [ready, reload]);

  return { data, error, reload };
}

export function message(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
}
