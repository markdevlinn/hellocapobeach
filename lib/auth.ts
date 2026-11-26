"use client";

import { PublicClientApplication } from "@azure/msal-browser";
import { AUTH } from "./config";

// Sign-in is handled by Microsoft Entra External ID: the neighbor types their
// email and gets a one-time code. No passwords.

let appPromise: Promise<PublicClientApplication> | null = null;

/** A short technical note about the last sign-in problem, shown on screen to help with support. */
export let lastAuthProblem: string | null = null;

function note(where: string, err: unknown) {
  const e = err as { errorCode?: string; message?: string };
  lastAuthProblem = `${where}: ${e?.errorCode ?? e?.message ?? "unknown"}`.slice(0, 140);
  console.warn(lastAuthProblem, err);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject({ errorCode: `timed_out_${label}` }), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function getApp(): Promise<PublicClientApplication> {
  if (!appPromise) {
    const pca = new PublicClientApplication({
      auth: {
        clientId: AUTH.clientId,
        authority: AUTH.authority,
        knownAuthorities: [AUTH.knownAuthority],
        redirectUri: window.location.origin + AUTH.redirectPath,
        postLogoutRedirectUri: window.location.origin + "/",
        navigateToLoginRequestUrl: false,
      },
      // localStorage keeps a neighbor signed in when they reopen the app.
      cache: { cacheLocation: "localStorage" },
    });
    appPromise = withTimeout(pca.initialize(), 15000, "start").then(async () => {
      // Must run once on every page load, before anything else, so a sign-in
      // that just came back from Microsoft is finished and not left half-open.
      try {
        const result = await withTimeout(pca.handleRedirectPromise(), 20000, "return");
        if (result?.account) pca.setActiveAccount(result.account);
      } catch (err) {
        note("finishing sign-in", err);
      }
      return pca;
    });
    appPromise.catch((err) => {
      note("starting sign-in", err);
      appPromise = null;
    });
  }
  return appPromise;
}

export async function signIn(): Promise<void> {
  const pca = await getApp();
  await pca.loginRedirect({ scopes: [AUTH.apiScope] });
}

/** Forgets the saved sign-in on this device and starts a fresh one. */
export async function signInFresh(): Promise<void> {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.includes("msal") || key.includes(AUTH.clientId) || key.includes("login.windows") || key.includes("ciamlogin")) {
        window.localStorage.removeItem(key);
      }
    }
    window.sessionStorage.clear();
  } catch {
    // storage can be unavailable in private windows; carry on
  }
  appPromise = null;
  await signIn();
}

/** Call on the page Microsoft sends people back to. */
export async function completeSignIn(): Promise<boolean> {
  await getApp();
  return (await currentAccount()) !== null;
}

async function currentAccount() {
  const pca = await getApp();
  const active = pca.getActiveAccount();
  if (active) return active;
  const all = pca.getAllAccounts();
  if (all.length > 0) {
    pca.setActiveAccount(all[0]);
    return all[0];
  }
  return null;
}

export interface Tokens {
  accessToken: string;
  idToken: string;
}

/** Returns fresh tokens, or null when the person has to sign in again. Never hangs. */
export async function getTokens(): Promise<Tokens | null> {
  // Local screenshots only. This is switched on at build time by a developer and is
  // never set in the deployed build. The API rejects these placeholder tokens.
  if (process.env.NEXT_PUBLIC_PREVIEW_AUTH === "1") return { accessToken: "preview", idToken: "preview" };
  try {
    const pca = await getApp();
    const account = await currentAccount();
    if (!account) return null;
    const r = await withTimeout(pca.acquireTokenSilent({ scopes: [AUTH.apiScope], account }), 15000, "refresh");
    return { accessToken: r.accessToken, idToken: r.idToken };
  } catch (err) {
    // Any failure to refresh quietly means the same thing to the app:
    // ask the person to sign in again.
    note("refreshing sign-in", err);
    return null;
  }
}

export async function signOut(): Promise<void> {
  const pca = await getApp();
  const account = await currentAccount();
  await pca.logoutRedirect({ account: account ?? undefined });
}
