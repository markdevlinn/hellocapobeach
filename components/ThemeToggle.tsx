"use client";

import { useEffect, useState } from "react";
import { THEME_KEY as KEY } from "@/lib/theme";

// Light and dark switch. The choice is saved on this device. Until someone
// picks, the app follows the device's own light or dark setting.
type Theme = "light" | "dark";

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  // Keeps the phone's status bar matching the page.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute("content", theme === "dark" ? "#0C1F25" : "#F2F7F6");
    m.removeAttribute("media");
  });
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Re-apply the saved choice in case the page was redrawn after it first loaded.
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") apply(saved);
    } catch {
      // no saved choice available; follow the device
    }
    setTheme(current());
  }, []);

  function flip() {
    const next: Theme = current() === "dark" ? "light" : "dark";
    apply(next);
    setTheme(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // private windows may not save; the switch still works for this visit
    }
  }

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button type="button" className={`theme-toggle ${className}`.trim()} onClick={flip} aria-label={label} title={label}>
      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
        )}
      </svg>
    </button>
  );
}
