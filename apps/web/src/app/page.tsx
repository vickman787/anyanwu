export default function Landing() {
  return (
    <main>
      {/* Hero — same shape as the reference: headline, subcopy, two
          buttons, and a product panel showing a treasury and a run. */}
      <section className="hero">
        <p className="eyebrow">Stablecoin payroll · Built on QIE</p>
        <h1>Pay your whole team, in the light.</h1>
        <p>
          Anyanwu is named for the Eye of the Sun — the one that sees
          everything. Teams pay their people in stablecoins on QIE, in one
          run, and every settled payment writes a public record anyone can
          check.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <a className="btn" href="/dashboard">Pay your team</a>
          <a className="btn ghost" href="/portal">I work here — check my pay</a>
        </div>
        <p className="muted" style={{ marginTop: "1.5rem" }}>
          <span className="pill">Mainnet first</span> Contracts are live on QIE mainnet. The demo below uses test money in your browser.
        </p>

        <div className="panel" aria-label="Example payroll run">
          <div className="panel-row">
            <div>
              <p className="muted" style={{ margin: 0 }}>Treasury balance</p>
              <p className="panel-big">10,000 QUSDC</p>
            </div>
            <div>
              <p className="muted" style={{ margin: 0 }}>This run</p>
              <p className="panel-big">4 people · 2,400 QUSDC</p>
            </div>
          </div>
          <p className="good" style={{ margin: "0.5rem 0 0" }}>
            Payroll run confirmed — one transaction, everyone paid or no one is.
          </p>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            Example figures, not a real team. The record below it is real: every run is chained to the one before it.
          </p>
        </div>
      </section>

      {/* The problem — the same three industry benchmarks the reference
          cites, with their sources, because they are the reason payroll
          like this exists at all. */}
      <section>
        <p className="eyebrow">The problem</p>
        <h2>International payroll is bleeding your business.</h2>
        <p className="muted">
          The average finance team still pays around $47 to wire an
          international salary, waits days for settlement, and loses more to
          hidden FX spread. Anyanwu settles the same flow in seconds, with a
          payment record attached.
        </p>
        <div className="stats">
          <div>
            <p className="stat-big">$47</p>
            <p className="muted">Average cost per international wire</p>
            <p className="muted">Source: industry benchmark</p>
          </div>
          <div>
            <p className="stat-big">2–5 days</p>
            <p className="muted">Business days to settle a bank transfer</p>
            <p className="muted">Source: bank transfer norms</p>
          </div>
          <div>
            <p className="stat-big">6.2%</p>
            <p className="muted">Average FX fees on transfers</p>
            <p className="muted">Source: World Bank remittance data</p>
          </div>
        </div>
      </section>

      {/* The solution */}
      <section>
        <p className="eyebrow">The solution</p>
        <h2>Global payroll that feels like sending money to a friend.</h2>
        <p className="muted">
          Anyanwu replaces multi-day payroll settlement with one-click batch
          execution, streaming pay, and a public record — on QIE, in QUSDC.
        </p>
      </section>

      {/* Features 01–04 */}
      <section className="grid">
        <div className="card">
          <p className="feature-num">Feature 01</p>
          <h3>One run pays everyone</h3>
          <p className="muted">
            PayrollBatcher packages a whole team payout into one atomic
            transaction. Either everyone in the list is paid, or the whole
            run fails and nothing moves — never half a team.
          </p>
        </div>
        <div className="card">
          <p className="feature-num">Feature 02</p>
          <h3>Pay that flows</h3>
          <p className="muted">
            Some people would rather be paid a little at a time, as work
            happens. Streams pay out second by second, wait out a cliff, and
            can be claimed whenever they like.
          </p>
        </div>
        <div className="card">
          <p className="feature-num">Feature 03</p>
          <h3>A record anyone can check</h3>
          <p className="muted">
            Every payment is written to a public, hash-chained record. Change
            an old payment and the chain breaks — so everyone can trust what
            they see. Pay-run memos carry the pay period and a note.
          </p>
        </div>
        <div className="card">
          <p className="feature-num">Feature 04</p>
          <h3>Scheduled, not remembered</h3>
          <p className="muted">
            Set payroll monthly, weekly, or one-off. The dashboard shows
            what is due and what is overdue, and never lets the same pay
            period run twice.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="card" style={{ marginTop: "1rem" }}>
        <p className="eyebrow">How it works</p>
        <h2>From signup to first payroll in 15 minutes.</h2>
        <ol>
          <li><strong>Connect your wallet.</strong> QIE Wallet works best; any EVM wallet will do.</li>
          <li><strong>Add your team.</strong> Name, wallet, monthly pay. Choose monthly pay, or streaming pay.</li>
          <li><strong>Fund the treasury.</strong> Put in QUSDC on QIE mainnet. Only you can move it back out.</li>
          <li><strong>Run payroll.</strong> One click pays everyone, and the record updates itself.</li>
        </ol>
        <p className="muted">
          Built for the QIE Hackathon 3.0, DeFi &amp; Financial Infrastructure
          track. Runs on QIE mainnet (chain 1990) with real QUSDC.
        </p>
      </section>

      {/* Three primitives */}
      <section>
        <p className="eyebrow">Three primitives</p>
        <h2>One stack. Three on-chain pieces.</h2>
        <div className="grid">
          <div className="card">
            <h3>Payroll</h3>
            <p className="muted">
              Employers fund a treasury and run batched payouts in two clicks.
              Settles in one transaction on QIE.
            </p>
          </div>
          <div className="card">
            <h3>Streaming</h3>
            <p className="muted">
              Pay locked up front, growing in a straight line, claimed any
              time. For people who earn as they work.
            </p>
          </div>
          <div className="card">
            <h3>Public record</h3>
            <p className="muted">
              Every settled payment is written to a hash-chained ledger, and
              anyone can read a worker&rsquo;s record for free — no key, no
              account, no fee.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison — honest: the dashes are real gaps, not hidden. */}
      <section>
        <p className="eyebrow">Comparison</p>
        <h2>Anyanwu vs the alternatives.</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Feature</th><th>Anyanwu</th><th>Deel</th><th>Bitwage</th><th>Wire transfer</th></tr>
            </thead>
            <tbody>
              <tr><td>Settlement speed</td><td>Seconds, one transaction</td><td>1–5 days</td><td>1–3 days</td><td>1–5 days</td></tr>
              <tr><td>Transaction cost</td><td>Network gas only</td><td>$5–$25</td><td>1% fee</td><td>$25–$75</td></tr>
              <tr><td>FX fee</td><td>0% (paid in QUSDC)</td><td>0.5–2%</td><td>0.5%</td><td>1–3%</td></tr>
              <tr><td>Cards for workers</td><td>—</td><td>Yes</td><td>Yes</td><td>—</td></tr>
              <tr><td>Yield on treasury</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
              <tr><td>Compliance screening</td><td>Not checked by Anyanwu</td><td>Manual</td><td>Manual</td><td>Manual</td></tr>
              <tr><td>Coverage</td><td>QIE only</td><td>150+ countries</td><td>100+ countries</td><td>200+ countries</td></tr>
              <tr><td>Public payment record</td><td>Yes</td><td>—</td><td>—</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
        <p className="muted">
          The dashes are honest: no cards, no yield, and no sanctions or KYC
          screening — the checklist on the dashboard says so, every time.
        </p>
      </section>

      {/* First teams — no invented testimonials. */}
      <section className="card">
        <p className="eyebrow">First teams</p>
        <h2>Be one of the first teams paid in the light.</h2>
        <p className="muted">
          Anyanwu is new, and no team has run a real payroll on it yet. The
          first team that does gets the public record to prove it — and a
          mention here, with their permission.
        </p>
        <a className="btn" href="/dashboard">Run the first payroll</a>
      </section>

      {/* Pricing */}
      <section>
        <p className="eyebrow">Pricing</p>
        <h2>Simple, transparent pricing.</h2>
        <p className="muted">
          There is one plan, and it is free. You pay only the QIE network
          gas for each run — no monthly fee, no fee per worker, no cut of
          the payroll.
        </p>
        <div className="grid">
          <div className="card">
            <h3>Free</h3>
            <p className="panel-big">$0 /mo</p>
            <p className="muted">For any team getting started with stablecoin payroll.</p>
            <ul className="muted">
              <li>Unlimited workers</li>
              <li>Batched payroll runs</li>
              <li>Streaming pay</li>
              <li>Scheduled payroll</li>
              <li>Public payment record</li>
              <li>Free read API</li>
            </ul>
          </div>
          <div className="card">
            <h3>What it costs to run</h3>
            <p className="muted">
              Deploying the three contracts cost about 0.0027 QIE in gas.
              A pay run costs the gas of one transaction, whatever QIE
              charges that day — a fraction of a cent at current gas.
            </p>
            <p className="muted">
              Anyanwu never takes a fee. The only money that moves is yours,
              to your people.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="card" style={{ textAlign: "center" }}>
        <h2>Pay your whole team, in the light.</h2>
        <p className="muted">
          The contracts are live on QIE mainnet. Connect a wallet, add your
          people, and run payroll.
        </p>
        <a className="btn" href="/dashboard">Pay your team</a>
      </section>

      {/* FAQ */}
      <section>
        <p className="eyebrow">FAQ</p>
        <h2>Common questions.</h2>
        <div className="card">
          <h3>Is this real money?</h3>
          <p className="muted">
            Yes, on mainnet. The app runs on QIE mainnet (chain 1990) with
            real QUSDC. The demo in your browser uses test money until you
            connect a wallet and fund the treasury yourself.
          </p>
          <h3>Do my workers need to know crypto?</h3>
          <p className="muted">
            They need a wallet address to receive pay — QIE Wallet works
            best. There are no embedded wallets and no cards: workers hold
            their own wallet, and Anyanwu never holds their keys.
          </p>
          <h3>Does Anyanwu check sanctions or KYC?</h3>
          <p className="muted">
            No. Sanctions and KYC are not checked by Anyanwu. The dashboard
            shows that plainly before every run — it is your job to know who
            you are paying.
          </p>
          <h3>Can workers spend their pay?</h3>
          <p className="muted">
            Workers receive QUSDC on QIE. There is no card and no fiat
            off-ramp inside Anyanwu — that is a real gap, listed on the
            comparison table above.
          </p>
          <h3>What happens if a pay run fails halfway?</h3>
          <p className="muted">
            It cannot pay half a team. A run is one atomic transaction: either
            everyone in the list is paid, or the whole run fails and nothing
            moves.
          </p>
        </div>
      </section>
    </main>
  );
}
