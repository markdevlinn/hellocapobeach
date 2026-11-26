"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CATEGORY_LABEL, KIND_LABEL, timeAgo } from "@/lib/format";
import { message, useLoad } from "@/lib/useLoad";
import { Me } from "@/lib/useMe";
import { AppShell } from "@/components/AppShell";
import { ConfirmButton } from "@/components/ConfirmButton";

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  houseNumber: string;
  streetId: number | null;
  street: string;
  status: "pending" | "approved" | "declined" | "removed";
  role: "resident" | "admin";
  inDirectory: boolean;
  joinedAt: string;
  invitedBy: string | null;
}
interface Content {
  posts: { id: string; title: string; category: string; pinned: boolean; createdAt: string; author: string }[];
  comments: { id: string; body: string; createdAt: string; author: string; postId: string; postTitle: string }[];
  events: { id: string; title: string; place: string; startsAt: string; author: string }[];
  listings: { id: string; title: string; kind: string; sold: boolean; createdAt: string; author: string }[];
}
interface Invite {
  code: string;
  createdBy: string | null;
  usedBy: string | null;
  used: boolean;
  active: boolean;
}
interface Street {
  id: number;
  name: string;
}

const SECTIONS = ["Members", "Posts", "Comments", "Events", "Listings", "Invites"] as const;
type Section = (typeof SECTIONS)[number];

const STATUS_LABEL: Record<Member["status"], string> = { pending: "Waiting", approved: "Member", declined: "Declined", removed: "Removed" };

