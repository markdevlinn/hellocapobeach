"use client";

import { useLoad } from "@/lib/useLoad";
import { AppShell } from "@/components/AppShell";

interface Neighbor {
  id: string;
  name: string;
  street: string;
  houseNumber: string | null;
  phone: string | null;
  email: string | null;
}

function Directory() {
  const { data, error } = useLoad<{ neighbors: Neighbor[] }>("/api/neighbors", true);
  return (
    <>
      <a className="button secondary" href="/profile/">
        Edit my profile
      </a>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="hint">Loading neighbors...</p>}
      {data?.neighbors.length === 0 && (
        <div className="card">
          <h2>Nobody is listed yet</h2>
          <p className="hint">The directory is opt-in. Turn on &quot;List me in the directory&quot; in your profile to be the first.</p>
        </div>
      )}
      {data?.neighbors.map((n) => (
        <div key={n.id} className="card person">
          <div className="avatar" aria-hidden="true">
            {n.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="stack grow">
            <strong>{n.name}</strong>
            <span className="hint">
              {n.houseNumber ? `${n.houseNumber} ` : ""}
              {n.street}
            </span>
            {!n.phone && !n.email && <span className="hint">Contact not shared</span>}
            {(n.phone || n.email) && (
              <div className="row">
                {n.phone && (
                  <a className="button secondary grow" href={`tel:${n.phone.replace(/[^0-9+]/g, "")}`}>
                    Call
                  </a>
                )}
                {n.email && (
                  <a className="button secondary grow" href={`mailto:${n.email}`}>
                    Email
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

export default function NeighborsPage() {
  return (
    <AppShell tab="neighbors" title="Neighbors" subtitle="Only neighbors who chose to be listed appear here.">
      {() => <Directory />}
    </AppShell>
  );
}
