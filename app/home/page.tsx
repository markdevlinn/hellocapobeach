"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { useMe } from "@/lib/useMe";
import { Loading } from "@/components/Brand";

interface Invite {
  code: string;
  used: boolean;
  usedBy: string | null;
  active: boolean;
}
interface Invites {
  invitesLeft: number | "unlimited";
  codes: Invite[];
}

export default function Home() {
  const { me, waking, error } = useMe(["approved"]);
  const [invites, setInvites] = useState<Invites | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    api<Invites>("/api/invites")
      .then(setInvites)
      .catch(() => setInviteError("We could not load your invite codes."));
  }, [me]);

  async function createCode() {
    setBusy(true);
    setInviteError(null);
    try {
      setInvites(await api<Invites>("/api/invites", { method: "POST" }));
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
    setBusy(false);
  }

  if (error) return <Loading text={error} />;
  if (!me) return <Loading text={waking ? "Waking things up. This can take up to a minute..." : "One moment..."} />;

  const left = invites?.invitesLeft;
  return (
    <main className="page">
      <header className="brand">
        <h1>Hello, {me.name?.split(" ")[0]}</h1>
        <p className="lede">You are in. The neighborhood feed, events and marketplace are being built and will appear here.</p>
      </header>

      {me.isAdmin && (
        <a className="button" href="/admin/">
          Review requests to join
        </a>
      )}

      <section className="card" aria-labelledby="invite-heading">
        <h2 id="invite-heading">Invite a neighbor</h2>
        <p className="hint">
          A code lets a Harbor Estates neighbor skip the wait. Each code works once.
          {left !== undefined && (left === "unlimited" ? " You can create as many as you need." : ` You have ${left} left.`)}
        </p>
        {invites && invites.codes.length > 0 && (
          <ul className="codes">
            {invites.codes.map((c) => (
              <li key={c.code}>
                <span className="code">{c.code}</span>
                <span className="hint">{c.used ? `Used${c.usedBy ? ` by ${c.usedBy}` : ""}` : c.active ? "Not used yet" : "Switched off"}</span>
              </li>
            ))}
          </ul>
        )}
        {inviteError && (
          <p className="error" role="alert">
            {inviteError}
          </p>
        )}
        <button type="button" className="button secondary" onClick={() => void createCode()} disabled={busy || left === 0 || !invites}>
          {busy ? "Creating..." : left === 0 ? "No codes left" : "Create an invite code"}
        </button>
      </section>

      <button type="button" className="link" onClick={() => void signOut()}>
        Sign out
      </button>
    </main>
  );
}
