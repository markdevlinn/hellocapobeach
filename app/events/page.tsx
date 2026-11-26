"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { eventDate } from "@/lib/format";
import { message, useLoad } from "@/lib/useLoad";
import { Me } from "@/lib/useMe";
import { AppShell } from "@/components/AppShell";

interface Event {
  id: string;
  title: string;
  details: string | null;
  place: string;
  startsAt: string;
  createdBy: string;
  host: string;
  going: number;
  iAmGoing: boolean;
}

function Events({ me }: { me: Me }) {
  const { data, error, reload } = useLoad<{ events: Event[] }>("/api/events", true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function act(path: string) {
    setFormError(null);
    try {
      await api(path, { method: "POST" });
      await reload();
    } catch (err) {
      setFormError(message(err));
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const when = new Date(`${f.get("date")}T${f.get("time")}`);
    if (Number.isNaN(when.getTime())) {
      setFormError("Please choose a date and time.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api("/api/events", { method: "POST", body: { title: f.get("title"), place: f.get("place"), details: f.get("details"), startsAt: when.toISOString() } });
      form.reset();
      setAdding(false);
      await reload();
    } catch (err) {
      setFormError(message(err));
    }
    setBusy(false);
  }

  return (
    <>
      {!adding && (
        <button type="button" className="button" onClick={() => setAdding(true)}>
          Add an event
        </button>
      )}
      {adding && (
        <form className="card form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="title">What is it?</label>
            <input id="title" name="title" type="text" required maxLength={140} />
          </div>
          <div className="row">
            <div className="field grow">
              <label htmlFor="date">Date</label>
              <input id="date" name="date" type="date" required />
            </div>
            <div className="field grow">
              <label htmlFor="time">Time</label>
              <input id="time" name="time" type="time" required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="place">Where?</label>
            <input id="place" name="place" type="text" required maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor="details">Details (optional)</label>
            <textarea id="details" name="details" rows={3} maxLength={5000} />
          </div>
          {formError && (
            <p className="error" role="alert">
              {formError}
            </p>
          )}
          <div className="row">
            <button type="submit" className="button grow" disabled={busy}>
              {busy ? "Saving..." : "Add event"}
            </button>
            <button type="button" className="button secondary grow" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {!adding && formError && (
        <p className="error" role="alert">
          {formError}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="hint">Loading events...</p>}
      {data?.events.length === 0 && (
        <div className="card">
          <h2>No events yet</h2>
          <p className="hint">Planning a block party, a beach walk or a kids&apos; bike parade? Add it here.</p>
        </div>
      )}
      {data?.events.map((ev) => {
        const d = eventDate(ev.startsAt);
        const mine = me.isAdmin || (!!me.id && me.id.toLowerCase() === ev.createdBy.toLowerCase());
        return (
          <article key={ev.id} className="card event">
            <div className="datebox" aria-hidden="true">
              <span>{d.month}</span>
              <strong>{d.day}</strong>
            </div>
            <div className="stack grow">
              <h2>{ev.title}</h2>
              <span>{d.line}</span>
              <span className="hint">{ev.place}</span>
              {ev.details && <p className="prose">{ev.details}</p>}
              <span className="hint">
                Posted by {ev.host}. {ev.going === 1 ? "1 neighbor going" : `${ev.going} neighbors going`}
              </span>
              {ev.iAmGoing ? (
                <div className="actions">
                  <strong>You are going.</strong>
                  <button type="button" className="link" onClick={() => void act(`/api/events/${ev.id}/notgoing`)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className="button" onClick={() => void act(`/api/events/${ev.id}/going`)}>
                  I&apos;m going
                </button>
              )}
              {mine && (
                <button type="button" className="link danger" onClick={() => void act(`/api/events/${ev.id}/remove`)}>
                  Remove event
                </button>
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}

export default function EventsPage() {
  return (
    <AppShell tab="events" title="Events" subtitle="Coming up in Harbor Estates">
      {(me) => <Events me={me} />}
    </AppShell>
  );
}
