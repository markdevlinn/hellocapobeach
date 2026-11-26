export function Mark({ size = 56 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="20" r="11" fill="var(--sun)" />
      <path d="M4 34c5 0 5-4 10-4s5 4 10 4 5-4 10-4 5 4 10 4" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M4 43c5 0 5-4 10-4s5 4 10 4 5-4 10-4 5 4 10 4" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/** A quiet full-page message used while something loads. */
export function Loading({ text }: { text: string }) {
  return (
    <main className="page">
      <header className="brand">
        <Mark />
        <p className="lede" role="status">
          {text}
        </p>
      </header>
    </main>
  );
}
