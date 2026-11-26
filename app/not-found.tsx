export default function NotFound() {
  return (
    <main className="page">
      <header className="brand">
        <h1>Page not found</h1>
        <p className="lede">That page does not exist, or it has moved.</p>
      </header>
      <a className="button" href="/">
        Back to the start
      </a>
    </main>
  );
}
