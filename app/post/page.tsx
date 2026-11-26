"use client";

import { FormEvent, useEffect, useState } from "react";
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
  authorId: string;
  author: string;
  street: string;
}
interface Comment {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  authorId: string;
  author: string;
  street: string;
}

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

function Thread({ id, me }: { id: string; me: Me }) {
  const { data, error, reload } = useLoad<{ post: Post; comments: Comment[] }>(`/api/posts/${id}`, true);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function act(path: string, after?: () => void) {
    setFormError(null);
    try {
      await api(path, { method: "POST" });
      if (after) after();
      else await reload();
    } catch (err) {
      setFormError(message(err));
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setFormError(null);
    try {
      await api(`/api/posts/${id}/comments`, { method: "POST", body: { body: f.get("body"), parentId: replyTo?.id ?? null } });
      form.reset();
      setReplyTo(null);
      await reload();
    } catch (err) {
      setFormError(message(err));
    }
    setBusy(false);
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  }
  if (!data) return <p className="hint">Loading...</p>;

  const { post, comments } = data;
  const top = comments.filter((c) => !c.parentId);
  const repliesTo = (cid: string) => comments.filter((c) => same(c.parentId ?? undefined, cid));
  const mayRemove = (ownerId: string) => me.isAdmin || same(me.id, ownerId);

  const renderComment = (c: Comment, isReply: boolean) => (
    <div key={c.id} className={isReply ? "card comment reply" : "card comment"}>
      <span className="byline">
        <strong>{c.author}</strong> {c.street}. {timeAgo(c.createdAt)}
      </span>
      <p>{c.body}</p>
      <div className="actions">
        <button type="button" className="link" onClick={() => setReplyTo(c)}>
          Reply
        </button>
        {mayRemove(c.authorId) && (
          <button type="button" className="link danger" onClick={() => void act(`/api/comments/${c.id}/remove`)}>
            Remove
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <article className={post.pinned ? "card pinned" : "card"}>
        <span className="tag">{post.pinned ? "Pinned announcement" : CATEGORY_LABEL[post.category]}</span>
        <h2>{post.title}</h2>
        {post.body && <p className="prose">{post.body}</p>}
        <span className="hint">
          {post.author}, {post.street}. {timeAgo(post.createdAt)}
        </span>
        <div className="actions">
          {me.isAdmin && (
            <button type="button" className="link" onClick={() => void act(`/api/posts/${id}/${post.pinned ? "unpin" : "pin"}`)}>
              {post.pinned ? "Unpin" : "Pin to top"}
            </button>
          )}
          {mayRemove(post.authorId) && (
            <button type="button" className="link danger" onClick={() => void act(`/api/posts/${id}/remove`, () => (window.location.href = "/home/"))}>
              Remove post
            </button>
          )}
        </div>
      </article>

      <h2 className="section">{comments.length === 1 ? "1 comment" : `${comments.length} comments`}</h2>
      {top.map((c) => (
        <div key={c.id} className="stack">
          {renderComment(c, false)}
          {repliesTo(c.id).map((r) => renderComment(r, true))}
        </div>
      ))}

      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="comment">{replyTo ? `Reply to ${replyTo.author}` : "Add a comment"}</label>
          <textarea id="comment" name="body" rows={3} required maxLength={2000} />
        </div>
        {formError && (
          <p className="error" role="alert">
            {formError}
          </p>
        )}
        <div className="row">
          <button type="submit" className="button grow" disabled={busy}>
            {busy ? "Posting..." : replyTo ? "Post reply" : "Post comment"}
          </button>
          {replyTo && (
            <button type="button" className="button secondary grow" onClick={() => setReplyTo(null)}>
              Cancel reply
            </button>
          )}
        </div>
      </form>
    </>
  );
}

export default function PostPage() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("id") ?? "");
  }, []);

  return (
    <AppShell tab="home" title="Post" back={{ href: "/home/", label: "Back to Home" }}>
      {(me) => (id === null ? <p className="hint">Loading...</p> : id === "" ? <p className="error">That post was not found.</p> : <Thread id={id} me={me} />)}
    </AppShell>
  );
}
