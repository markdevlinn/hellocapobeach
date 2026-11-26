"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeSignIn } from "@/lib/auth";
import { Loading } from "@/components/Brand";

// Microsoft sends people back here after they enter their email code.
export default function AuthCallback() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    completeSignIn()
      .then((ok) => router.replace(ok ? "/start/" : "/"))
      .catch(() => setFailed(true));
  }, [router]);

  if (failed) {
    return (
      <main className="page">
        <header className="brand">
          <h1>Sign-in did not finish</h1>
          <p className="lede">Nothing was changed. Please try again.</p>
        </header>
        <a className="button" href="/">
          Back to the start
        </a>
      </main>
    );
  }
  return <Loading text="Signing you in..." />;
}
