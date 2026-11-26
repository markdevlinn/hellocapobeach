"use client";

import { useMe } from "@/lib/useMe";
import { Loading } from "@/components/Brand";

// A waypoint: looks up where this person stands and sends them to the right page.
export default function Start() {
  const { waking, error, reload } = useMe("route");
  if (error) {
    return (
      <main className="page">
        <header className="brand">
          <h1>We hit a snag</h1>
          <p className="lede">{error}</p>
        </header>
        <button type="button" className="button" onClick={() => void reload()}>
          Try again
        </button>
      </main>
    );
  }
  return <Loading text={waking ? "Waking things up. This can take up to a minute..." : "One moment..."} />;
}
