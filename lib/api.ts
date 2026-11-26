"use client";

import { getTokens } from "./auth";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Thrown when the person needs to sign in (again) before this call can work. */
export class SignInNeeded extends Error {}

interface Options {
  method?: "GET" | "POST";
  body?: unknown;
  /** Set false for the few endpoints that need no sign-in. */
  auth?: boolean;
  /** Called when the database is waking from sleep and we are waiting to retry. */
  onWaking?: () => void;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false) {
    const tokens = await getTokens();
    if (!tokens) throw new SignInNeeded();
    headers["X-HCB-Token"] = tokens.accessToken;
    headers["X-HCB-IdToken"] = tokens.idToken;
  }

  // The free database sleeps when idle. The API answers 503 while it wakes,
  // so we wait and try again a few times before giving up.
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(path, {
        method: opts.method ?? "GET",
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        cache: "no-store",
      });
    } catch {
      throw new ApiError(0, "We could not reach Hello Capo Beach. Check your connection and try again.");
    }
    if (res.status === 503 && attempt < 8) {
      opts.onWaking?.();
      await wait(8000);
      continue;
    }
    if (res.status === 401) throw new SignInNeeded();
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong. Please try again.");
    return data as T;
  }
}
