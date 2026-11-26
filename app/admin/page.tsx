"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { Loading } from "@/components/Brand";

interface Pending {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  houseNumber: string;
  street: string;
}

export default function Admin() {
  const { me, waking, error } = useMe(["approved"]);
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ pending: Pending[] }>("/api/admin/pending");
      setPending(d.pending);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }, []);

  useEffect(() => {
    if (me?.isAdmin) void load();
  }, [me, load]);

  async function decide(id: string, decision: "approve" | "decline") {
    setBusyId(id);
    setMessage(null);
    try {
      await api(`/api/admin/members/${id}/${decision}`, { method: "POST" });
      await load();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
    setBusyId(null);
  }

  if (error) return <Loading text={error} />;
  if (!me) return <Loading text={waking ? "Waking things up. This can take up to a minute..." : "One moment..."} />;
  if (!me.isAdmin) {
    return (
      <main className="page">
        <header className="brand">
          <h1>Admins only</h1>
          <p className="lede">This page is for the neighbors who run Hello Capo Beach.</p>
        </header>
        <a className="button" href="/home/">
          Back to home
        </a>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="brand">
        <a className="back" href="/home/">
          Back to home
        </a>
        <h1>Requests to join</h1>
        <p className="lede">Only admins see this page.</p>
      </header>

      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}

      {pending === null && <p className="hint">Loading...</p>}
      {pending?.length === 0 && (
        <div className="card">
          <h2>Nobody is waiting</h2>
          <p className="hint">New requests from neighbors without an invite code show up here.</p>
        </div>
      )}
      {pending?.map((p) => (
        <article className="card" key={p.id}>
          <h2>{p.name}</h2>
          <p>
            {p.houseNumber} {p.street}
          </p>
          <p className="hint">
            {p.email}
            {p.phone ? `, ${p.phone}` : ""}
          </p>
          <div className="row">
            <button type="button" className="button grow" disabled={busyId === p.id} onClick={() => void decide(p.id, "approve")}>
              Approve
            </button>
            <button type="button" className="button secondary grow" disabled={busyId === p.id} onClick={() => void decide(p.id, "decline")}>
              Decline
            </button>
          </div>
        </article>
      ))}
    </main>
  );
}
