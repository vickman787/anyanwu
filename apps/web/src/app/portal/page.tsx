"use client";

import { useState } from "react";
import { fromBaseUnits } from "@anyanwu/shared";
import { DECIMALS, loadDemo, type DemoState } from "@/lib/demo";

export default function Portal() {
  const [wallet, setWallet] = useState("");
  const [lookedUp, setLookedUp] = useState<DemoState | null>(null);
  const [error, setError] = useState("");

  function check() {
    setError("");
    const address = wallet.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setError("That does not look like a wallet address. It should start with 0x and be 42 characters long.");
      setLookedUp(null);
      return;
    }
    setLookedUp(loadDemo());
  }

  const lower = wallet.trim().toLowerCase();
  const payments = (lookedUp?.ledger ?? []).filter(
    (e) => e.counterparty?.toLowerCase() === lower && (e.type === "pay_run" || e.type === "stream_claimed"),
  );
  const totalUnits = payments.reduce((sum, e) => sum + BigInt(e.amountUnits), 0n);
  const myStreams = (lookedUp?.streams ?? []).filter((s) => s.worker.toLowerCase() === lower);

  return (
    <main>
      <h1>Check my pay</h1>
      <p className="muted">
        Paste your wallet address and see what you have been paid, and what
        your streams have earned. This is demo money in this browser — the
        same record your employer sees.
      </p>
      {error && <p className="bad">{error}</p>}
      <section className="card">
        <div className="row">
          <div>
            <label>Your wallet address</label>
            <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x…" />
          </div>
          <div style={{ flex: "0 0 auto" }}>
            <button className="btn" onClick={check}>Check my pay</button>
          </div>
        </div>
      </section>

      {lookedUp && (
        <>
          <section className="card">
            <h2>Paid so far — {fromBaseUnits(totalUnits, DECIMALS)} test dollars</h2>
            {payments.length === 0 ? (
              <p className="muted">No payments to this wallet yet in this demo. If your employer just paid you, check the address matches the one they used.</p>
            ) : (
              <table>
                <thead><tr><th>What</th><th>Amount</th><th>Note</th><th>When</th></tr></thead>
                <tbody>
                  {payments.map((e) => (
                    <tr key={e.seq}>
                      <td>{e.type.replaceAll("_", " ")}</td>
                      <td>{fromBaseUnits(BigInt(e.amountUnits), DECIMALS)}</td>
                      <td>{e.memo}</td>
                      <td>{new Date(e.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {myStreams.length > 0 && (
            <section className="card">
              <h2>Your streams</h2>
              <table>
                <thead><tr><th>Stream</th><th>Claimed so far</th><th>Ends</th></tr></thead>
                <tbody>
                  {myStreams.map((s) => (
                    <tr key={s.id}>
                      <td>{s.workerName}</td>
                      <td>{fromBaseUnits(BigInt(s.claimedUnits), DECIMALS)} test dollars</td>
                      <td>{new Date(s.end * 1000).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted">Claim a stream from the employer dashboard in this demo. On-chain, you claim it yourself from here.</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
