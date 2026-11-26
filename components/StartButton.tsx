"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTokens, signIn } from "@/lib/auth";
import { isRemembered } from "@/lib/api";

// The one action on the welcome page. Signing in and asking to join start the
// same way: type your email, get a code.
export function StartButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only skip ahead when this device holds a sign-in that still works.
    // If it does not, stay here and show the button.
    // A remembered device goes straight in. If that turns out to have expired,
    // the next page clears it and sends the person back here.
    if (isRemembered()) {
      router.replace("/start/");
      return;
    }
    getTokens()
      .then((tokens) => {
        if (tokens) router.replace("/start/");
      })
      .catch(() => undefined);
  }, [router]);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch {
      setBusy(false);
      setError("Sign-in could not start. Please try again.");
    }
  }

  return (
    <div className="stack">
      <button type="button" className="button" onClick={go} disabled={busy}>
        {busy ? "Opening sign-in..." : "Sign in or join"}
      </button>
      <p className="hint">We email you a one-time code. There is no password to remember.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
