"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { message, useLoad } from "@/lib/useLoad";
import { Me } from "@/lib/useMe";
import { AppShell } from "@/components/AppShell";

interface Profile {
  name: string;
  email: string;
  phone: string | null;
  houseNumber: string;
  street: string;
  showPhone: boolean;
  showEmail: boolean;
  showHouseNumber: boolean;
  inDirectory: boolean;
}
interface Invites {
  invitesLeft: number | "unlimited";
  codes: { code: string; used: boolean; usedBy: string | null; active: boolean }[];
}

function ProfileForm({ me }: { me: Me }) {
  const { data, error } = useLoad<{ profile: Profile }>("/api/profile", true);
  const [p, setP] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const invites = useLoad<Invites>("/api/invites", true);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Invites | null>(null);

  useEffect(() => {
    if (data) setP(data.profile);
  }, [data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!p) return;
    setBusy(true);
    setSaved(false);
    setFormError(null);
    try {
      const r = await api<{ profile: Profile }>("/api/profile", {
        method: "POST",
        body: { phone: p.phone ?? "", showPhone: p.showPhone, showEmail: p.showEmail, showHouseNumber: p.showHouseNumber, inDirectory: p.inDirectory },
      });
      setP(r.profile);
      setSaved(true);
    } catch (err) {
      setFormError(message(err));
    }
    setBusy(false);
  }

  async function createCode() {
    setInviteBusy(true);
    setInviteError(null);
    try {
      setFresh(await api<Invites>("/api/invites", { method: "POST" }));
    } catch (err) {
      setInviteError(message(err));
    }
    setInviteBusy(false);
  }

  const inv = fresh ?? invites.data;
  const left = inv?.invitesLeft;

  return (
    <>
      {me.isAdmin && (
        <a className="button" href="/admin/">
          Review requests to join
        </a>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!p && !error && <p className="hint">Loading your profile...</p>}
      {p && (
        <form className="form" onSubmit={save}>
          <div className="card">
            <strong>{p.name}</strong>
            <span>
              {p.houseNumber} {p.street}
            </span>
            <span className="hint">{p.email}</span>
            <span className="hint">To change your name or address, ask the neighbor who runs Hello Capo Beach.</span>
          </div>

          <div className="field">
            <label htmlFor="phone">Phone number</label>
            <input id="phone" type="tel" autoComplete="tel" value={p.phone ?? ""} onChange={(e) => setP({ ...p, phone: e.target.value })} aria-describedby="phone-help" maxLength={30} />
            <span id="phone-help" className="hint">
              Hidden from neighbors unless you turn it on below.
            </span>
          </div>

          <fieldset className="card switches">
            <legend>What neighbors can see</legend>
            <p className="hint">Your name and street always show.</p>
            <label className="check">
              <input type="checkbox" checked={p.inDirectory} onChange={(e) => setP({ ...p, inDirectory: e.target.checked })} />
              List me in the directory
            </label>
            <label className="check">
              <input type="checkbox" checked={p.showPhone} onChange={(e) => setP({ ...p, showPhone: e.target.checked })} />
              Show my phone number
            </label>
            <label className="check">
              <input type="checkbox" checked={p.showEmail} onChange={(e) => setP({ ...p, showEmail: e.target.checked })} />
              Show my email
            </label>
            <label className="check">
              <input type="checkbox" checked={p.showHouseNumber} onChange={(e) => setP({ ...p, showHouseNumber: e.target.checked })} />
              Show my house number
            </label>
          </fieldset>

          {formError && (
            <p className="error" role="alert">
              {formError}
            </p>
          )}
          {saved && (
            <p className="saved" role="status">
              Saved.
            </p>
          )}
          <button type="submit" className="button" disabled={busy}>
            {busy ? "Saving..." : "Save changes"}
          </button>
        </form>
      )}

      <section className="card" aria-labelledby="invite-heading">
        <h2 id="invite-heading">Invite a neighbor</h2>
        <p className="hint">
          A code lets a Harbor Estates neighbor skip the wait. Each code works once.
          {left !== undefined && (left === "unlimited" ? " You can create as many as you need." : ` You have ${left} left.`)}
        </p>
        {inv && inv.codes.length > 0 && (
          <ul className="codes">
            {inv.codes.map((c) => (
              <li key={c.code}>
                <span className="code">{c.code}</span>
                <span className="hint">{c.used ? `Used${c.usedBy ? ` by ${c.usedBy}` : ""}` : c.active ? "Not used yet" : "Switched off"}</span>
              </li>
            ))}
          </ul>
        )}
        {(inviteError || invites.error) && (
          <p className="error" role="alert">
            {inviteError ?? invites.error}
          </p>
        )}
        <button type="button" className="button secondary" onClick={() => void createCode()} disabled={inviteBusy || left === 0 || !inv}>
          {inviteBusy ? "Creating..." : left === 0 ? "No codes left" : "Create an invite code"}
        </button>
      </section>

      <button type="button" className="link" onClick={() => void signOut()}>
        Sign out
      </button>
    </>
  );
}

export default function ProfilePage() {
  return (
    <AppShell tab="neighbors" title="My profile" back={{ href: "/neighbors/", label: "Back to Neighbors" }}>
      {(me) => <ProfileForm me={me} />}
    </AppShell>
  );
}
