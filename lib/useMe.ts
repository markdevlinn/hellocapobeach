"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, SignInNeeded } from "./api";

export interface Me {
  state: "none" | "pending" | "approved" | "declined" | "removed";
  id?: string;
  name?: string;
  email?: string | null;
  isAdmin?: boolean;
  invitesLeft?: number | "unlimited";
  inDirectory?: boolean;
}

const HOME: Record<Me["state"], string> = {
  none: "/join/",
  pending: "/waiting/",
  approved: "/home/",
  declined: "/waiting/",
  removed: "/waiting/",
};

/**
 * Loads where the signed-in person stands and keeps them on the right page.
 * `expect` lists the states this page is for. Anyone else is sent to their own page.
 */
export function useMe(expect: Me["state"][] | "route") {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<Me>("/api/me", { onWaking: () => setWaking(true) });
      setWaking(false);
      if (expect === "route" || !expect.includes(data.state)) {
        router.replace(HOME[data.state]);
        return;
      }
      setMe(data);
    } catch (err) {
      setWaking(false);
      if (err instanceof SignInNeeded) router.replace("/");
      else setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }, [expect, router]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { me, waking, error, reload: load };
}
