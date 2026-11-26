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

// Staying signed in. After one emailed-code sign-in the server remembers this
// device for 90 days with a cookie that page scripts cannot read. This flag only
// records that we believe the cookie is there, so we know to try it first.
const REMEMBERED = "hcb_remembered";
let cookieFailedThisLoad = false;

export function isRemembered(): boolean {
  try {
    return window.localStorage.getItem(REMEMBERED) === "1";
  } catch {
    return false;
  }
}

function setRemembered(on: boolean) {
  try {
    if (on) window.localStorage.setItem(REMEMBERED, "1");
    else window.localStorage.removeItem(REMEMBERED);
  } catch {
    // storage can be unavailable in private windows; sign-in still works without it
  }
}

/** Ends the remembered sign-in on this device. Never throws. */
export async function forgetDevice(): Promise<void> {
  setRemembered(false);
  try {
    await fetch("/api/session/end", { method: "POST", headers: { "X-HCB": "1" }, cache: "no-store" });
  } catch {
    // offline: the local flag is cleared, and the server copy expires on its own
  }
}

type Sent = { res: Response } | { unreachable: true };

async function send(path: string, opts: Options, extra: Record<string, string>): Promise<Sent> {
  const headers: Record<string, string> = { "X-HCB": "1", ...extra };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  // The free database sleeps when idle. The API answers 503 while it wakes,
  // so we wait and try again a few times before giving up.
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 45000);
    try {
      res = await fetch(path, {
        method: opts.method ?? "GET",
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        cache: "no-store",
        signal: stop.signal,
      });
    } catch {
      return { unreachable: true };
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 503 && attempt < 8) {
      opts.onWaking?.();
      await wait(8000);
      continue;
    }
    return { res };
  }
}

const UNREACHABLE = "We could not reach Hello Capo Beach. Check your connection and try again.";

async function finish<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  if (opts.auth === false) {
    const r = await send(path, opts, {});
    if ("unreachable" in r) throw new ApiError(0, UNREACHABLE);
    return finish<T>(r.res);
  }

  // 1. A device that is already remembered needs nothing else.
  if (isRemembered() && !cookieFailedThisLoad) {
    const r = await send(path, opts, {});
    if ("unreachable" in r) throw new ApiError(0, UNREACHABLE);
    if (r.res.status !== 401) return finish<T>(r.res);
    // The 90 days ran out, or the cookie was cleared. Fall back to a normal sign-in.
    setRemembered(false);
    cookieFailedThisLoad = true;
  }

  // 2. Otherwise use the sign-in from the emailed code.
  const tokens = await getTokens();
  if (!tokens) throw new SignInNeeded();
  const tokenHeaders = { "X-HCB-Token": tokens.accessToken, "X-HCB-IdToken": tokens.idToken };

  // Ask the server to remember this device, once. If that does not work the
  // app carries on exactly as before.
  if (!cookieFailedThisLoad) {
    const started = await send("/api/session", { method: "POST", onWaking: opts.onWaking }, tokenHeaders);
    if ("res" in started && started.res.ok) setRemembered(true);
    else cookieFailedThisLoad = true;
  }

  const r = await send(path, opts, tokenHeaders);
  if ("unreachable" in r) throw new ApiError(0, UNREACHABLE);
  if (r.res.status === 401) throw new SignInNeeded();
  return finish<T>(r.res);
}
