"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { KIND_LABEL, money, timeAgo } from "@/lib/format";
import { message, useLoad } from "@/lib/useLoad";
import { Me } from "@/lib/useMe";
import { AppShell } from "@/components/AppShell";

interface Listing {
  id: string;
  kind: string;
  title: string;
  details: string | null;
  priceCents: number | null;
  sold: boolean;
  contactPhone: string | null;
  contactEmail: string | null;
  createdAt: string;
  sellerId: string;
  seller: string;
  street: string;
}

const FILTERS = [
  { id: "", label: "All" },
  { id: "for_sale", label: "For sale" },
  { id: "free", label: "Free" },
  { id: "wanted", label: "Wanted" },
];

function Market({ me }: { me: Me }) {
  const [filter, setFilter] = useState("");
  const { data, error, reload } = useLoad<{ listings: Listing[] }>(`/api/listings${filter ? `?kind=${filter}` : ""}`, true);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState("for_sale");
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
    setBusy(true);
    setFormError(null);
    try {
      await api("/api/listings", {
        method: "POST",
        body: { kind, title: f.get("title"), details: f.get("details"), price: f.get("price") ?? "", contactPhone: f.get("contactPhone"), contactEmail: f.get("contactEmail") },
      });
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
      <div className="chips" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={filter === f.id ? "chip on" : "chip"} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {!adding && (
        <button type="button" className="button" onClick={() => setAdding(true)}>
          List an item
        </button>
      )}
      {adding && (
        <form className="card form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="kind">Type</label>
            <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="for_sale">For sale</option>
              <option value="free">Free</option>
              <option value="wanted">Wanted</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="title">What is it?</label>
            <input id="title" name="title" type="text" required maxLength={140} />
          </div>
          {kind === "for_sale" && (
            <div className="field">
              <label htmlFor="price">Price in dollars</label>
              <input id="price" name="price" type="text" inputMode="decimal" required maxLength={12} />
            </div>
          )}
          <div className="field">
            <label htmlFor="details">Details (optional)</label>
            <textarea id="details" name="details" rows={3} maxLength={5000} />
          </div>
          <div className="field">
            <label htmlFor="contactPhone">Phone for this listing</label>
            <input id="contactPhone" name="contactPhone" type="tel" autoComplete="tel" maxLength={30} />
          </div>
          <div className="field">
            <label htmlFor="contactEmail">Email for this listing</label>
            <input id="contactEmail" name="contactEmail" type="email" autoComplete="email" defaultValue={me.email ?? ""} aria-describedby="contact-help" maxLength={254} />
            <span id="contact-help" className="hint">
              Neighbors see this on the listing so they can reach you. Give a phone number, an email, or both.
            </span>
          </div>
          {formError && (
            <p className="error" role="alert">
              {formError}
            </p>
          )}
          <div className="row">
            <button type="submit" className="button grow" disabled={busy}>
              {busy ? "Saving..." : "List it"}
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
      {!data && !error && <p className="hint">Loading listings...</p>}
      {data?.listings.length === 0 && (
        <div className="card">
          <h2>Nothing listed yet</h2>
          <p className="hint">Selling, giving away or looking for something? List it for your neighbors.</p>
        </div>
      )}
      {data?.listings.map((l) => {
        const mine = !!me.id && me.id.toLowerCase() === l.sellerId.toLowerCase();
        return (
          <article key={l.id} className={l.sold ? "card listing sold" : "card listing"}>
            <span className="tag">{KIND_LABEL[l.kind]}</span>
            <h2>{l.title}</h2>
            <span className="price">{l.sold ? <span className="badge">Sold</span> : l.kind === "for_sale" && l.priceCents !== null ? money(l.priceCents) : l.kind === "free" ? "Free" : "Wanted"}</span>
            {l.details && <p className="prose">{l.details}</p>}
            <span className="hint">
              {l.seller}, {l.street}. {timeAgo(l.createdAt)}
            </span>
            {!l.sold && !mine && (
              <div className="row">
                {l.contactPhone && (
                  <a className="button secondary grow" href={`tel:${l.contactPhone.replace(/[^0-9+]/g, "")}`}>
                    Call
                  </a>
                )}
                {l.contactEmail && (
                  <a className="button secondary grow" href={`mailto:${l.contactEmail}?subject=${encodeURIComponent(l.title)}`}>
                    Email
                  </a>
                )}
              </div>
            )}
            <div className="actions">
              {mine && (
                <button type="button" className="link" onClick={() => void act(`/api/listings/${l.id}/${l.sold ? "unsold" : "sold"}`)}>
                  {l.sold ? "Mark as available" : l.kind === "wanted" ? "Mark as found" : "Mark as sold"}
                </button>
              )}
              {(mine || me.isAdmin) && (
                <button type="button" className="link danger" onClick={() => void act(`/api/listings/${l.id}/remove`)}>
                  Remove listing
                </button>
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}

export default function MarketPage() {
  return (
    <AppShell tab="market" title="Market" subtitle="Buy, sell and give away among neighbors">
      {(me) => <Market me={me} />}
    </AppShell>
  );
}
