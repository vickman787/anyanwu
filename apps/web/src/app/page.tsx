export default function Landing() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Stablecoin payroll · Built on QIE</p>
        <h1>Pay your whole team, in the light.</h1>
        <p>
          Anyanwu is named for the Eye of the Sun — the one that sees
          everything. Put money in a treasury, pay everyone in one run, and
          keep a public record of every payment, so no one has to wonder
          where the money went.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <a className="btn" href="/dashboard">Pay your team</a>
          <a className="btn ghost" href="/portal">I work here — check my pay</a>
        </div>
        <p className="muted" style={{ marginTop: "1.5rem" }}>
          <span className="pill">Mainnet first</span> Contracts are live on QIE mainnet. The demo below uses test money in your browser.
        </p>
      </section>

      <section className="grid">
        <div className="card">
          <h3>One treasury</h3>
          <p className="muted">
            Your team&rsquo;s money sits in one place, owned by you. You can
            see the balance any time, and take it back any time.
          </p>
        </div>
        <div className="card">
          <h3>One run pays everyone</h3>
          <p className="muted">
            Add your people, set what each one earns, and pay them all in a
            single run. Either everyone is paid, or no one is — never half a team.
          </p>
        </div>
        <div className="card">
          <h3>Pay that flows</h3>
          <p className="muted">
            Some people would rather be paid a little at a time, as work
            happens. Streams pay out second by second, and they can claim
            what they have earned whenever they like.
          </p>
        </div>
        <div className="card">
          <h3>A record anyone can check</h3>
          <p className="muted">
            Every payment is written to a public record, each entry chained
            to the one before it. Change an old payment and the chain breaks
            — so everyone can trust what they see.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>How it works</h2>
        <ol>
          <li><strong>Connect your wallet.</strong> QIE Wallet works best; any EVM wallet will do.</li>
          <li><strong>Add your team.</strong> Name, wallet, monthly pay. Choose monthly pay, or streaming pay.</li>
          <li><strong>Fund the treasury.</strong> Put in stablecoins (QUSDC on mainnet).</li>
          <li><strong>Run payroll.</strong> One click pays everyone, and the record updates itself.</li>
        </ol>
        <p className="muted">
          Built for the QIE Hackathon 3.0, DeFi &amp; Financial Infrastructure
          track. Runs on QIE mainnet (chain 1990) with real QUSDC. Testnet
          was skipped — its faucet is offline and the hackathon needs mainnet.
        </p>
      </section>
    </main>
  );
}
