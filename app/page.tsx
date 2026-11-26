// Public welcome page. Anyone can see this, so it holds no neighbor data.
export default function WelcomePage() {
  return (
    <main className="page">
      <header className="brand">
        <svg aria-hidden="true" width="56" height="56" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="20" r="11" fill="var(--sun)" />
          <path
            d="M4 34c5 0 5-4 10-4s5 4 10 4 5-4 10-4 5 4 10 4"
            stroke="var(--primary)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M4 43c5 0 5-4 10-4s5 4 10 4 5-4 10-4 5 4 10 4"
            stroke="var(--primary)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        <h1>Hello Capo Beach</h1>
        <p className="lede">For Harbor Estates neighbors.</p>
      </header>

      <div className="notice" role="status">
        <strong>Sign-up is by invite</strong>
        <span>Opening soon. You will need an invite code from a neighbor who is already a member.</span>
      </div>

      <ul className="points">
        <li>
          <span className="label">Neighborhood news</span>
          <span className="detail">Announcements, lost pets, safety heads-ups and recommendations.</span>
        </li>
        <li>
          <span className="label">Meet-ups and events</span>
          <span className="detail">Block parties, beach days and kids&apos; activities, with a simple RSVP.</span>
        </li>
        <li>
          <span className="label">Buy, sell and give away</span>
          <span className="detail">A marketplace among verified neighbors only.</span>
        </li>
      </ul>

      <section className="install" aria-labelledby="install-heading">
        <h2 id="install-heading">Put it on your phone</h2>
        <ol>
          <li>iPhone: tap Share, then Add to Home Screen.</li>
          <li>Android: tap the menu, then Add to Home screen.</li>
        </ol>
      </section>

      <footer className="footer">
        Private and run by neighbors. Verified residents only. No ads, and nothing is sold or shared.
      </footer>
    </main>
  );
}
