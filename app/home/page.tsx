"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { CATEGORY_LABEL, timeAgo } from "@/lib/format";
import { message, useLoad } from "@/lib/useLoad";
import { Me } from "@/lib/useMe";
import { AppShell } from "@/components/AppShell";

interface Post {
  id: string;
  category: string;
  title: string;
  body: string | null;
  pinned: boolean;
  createdAt: string;
  author: string;
  street: string;
  comments: number;
}

const FILTERS = [
  { id: "", label: "All" },
  { id: "safety", label: "Safety" },
  { id: "lost_found", label: "Lost and Found" },
  { id: "recommendations", label: "Recommendations" },
  { id: "general", label: "General" },
];

const NUDGE_KEY = "hcb.directoryNudgeDismissed";

/** Shown once to members who are not in the directory. It stays their choice. */
function DirectoryNudge({ me }: { me: Me }) {
  const [show, setShow] = useState(() => {
    if (me.inDirectory !== false) return false;
    try {
      return window.localStorage.getItem(NUDGE_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function dismiss() {
    try {
      window.localStorage.setItem(NUDGE_KEY, "1");
    } catch {
      // fine: it will simply ask again next time
    }
    setShow(false);
  }

  async function listMe() {
    setBusy(true);
    setError(null);
    try {
      const current = await api<{ profile: { phone: string | null; showPhone: boolean; showEmail: boolean; showHouseNumber: boolean } }>("/api/profile");
      await api("/api/profile", {
        method: "POST",
        body: { phone: current.profile.phone ?? "", showPhone: current.profile.showPhone, showEmail: current.profile.showEmail, showHouseNumber: current.profile.showHouseNumber, inDirectory: true },
      });
      setDone(true);
      try {
        window.localStorage.setItem(NUDGE_KEY, "1");
      } catch {
        // ignore
      }
    } catch (err) {
      setError(message(err));
    }
    setBusy(false);
  }

  if (!show) return null;
  if (done) {
    return (
      <div className="card">
        <strong>You are listed.</strong>
        <p className="hint">Neighbors can now find your name and street. You can change this any time in your profile.</p>
      </div>
    );
  }
  return (
    <div className="card">
      <h2>Want neighbors to be able to find you?</h2>
      <p className="hint">The Neighbors list only shows people who choose to be on it. It shows your name and street. Your phone, email and house number stay hidden unless you turn them on.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="button" className="button grow" disabled={busy} onClick={() => void listMe()}>
          {busy ? "Saving..." : "List me"}
        </button>
        <button type="button" className="button secondary grow" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}

function Feed({ me }: { me: Me }) {
  const [filter, setFilter] = useState("");
  const { data, error, reload } = useLoad<{ posts: Post[] }>(`/api/posts${filter ? `?category=${filter}` : ""}`, true);
  const [writing, setWriting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setFormError(null);
    try {
      await api("/api/posts", { method: "POST", body: { category: f.get("category"), title: f.get("title"), body: f.get("body") } });
      form.reset();
      setWriting(false);
      await reload();
    } catch (err) {
      setFormError(message(err));
    }
    setBusy(false);
  }

  return (
    <>
      <DirectoryNudge me={me} />
      <div className="chips" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={filter === f.id ? "chip on" : "chip"} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {!writing && (
        <button type="button" className="button" onClick={() => setWriting(true)}>
          Write a post
        </button>
      )}
      {writing && (
        <form className="card form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="category">What is it about?</label>
            <select id="category" name="category" defaultValue="general">
              <option value="general">General</option>
              <option value="safety">Safety</option>
              <option value="lost_found">Lost and Found</option>
              <option value="recommendations">Recommendations</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" name="title" type="text" required maxLength={140} />
          </div>
          <div className="field">
            <label htmlFor="body">Details (optional)</label>
            <textarea id="body" name="body" rows={4} maxLength={5000} />
          </div>
          {formError && (
            <p className="error" role="alert">
              {formError}
            </p>
          )}
          <div className="row">
            <button type="submit" className="button grow" disabled={busy}>
              {busy ? "Posting..." : "Post"}
            </button>
            <button type="button" className="button secondary grow" onClick={() => setWriting(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="hint">Loading posts...</p>}
      {data?.posts.length === 0 && (
        <div className="card">
          <h2>Nothing here yet</h2>
          <p className="hint">Be the first. Say hello, share a heads-up, or ask for a recommendation.</p>
        </div>
      )}
      {data?.posts.map((p) => (
        <a key={p.id} className={p.pinned ? "card post pinned" : "card post"} href={`/post/?id=${p.id}`}>
          <span className="tag">{p.pinned ? "Pinned announcement" : CATEGORY_LABEL[p.category]}</span>
          <h2>{p.title}</h2>
          {p.body && <p className="clamp">{p.body}</p>}
          <span className="hint">
            {p.author}, {p.street}. {timeAgo(p.createdAt)}. {p.comments === 1 ? "1 comment" : `${p.comments} comments`}
          </span>
        </a>
      ))}
    </>
  );
}

export default function Home() {
  return (
    <AppShell tab="home" title="Hello Capo Beach">
      {(me) => <Feed me={me} />}
    </AppShell>
  );
}
