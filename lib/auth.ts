"use client";

import { InteractionRequiredAuthError, PublicClientApplication } from "@azure/msal-browser";
import { AUTH } from "./config";

// Sign-in is handled by Microsoft Entra External ID: the neighbor types their
// email and gets a one-time code. No passwords.

let appPromise: Promise<PublicClientApplication> | null = null;

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
    appPromise = pca.initialize().then(() => pca);
  }
  return appPromise;
}

export async function signIn(): Promise<void> {
  const pca = await getApp();
  await pca.loginRedirect({ scopes: [AUTH.apiScope] });
}

/** Call once on the page Microsoft sends people back to. */
export async function completeSignIn(): Promise<boolean> {
  const pca = await getApp();
  const result = await pca.handleRedirectPromise();
  if (result?.account) pca.setActiveAccount(result.account);
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

export async function isSignedIn(): Promise<boolean> {
  return (await currentAccount()) !== null;
}

export interface Tokens {
  accessToken: string;
  idToken: string;
}

/** Returns fresh tokens, or null when the person has to sign in again. */
export async function getTokens(): Promise<Tokens | null> {
  const pca = await getApp();
  const account = await currentAccount();
  if (!account) return null;
  try {
    const r = await pca.acquireTokenSilent({ scopes: [AUTH.apiScope], account });
    return { accessToken: r.accessToken, idToken: r.idToken };
  } catch (err) {
    // Any failure to refresh quietly means the same thing to the app:
    // ask the person to sign in again.
    if (!(err instanceof InteractionRequiredAuthError)) console.warn("Silent sign-in refresh failed", err);
    return null;
  }
}

export async function signOut(): Promise<void> {
  const pca = await getApp();
  const account = await currentAccount();
  await pca.logoutRedirect({ account: account ?? undefined });
}
