"use client";

import { ReactNode } from "react";
import { Me, useMe } from "@/lib/useMe";
import { Loading } from "./Brand";

type Tab = "home" | "events" | "market" | "neighbors";

const TABS: { id: Tab; href: string; label: string; icon: ReactNode }[] = [
  {
    id: "home",
    href: "/home/",
    label: "Home",
    icon: (
      <>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </>
    ),
  },
  {
    id: "events",
    href: "/events/",
    label: "Events",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    id: "market",
    href: "/market/",
    label: "Market",
    icon: (
      <>
        <path d="M3 12V4h8l10 10-8 8z" />
        <circle cx="7.5" cy="8.5" r="1.5" />
      </>
    ),
  },
  {
    id: "neighbors",
    href: "/neighbors/",
    label: "Neighbors",
    icon: (
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21c0-4 3-6 7-6s7 2 7 6" />
        <path d="M17 4a4 4 0 010 8M22 21c0-3-1.5-5-4-5.6" />
      </>
    ),
  },
];

/**
 * The frame around every members-only page: checks the person is an approved
 * member, then shows the page with the four tabs along the bottom.
 */
export function AppShell({
  tab,
  title,
  subtitle,
  back,
  children,
}: {
  tab: Tab;
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  children: (me: Me) => ReactNode;
}) {
  const { me, waking, error } = useMe(["approved"]);
  if (error) return <Loading text={error} />;
  if (!me) return <Loading text={waking ? "Waking things up. This can take up to a minute..." : "One moment..."} />;

  return (
    <div className="app">
      <main className="app-main">
        <header className="app-head">
          {back && (
            <a className="back" href={back.href}>
              {back.label}
            </a>
          )}
          <div className="app-title">
            <h1>{title}</h1>
            {!back && (
              <a className="me-link" href="/profile/" aria-label="My profile">
                {(me.name ?? "?")
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </a>
            )}
          </div>
          {subtitle && <p className="hint">{subtitle}</p>}
        </header>
        {children(me)}
      </main>
      <nav className="tabs" aria-label="Main">
        {TABS.map((t) => (
          <a key={t.id} href={t.href} className={t.id === tab ? "tab on" : "tab"} aria-current={t.id === tab ? "page" : undefined}>
            <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={t.id === tab ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
              {t.icon}
            </svg>
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
