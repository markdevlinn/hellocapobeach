"use client";

import { useEffect, useState } from "react";
import { lastAuthProblem, signInFresh } from "@/lib/auth";

export function Mark({ size = 56 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="20" r="11" fill="var(--sun)" />
      <path d="M4 34c5 0 5-4 10-4s5 4 10 4 5-4 10-4 5 4 10 4" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M4 43c5 0 5-4 10-4s5 4 10 4 5-4 10-4 5 4 10 4" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A quiet full-page message used while something loads.
 * If it is still showing after a while, it offers a way out so nobody is left stuck.
 */
export function Loading({ text }: { text: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="page">
      <header className="brand">
        <Mark />
        <p className="lede" role="status">
          {text}
        </p>
      </header>
      {slow && (
        <div className="stack">
          <p>This is taking longer than it should.</p>
          <button type="button" className="button" onClick={() => window.location.reload()}>
            Try again
          </button>
          <button type="button" className="button secondary" onClick={() => void signInFresh()}>
            Sign in again
          </button>
          {lastAuthProblem && <p className="hint">Detail for support: {lastAuthProblem}</p>}
        </div>
      )}
    </main>
  );
}
