import { Mark } from "@/components/Brand";
import { StartButton } from "@/components/StartButton";

// Public welcome page. Anyone can see this, so it holds no neighbor data.
export default function WelcomePage() {
  return (
    <main className="page welcome">
      <header className="brand">
        <Mark />
        <h1>Hello Capo Beach</h1>
        <p className="lede">For Harbor Estates neighbors.</p>
      </header>

      <StartButton />

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
        Private and run by neighbors. Verified residents only and nothing is sold or shared.
      </footer>
    </main>
  );
}