function MemberCard({ m, me, streets, onChange, setError }: { m: Member; me: Me; streets: Street[]; onChange: () => Promise<void>; setError: (s: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const isMe = !!me.id && me.id.toLowerCase() === m.id.toLowerCase();

  async function decide(decision: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/manage/members/${m.id}/${decision}`, { method: "POST" });
      await onChange();
    } catch (err) {
      setError(message(err));
    }
    setBusy(false);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api(`/api/manage/members/${m.id}/edit`, { method: "POST", body: { fullName: f.get("fullName"), streetId: Number(f.get("streetId")), houseNumber: f.get("houseNumber") } });
      setEditing(false);
      await onChange();
    } catch (err) {
      setError(message(err));
    }
    setBusy(false);
  }

  return (
    <article className="card">
      <span className="tag">
        {STATUS_LABEL[m.status]}
        {m.role === "admin" ? ", admin" : ""}
        {isMe ? " (you)" : ""}
      </span>
      <h2>{m.name}</h2>
      <span>
        {m.houseNumber} {m.street}
      </span>
      <span className="hint">
        {m.email}
        {m.phone ? `, ${m.phone}` : ""}
      </span>
      <span className="hint">
        Joined {timeAgo(m.joinedAt)}. {m.invitedBy ? `Invited by ${m.invitedBy}.` : "No invite code."} {m.status === "approved" ? (m.inDirectory ? "Listed in the directory." : "Not listed in the directory.") : ""}
      </span>

      {editing && (
        <form className="form" onSubmit={save}>
          <div className="field">
            <label htmlFor={`n-${m.id}`}>Name</label>
            <input id={`n-${m.id}`} name="fullName" type="text" defaultValue={m.name} required maxLength={80} />
          </div>
          <div className="row">
            <div className="field grow">
              <label htmlFor={`s-${m.id}`}>Street</label>
              <select id={`s-${m.id}`} name="streetId" defaultValue={m.streetId ?? ""} required>
                {streets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field house">
              <label htmlFor={`h-${m.id}`}>House no.</label>
              <input id={`h-${m.id}`} name="houseNumber" type="text" defaultValue={m.houseNumber} required maxLength={7} />
            </div>
          </div>
          <div className="row">
            <button type="submit" className="button grow" disabled={busy}>
              Save
            </button>
            <button type="button" className="button secondary grow" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {!editing && m.status === "pending" && (
        <div className="row">
          <button type="button" className="button grow" disabled={busy} onClick={() => void decide("approve")}>
            Approve
          </button>
          <button type="button" className="button secondary grow" disabled={busy} onClick={() => void decide("decline")}>
            Decline
          </button>
        </div>
      )}
      {!editing && (
        <div className="actions">
          <button type="button" className="link" onClick={() => setEditing(true)}>
            Edit name or address
          </button>
          {m.status === "approved" && !isMe && <ConfirmButton label="Remove member" confirmLabel="Tap again to remove" disabled={busy} onConfirm={() => void decide("remove")} />}
          {(m.status === "removed" || m.status === "declined") && (
            <button type="button" className="link" disabled={busy} onClick={() => void decide("restore")}>
              Let back in
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function AdminArea({ me }: { me: Me }) {
  const [section, setSection] = useState<Section>("Members");
  const members = useLoad<{ members: Member[] }>("/api/manage/members", true);
  const content = useLoad<Content>("/api/manage/content", true);
  const invites = useLoad<{ invites: Invite[] }>("/api/manage/invites", true);
  const [streets, setStreets] = useState<Street[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ streets: Street[] }>("/api/streets", { auth: false })
      .then((d) => setStreets(d.streets))
      .catch(() => undefined);
  }, []);

  async function act(path: string, reload: () => Promise<void>) {
    setError(null);
    try {
      await api(path, { method: "POST" });
      await reload();
    } catch (err) {
      setError(message(err));
    }
  }

  const waiting = members.data?.members.filter((m) => m.status === "pending").length ?? 0;
  const loadError = members.error ?? content.error ?? invites.error;

  return (
    <>
      <div className="chips" role="group" aria-label="Admin sections">
        {SECTIONS.map((s) => (
          <button key={s} type="button" className={section === s ? "chip on" : "chip"} aria-pressed={section === s} onClick={() => setSection(s)}>
            {s}
            {s === "Members" && waiting > 0 ? ` (${waiting} waiting)` : ""}
          </button>
        ))}
      </div>

      {(error || loadError) && (
        <p className="error" role="alert">
          {error ?? loadError}
        </p>
      )}

      {section === "Members" && (
        <>
          {!members.data && <p className="hint">Loading members...</p>}
          {members.data && <p className="hint">{members.data.members.length === 1 ? "1 person" : `${members.data.members.length} people`}. Anyone waiting is at the top.</p>}
          {members.data?.members.map((m) => <MemberCard key={m.id} m={m} me={me} streets={streets} onChange={members.reload} setError={setError} />)}
        </>
      )}

      {section === "Posts" && (
        <>
          {!content.data && <p className="hint">Loading posts...</p>}
          {content.data?.posts.length === 0 && <p className="hint">No posts yet.</p>}
          {content.data?.posts.map((p) => (
            <article key={p.id} className="card">
              <span className="tag">{p.pinned ? "Pinned" : CATEGORY_LABEL[p.category]}</span>
              <a href={`/post/?id=${p.id}`}>
                <strong>{p.title}</strong>
              </a>
              <span className="hint">
                {p.author}. {timeAgo(p.createdAt)}
              </span>
              <div className="actions">
                <button type="button" className="link" onClick={() => void act(`/api/posts/${p.id}/${p.pinned ? "unpin" : "pin"}`, content.reload)}>
                  {p.pinned ? "Unpin" : "Pin to top"}
                </button>
                <ConfirmButton label="Remove post" confirmLabel="Tap again to remove" onConfirm={() => void act(`/api/posts/${p.id}/remove`, content.reload)} />
              </div>
            </article>
          ))}
        </>
      )}

      {section === "Comments" && (
        <>
          {!content.data && <p className="hint">Loading comments...</p>}
          {content.data?.comments.length === 0 && <p className="hint">No comments yet.</p>}
          {content.data?.comments.map((c) => (
            <article key={c.id} className="card">
              <p className="prose">{c.body}</p>
              <span className="hint">
                {c.author}. {timeAgo(c.createdAt)}. On <a href={`/post/?id=${c.postId}`}>{c.postTitle}</a>
              </span>
              <div className="actions">
                <ConfirmButton label="Remove comment" confirmLabel="Tap again to remove" onConfirm={() => void act(`/api/comments/${c.id}/remove`, content.reload)} />
              </div>
            </article>
          ))}
        </>
      )}

      {section === "Events" && (
        <>
          {!content.data && <p className="hint">Loading events...</p>}
          {content.data?.events.length === 0 && <p className="hint">No events yet.</p>}
          {content.data?.events.map((ev) => (
            <article key={ev.id} className="card">
              <strong>{ev.title}</strong>
              <span className="hint">
                {new Date(ev.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. {ev.place}. Posted by {ev.author}
              </span>
              <div className="actions">
                <ConfirmButton label="Remove event" confirmLabel="Tap again to remove" onConfirm={() => void act(`/api/events/${ev.id}/remove`, content.reload)} />
              </div>
            </article>
          ))}
        </>
      )}

      {section === "Listings" && (
        <>
          {!content.data && <p className="hint">Loading listings...</p>}
          {content.data?.listings.length === 0 && <p className="hint">No listings yet.</p>}
          {content.data?.listings.map((l) => (
            <article key={l.id} className="card">
              <span className="tag">
                {KIND_LABEL[l.kind]}
                {l.sold ? ", sold" : ""}
              </span>
              <strong>{l.title}</strong>
              <span className="hint">
                {l.author}. {timeAgo(l.createdAt)}
              </span>
              <div className="actions">
                <ConfirmButton label="Remove listing" confirmLabel="Tap again to remove" onConfirm={() => void act(`/api/listings/${l.id}/remove`, content.reload)} />
              </div>
            </article>
          ))}
        </>
      )}

      {section === "Invites" && (
        <>
          {!invites.data && <p className="hint">Loading invite codes...</p>}
          {invites.data?.invites.length === 0 && <p className="hint">No invite codes have been created yet.</p>}
          {invites.data?.invites.map((c) => (
            <article key={c.code} className="card">
              <span className="code">{c.code}</span>
              <span className="hint">
                Created by {c.createdBy ?? "an admin"}. {c.used ? `Used by ${c.usedBy ?? "a former member"}.` : c.active ? "Not used yet." : "Switched off."}
              </span>
              {!c.used && c.active && (
                <div className="actions">
                  <ConfirmButton label="Switch off this code" confirmLabel="Tap again to switch off" onConfirm={() => void act(`/api/manage/invites/${c.code.replace("-", "")}/off`, invites.reload)} />
                </div>
              )}
            </article>
          ))}
        </>
      )}
    </>
  );
}

export default function AdminPage() {
  return (
    <AppShell tab="neighbors" title="Admin area" back={{ href: "/profile/", label: "Back to my profile" }}>
      {(me) =>
        me.isAdmin ? (
          <AdminArea me={me} />
        ) : (
          <div className="card">
            <h2>Admins only</h2>
            <p className="hint">This page is for the neighbors who run Hello Capo Beach.</p>
          </div>
        )
      }
    </AppShell>
  );
}
