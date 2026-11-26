"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, SignInNeeded } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { useMe } from "@/lib/useMe";
import { Loading } from "@/components/Brand";

interface Street {
  id: number;
  name: string;
}

const NOT_LISTED = "not-listed";

export default function Join() {
  const router = useRouter();
  const { me, waking, error: meError } = useMe(["none"]);
  const [streets, setStreets] = useState<Street[] | null>(null);
  const [street, setStreet] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ streets: Street[] }>("/api/streets", { auth: false })
      .then((d) => setStreets(d.streets))
      .catch(() => setError("We could not load the street list. Please refresh the page."));
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    if (street === NOT_LISTED || street === "") {
      setError(street === "" ? "Please choose your street." : "Hello Capo Beach is open to Harbor Estates streets only for now.");
      return;
    }
    if (!agreed) {
      setError("Please tick the box to agree to the house rules.");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ state: string }>("/api/signup", {
        method: "POST",
        body: {
          fullName: f.get("fullName"),
          streetId: Number(street),
          houseNumber: f.get("houseNumber"),
          phone: f.get("phone"),
          inviteCode: f.get("inviteCode"),
        },
      });
      router.replace(r.state === "approved" ? "/home/" : "/waiting/");
    } catch (err) {
      setBusy(false);
      if (err instanceof SignInNeeded) router.replace("/");
      else setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (meError) return <Loading text={meError} />;
  if (!me) return <Loading text={waking ? "Waking things up. This can take up to a minute..." : "One moment..."} />;

  return (
    <main className="page">
      <header className="brand">
        <h1>Ask to join</h1>
        <p className="lede">For Harbor Estates neighbors. Signed in as {me.email ?? "your email"}.</p>
      </header>

      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="fullName">Your name</label>
          <input id="fullName" name="fullName" type="text" autoComplete="name" required maxLength={80} />
        </div>

        <div className="row">
          <div className="field grow">
            <label htmlFor="street">Street</label>
            <select id="street" value={street} onChange={(e) => setStreet(e.target.value)} required disabled={!streets}>
              <option value="">{streets ? "Choose your street" : "Loading..."}</option>
              {streets?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value={NOT_LISTED}>My street is not listed</option>
            </select>
          </div>
          <div className="field house">
            <label htmlFor="houseNumber">House no.</label>
            <input id="houseNumber" name="houseNumber" type="text" inputMode="numeric" required maxLength={7} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="phone">Phone number (optional)</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" aria-describedby="phone-help" maxLength={30} />
          <span id="phone-help" className="hint">
            Hidden from neighbors unless you choose to show it later.
          </span>
        </div>

        <div className="field">
          <label htmlFor="inviteCode">Invite code (optional)</label>
          <input id="inviteCode" name="inviteCode" type="text" autoCapitalize="characters" autoComplete="off" aria-describedby="code-help" maxLength={40} />
          <span id="code-help" className="hint">
            A code from a neighbor lets you in right away. Without one, an admin checks your request first.
          </span>
        </div>

        <section className="rules" aria-labelledby="rules-heading">
          <h2 id="rules-heading">House rules</h2>
          <ul>
            <li>Real names and real addresses. One account per adult.</li>
            <li>Be neighborly. No politics, no personal attacks, no public shaming.</li>
            <li>Marketplace is for personal items. No business advertising.</li>
            <li>What is posted here stays here.</li>
          </ul>
          <label className="check">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            I live in Harbor Estates and I agree to the house rules
          </label>
        </section>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button" disabled={busy}>
          {busy ? "Sending..." : "Ask to join"}
        </button>
      </form>

      <button type="button" className="link" onClick={() => void signOut()}>
        Sign out
      </button>
    </main>
  );
}
