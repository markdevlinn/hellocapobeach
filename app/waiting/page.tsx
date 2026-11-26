"use client";

import { signOut } from "@/lib/auth";
import { useMe } from "@/lib/useMe";
import { Loading } from "@/components/Brand";

export default function Waiting() {
  const { me, waking, error, reload } = useMe(["pending", "declined", "removed"]);
  if (error) return <Loading text={error} />;
  if (!me) return <Loading text={waking ? "Waking things up. This can take up to a minute..." : "One moment..."} />;

  const pending = me.state === "pending";
  return (
    <main className="page">
      <header className="brand">
        <h1>{pending ? "Thanks. You are on the list." : "This account is not active"}</h1>
        <p className="lede">
          {pending
            ? "A neighbor admin checks each request to keep this space for Harbor Estates residents only. You will get in as soon as you are approved."
            : "If you think this is a mistake, talk to the neighbor who runs Hello Capo Beach."}
        </p>
      </header>
      {pending && (
        <button type="button" className="button" onClick={() => void reload()}>
          Check again
        </button>
      )}
      <button type="button" className="link" onClick={() => void signOut()}>
        Sign out
      </button>
    </main>
  );
}
