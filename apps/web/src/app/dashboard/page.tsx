"use client";

import { useEffect, useState } from "react";
import {
  buildChecklist,
  currentPayPeriod,
  fromBaseUnits,
  nextDueAt,
  planPayroll,
  toBaseUnits,
  type Member,
  type Repeat,
} from "@anyanwu/shared";
import {
  checkDemoLedger,
  claimDemoStream,
  createDemoSchedule,
  DECIMALS,
  deleteDemoSchedule,
  demoClaimable,
  dueSchedules,
  EMPTY_STATE,
  fundDemoTreasury,
  loadDemo,
  recordLiveFunding,
  recordLivePayroll,
  resetDemo,
  runDemoPayroll,
  runScheduledPayroll,
  saveDemo,
  syncPublicRecord,
  treasuryDisplay,
  type DemoState,
} from "@/lib/demo";
import {
  BATCHER_MAINNET,
  fundTreasuryLive,
  liveTxUrl,
  readLiveBalances,
  runPayrollLive,
  TREASURY_MAINNET,
  type LiveBalances,
} from "@/lib/live";
import { chainFor, connectWallet, currentChainId, holdsQieId, shortAddress, switchToQie, tokenAddress, type QieNetwork } from "@/lib/qie";

const CONTRACTS_MAINNET = {
  treasury: "0x366f7234114C1be6dE95b2DF515890559C5558Ed",
  batcher: "0x17802a05560bCa3615E6758df066Ac3B420b13A4",
  stream: "0x4AE81f7F1eaaEbcD4Fb7605821b2d46DEd6Dd8Eb",
};

export default function Dashboard() {
  const [state, setState] = useState<DemoState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [network, setNetwork] = useState<QieNetwork>("mainnet");
  const [chainId, setChainId] = useState<number | null>(null);
  const [qieIdNote, setQieIdNote] = useState<string>("");
  const [qieIdHolds, setQieIdHolds] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [memberWallet, setMemberWallet] = useState("");
  const [pay, setPay] = useState("");
  const [payStyle, setPayStyle] = useState<"lump" | "stream">("lump");
  const [memoPeriod, setMemoPeriod] = useState(() => currentPayPeriod(Date.now()));
  const [memoNote, setMemoNote] = useState("");
  const [schedLabel, setSchedLabel] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedRepeat, setSchedRepeat] = useState<Repeat>("monthly");
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [liveBalances, setLiveBalances] = useState<LiveBalances | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveStep, setLiveStep] = useState("");
  const [liveTxHash, setLiveTxHash] = useState<string | null>(null);
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [liveFundAmount, setLiveFundAmount] = useState("10");

  useEffect(() => {
    setState(loadDemo());
    setReady(true);
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  function update(next: DemoState) {
    setState(next);
    saveDemo(next);
    // Publish the record so the free read API can answer for it.
    // Fire-and-forget: if the server cannot be reached, the demo still works.
    void syncPublicRecord(next);
  }

  async function act(fn: (s: DemoState) => Promise<DemoState>, ok: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      update(await fn(state));
      setMessage(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function onConnect() {
    setError("");
    try {
      const address = await connectWallet();
      setWallet(address);
      setChainId(await currentChainId());
      const id = await holdsQieId(address, network);
      setQieIdNote(id.note);
      setQieIdHolds(id.supported ? id.holdsName : null);
      if (network === "mainnet") {
        try {
          setLiveBalances(await readLiveBalances(address));
        } catch {
          // Balances refresh from the button below; a failed read is not fatal.
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect the wallet.");
    }
  }

  async function refreshLive() {
    setError("");
    try {
      setLiveBalances(await readLiveBalances(wallet));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the chain just now.");
    }
  }

  async function onFundLive() {
    if (!wallet) {
      setError("Connect your wallet first.");
      return;
    }
    setLiveBusy(true);
    setLiveStep("");
    setError("");
    setMessage("");
    try {
      const amount = toBaseUnits(liveFundAmount.trim(), DECIMALS);
      const { fundHash } = await fundTreasuryLive(wallet, amount, setLiveStep);
      update(await recordLiveFunding(state, wallet, amount, fundHash));
      setLiveTxHash(fundHash);
      setLiveRunId(null);
      setLiveStep("");
      setMessage(`Treasury funded with ${fromBaseUnits(amount, DECIMALS)} real QUSDC.`);
      void refreshLive();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Funding the treasury failed.");
    } finally {
      setLiveBusy(false);
    }
  }

  async function onRunLive() {
    if (!wallet) {
      setError("Connect your wallet first.");
      return;
    }
    if (!onRightChain) {
      setError(`Switch to ${chainFor(network).name} first.`);
      return;
    }
    setLiveBusy(true);
    setLiveStep("");
    setError("");
    setMessage("");
    try {
      const runPlan = planPayroll(state.members, 0, DECIMALS);
      const streamMembers = runPlan.lines.filter((l) => l.member.payStyle === "stream");
      if (streamMembers.length > 0) {
        throw new Error(
          `${streamMembers.map((l) => l.member.name).join(", ")} ${streamMembers.length > 1 ? "have" : "has"} streaming pay, which is not live yet. Switch them to monthly to pay them live, or pay them in the demo below.`,
        );
      }
      const lines = runPlan.lines.map((l) => ({ member: l.member, amountUnits: l.amountUnits }));
      const { txHash, runId } = await runPayrollLive(
        wallet,
        lines.map((l) => l.member.wallet),
        lines.map((l) => l.amountUnits),
        memoPeriod.trim() || currentPayPeriod(Date.now()),
        setLiveStep,
      );
      update(
        await recordLivePayroll(state, wallet, lines, {
          payPeriod: memoPeriod.trim() || currentPayPeriod(Date.now()),
          note: memoNote.trim(),
          txHash,
          runId,
        }),
      );
      setLiveTxHash(txHash);
      setLiveRunId(runId === null ? null : runId.toString());
      setLiveStep("");
      setMessage(
        `Live pay run done — ${lines.length} ${lines.length === 1 ? "person" : "people"} paid in real QUSDC${runId === null ? "" : ` (run #${runId})`}.`,
      );
      void refreshLive();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The live pay run failed.");
    } finally {
      setLiveBusy(false);
    }
  }

  async function onSwitch() {
    setError("");
    try {
      await switchToQie(network);
      setChainId(await currentChainId());
      setMessage(`Switched to ${chainFor(network).name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch networks.");
    }
  }

  function addMember() {
    setError("");
    setMessage("");
    const member: Member = { name: name.trim(), wallet: memberWallet.trim(), monthlyPay: pay.trim(), payStyle };
    try {
      planPayroll([...state.members, member], 0, DECIMALS); // validates the new person
      update({ ...state, members: [...state.members, member] });
      setName("");
      setMemberWallet("");
      setPay("");
      setMessage(`${member.name} joined the team.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That person could not be added.");
    }
  }

  function addSchedule() {
    setError("");
    setMessage("");
    if (!schedDate) {
      setError("Pick a date and time for the first run.");
      return;
    }
    try {
      const runAt = new Date(schedDate).toISOString();
      update(
        createDemoSchedule(state, {
          label: schedLabel.trim() || `${currentPayPeriod(Date.parse(runAt))} pay`,
          payPeriod: currentPayPeriod(Date.parse(runAt)),
          runAt,
          repeat: schedRepeat,
        }),
      );
      setSchedLabel("");
      setSchedDate("");
      setMessage("Schedule saved. It will appear below when its run is due.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That schedule could not be saved.");
    }
  }

  const plan = state.members.length > 0 ? planPayroll(state.members, 0, DECIMALS) : null;
  const token = tokenAddress(network);
  const onRightChain = chainId === chainFor(network).id;
  const checklist = buildChecklist({
    walletConnected: wallet !== null,
    qieIdChecked: qieIdHolds !== null,
    qieIdHoldsName: qieIdHolds === true,
    treasuryCoversRun: plan ? BigInt(state.treasuryUnits) >= plan.totalUnits : false,
    addressesValid: plan !== null,
    amountsExact: true,
  });
  const due = dueSchedules(state, now * 1000);

  if (!ready) return <main><p className="muted">Loading your team…</p></main>;

  return (
    <main>
      <h1>Pay your team</h1>
      <p className="muted">Add people, fund the treasury, and pay everyone in one run. The demo below is test money in your browser — the &ldquo;Live on mainnet&rdquo; card moves real QUSDC through the contracts on QIE mainnet, so start small and check every address before you pay.</p>
      {network === "mainnet" ? (
        <div className="warn">
          <strong>Real money on mainnet.</strong> The contracts are live on chain 1990 — treasury <code>{CONTRACTS_MAINNET.treasury}</code>, pay-run <code>{CONTRACTS_MAINNET.batcher}</code>, streams <code>{CONTRACTS_MAINNET.stream}</code>. Funding the treasury and running payroll on-chain moves real QUSDC, so start small and check every address before you pay.
        </div>
      ) : (
        <div className="warn">
          <strong>Testnet is skipped.</strong> The QIE testnet faucet is offline and its RPC does not answer from here, and the hackathon needs mainnet — so Anyanwu is built mainnet-first. The test token (<code>contracts/src/MockQUSDC.sol</code>) is never used on mainnet.
        </div>
      )}
      {message && <p className="good">{message}</p>}
      {error && <p className="bad">{error}</p>}

      <section className="card">
        <h2>Your wallet</h2>
        <div className="row">
          <div>
            <label>Network</label>
            <select value={network} onChange={(e) => setNetwork(e.target.value as QieNetwork)}>
              <option value="mainnet">QIE Mainnet (chain 1990)</option>
              <option value="testnet">QIE Testnet (chain 1983)</option>
            </select>
          </div>
          <div>
            <label>Stablecoin</label>
            <p style={{ margin: "0.55rem 0" }}>{token ? <code>{token}</code> : "Not published for this network yet"}</p>
          </div>
          <div style={{ flex: "0 0 auto" }}>
            {wallet ? (
              <p style={{ margin: "0.55rem 0" }}>Connected: <strong>{shortAddress(wallet)}</strong></p>
            ) : (
              <button className="btn" onClick={onConnect}>Connect wallet</button>
            )}
          </div>
        </div>
        {wallet && (
          <p className="muted">
            Wallet chain: {chainId ?? "unknown"} · {onRightChain ? "You are on the right network." : `Switch to ${chainFor(network).name} to continue.`}{" "}
            {!onRightChain && <button className="btn small" onClick={onSwitch}>Switch network</button>}
            <br />{qieIdNote}
          </p>
        )}
      </section>

      {network === "mainnet" && (
        <section className="card">
          <h2>Live on mainnet — real QUSDC</h2>
          <p className="muted">
            This is the real flow, not the demo below. A pay run pays from
            your connected wallet through the pay-run contract — two wallet
            confirmations: approve the spend, then run payroll. Either
            everyone is paid, or the whole run fails and nothing moves.
          </p>
          <p className="muted">
            The treasury is the team&rsquo;s money box, and only the wallet
            that deployed it can take money back out or send it to a pay
            run. If that is not the wallet you connected, do not fund the
            treasury — run payroll directly instead.
          </p>
          <div className="row">
            <div>
              <label>Treasury (live)</label>
              <p style={{ margin: "0.55rem 0" }}>
                {liveBalances ? `${fromBaseUnits(liveBalances.treasuryUnits, DECIMALS)} QUSDC` : "—"}
              </p>
            </div>
            <div>
              <label>Pay-run contract (live)</label>
              <p style={{ margin: "0.55rem 0" }}>
                {liveBalances ? `${fromBaseUnits(liveBalances.batcherUnits, DECIMALS)} QUSDC` : "—"}
              </p>
            </div>
            <div>
              <label>Your QUSDC (live)</label>
              <p style={{ margin: "0.55rem 0" }}>
                {liveBalances?.myQusdcUnits !== null && liveBalances?.myQusdcUnits !== undefined
                  ? `${fromBaseUnits(liveBalances.myQusdcUnits, DECIMALS)} QUSDC`
                  : "Connect a wallet to see it"}
              </p>
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <button className="btn ghost small" onClick={refreshLive}>Refresh balances</button>
            </div>
          </div>
          <div className="row">
            <div>
              <label>Fund the treasury (live, QUSDC)</label>
              <input value={liveFundAmount} onChange={(e) => setLiveFundAmount(e.target.value)} placeholder="10" />
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <button className="btn" disabled={liveBusy || !wallet} onClick={onFundLive}>
                Fund treasury — live
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
            <button className="btn" disabled={liveBusy || !wallet || !plan} onClick={onRunLive}>
              Run payroll — live
            </button>
            <p className="muted" style={{ margin: "0.55rem 0" }}>
              {plan
                ? `Pays ${plan.lines.length} ${plan.lines.length === 1 ? "person" : "people"} ${fromBaseUnits(plan.totalUnits, DECIMALS)} QUSDC in one transaction.`
                : "Add your team below first."}
            </p>
          </div>
          {liveStep && <p className="muted">{liveStep}</p>}
          {liveTxHash && (
            <p>
              Last live transaction:{" "}
              <a href={liveTxUrl(liveTxHash)} target="_blank" rel="noreferrer">
                {liveTxHash.slice(0, 10)}…{liveTxHash.slice(-4)}
              </a>
              {liveRunId !== null && ` · run #${liveRunId}`} ·{" "}
              <a href={liveTxUrl(liveTxHash)} target="_blank" rel="noreferrer">see it on the explorer</a>
            </p>
          )}
          <p className="muted">
            Treasury <code>{TREASURY_MAINNET}</code> · pay-run{" "}
            <code>{BATCHER_MAINNET}</code>
          </p>
        </section>
      )}

      <section className="card">
        <h2>Treasury — {treasuryDisplay(state)} test dollars</h2>
        <p className="muted">This is the team&rsquo;s money box. The next pay run needs {plan ? `${fromBaseUnits(plan.totalUnits, DECIMALS)} test dollars` : "a team first"}.</p>
        <div className="row">
          <div>
            <label>Pay period (written on every payment)</label>
            <input value={memoPeriod} onChange={(e) => setMemoPeriod(e.target.value)} placeholder="Nov 2026" />
          </div>
          <div>
            <label>Note for this run (optional)</label>
            <input value={memoNote} onChange={(e) => setMemoNote(e.target.value)} placeholder="e.g. November salaries" />
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn" disabled={busy} onClick={() => act((s) => fundDemoTreasury(s, wallet ?? "demo"), "Treasury funded with 1,000 test dollars.")}>
            Add 1,000 test dollars
          </button>
          <button className="btn ghost" disabled={busy || !plan} onClick={() => act((s) => runDemoPayroll(s, wallet ?? "demo", { payPeriod: memoPeriod, note: memoNote }), "Pay run done — everyone was paid.")}>
            Run payroll
          </button>
          <button className="btn ghost" onClick={() => { update(resetDemo()); setMessage("Demo cleared. Fresh start."); }}>Start over</button>
        </div>
      </section>

      <section className="card">
        <h2>Before you pay</h2>
        <p className="muted">Only what the app actually checked is ticked. What it does not check is shown as not checked — never as passed.</p>
        <table>
          <thead><tr><th>Check</th><th></th><th>What it means</th></tr></thead>
          <tbody>
            {checklist.map((item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td>{item.status === "passed" ? "✓ Checked" : item.status === "failed" ? "✗ Failed" : "– Not checked"}</td>
                <td>{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Scheduled pay runs ({state.schedules.length})</h2>
        <p className="muted">Set a run once and it waits for its day. A run only pays when it is due, and the same pay period is never paid twice.</p>
        {due.length > 0 && (
          <div className="warn" style={{ marginBottom: "1rem" }}>
            <strong>{due.length} run{due.length > 1 ? "s are" : " is"} due now{due.some((d) => d.overdue) ? " — one of them is overdue" : ""}.</strong>
          </div>
        )}
        {state.schedules.length === 0 ? (
          <p className="muted">No schedules yet. Pick a date below — monthly is the usual choice.</p>
        ) : (
          <table>
            <thead><tr><th>What</th><th>Pay period</th><th>Next run</th><th>Repeats</th><th></th><th></th></tr></thead>
            <tbody>
              {state.schedules.map((s) => {
                const next = nextDueAt(s, now * 1000);
                const isDueNow = due.some((d) => d.schedule.id === s.id);
                const overdue = due.find((d) => d.schedule.id === s.id)?.overdue ?? false;
                return (
                  <tr key={s.id}>
                    <td>{s.label}</td>
                    <td>{s.payPeriod}</td>
                    <td>{next ? new Date(next).toLocaleString() : "Done — no more runs"}</td>
                    <td>{s.repeat === "once" ? "One-off" : s.repeat === "weekly" ? "Weekly" : "Monthly"}</td>
                    <td>{overdue ? "Overdue" : isDueNow ? "Due now" : "Waiting"}</td>
                    <td>
                      {isDueNow && (
                        <button className="btn small" disabled={busy} onClick={() => act((st) => runScheduledPayroll(st, s.id, wallet ?? "demo"), `Scheduled run done — ${s.payPeriod} is paid.`)}>
                          Run now
                        </button>
                      )}{" "}
                      <button className="btn ghost small" onClick={() => { update(deleteDemoSchedule(state, s.id)); setMessage("Schedule removed."); }}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="row" style={{ marginTop: "1rem" }}>
          <div><label>Name</label><input value={schedLabel} onChange={(e) => setSchedLabel(e.target.value)} placeholder="November pay" /></div>
          <div><label>First run (date and time)</label><input type="datetime-local" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} /></div>
          <div>
            <label>Repeat</label>
            <select value={schedRepeat} onChange={(e) => setSchedRepeat(e.target.value as Repeat)}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="once">One-off</option>
            </select>
          </div>
          <div style={{ flex: "0 0 auto" }}><button className="btn" onClick={addSchedule}>Save schedule</button></div>
        </div>
      </section>

      <section className="card">
        <h2>Your team ({state.members.length})</h2>
        {state.members.length === 0 ? (
          <p className="muted">No one here yet. Add your first person below — name, wallet, and what they earn each month.</p>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Wallet</th><th>Monthly pay</th><th>How</th></tr></thead>
            <tbody>
              {state.members.map((m) => (
                <tr key={m.wallet}>
                  <td>{m.name}</td>
                  <td className="mono">{shortAddress(m.wallet)}</td>
                  <td>{m.monthlyPay}</td>
                  <td>{m.payStyle === "stream" ? "Streaming" : "Monthly"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="row" style={{ marginTop: "1rem" }}>
          <div><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada" /></div>
          <div><label>Wallet</label><input value={memberWallet} onChange={(e) => setMemberWallet(e.target.value)} placeholder="0x…" /></div>
          <div><label>Monthly pay (test dollars)</label><input value={pay} onChange={(e) => setPay(e.target.value)} placeholder="250" /></div>
          <div>
            <label>How they are paid</label>
            <select value={payStyle} onChange={(e) => setPayStyle(e.target.value as "lump" | "stream")}>
              <option value="lump">Monthly, in full</option>
              <option value="stream">Streaming, as work happens</option>
            </select>
          </div>
          <div style={{ flex: "0 0 auto" }}><button className="btn" onClick={addMember}>Add person</button></div>
        </div>
      </section>

      {state.streams.length > 0 && (
        <section className="card">
          <h2>Streams running</h2>
          <table>
            <thead><tr><th>Who</th><th>Earned so far</th><th></th></tr></thead>
            <tbody>
              {state.streams.map((s) => (
                <tr key={s.id}>
                  <td>{s.workerName}</td>
                  <td>{fromBaseUnits(demoClaimable(s, now), DECIMALS)} test dollars</td>
                  <td>
                    <button className="btn small" disabled={busy} onClick={() => act((st) => claimDemoStream(st, s.id, wallet ?? "demo"), `${s.workerName} claimed what they earned.`)}>
                      Claim
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h2>The public record ({state.ledger.length} entries)</h2>
        {state.ledger.length === 0 ? (
          <p className="muted">Nothing yet. Fund the treasury or run payroll and every payment will appear here, chained to the one before it.</p>
        ) : (
          <>
            <table>
              <thead><tr><th>#</th><th>What</th><th>Amount</th><th>Note</th><th>Hash</th></tr></thead>
              <tbody>
                {state.ledger.map((e) => (
                  <tr key={e.seq}>
                    <td>{e.seq}</td>
                    <td>{e.type.replaceAll("_", " ")}</td>
                    <td>{fromBaseUnits(BigInt(e.amountUnits), DECIMALS)}</td>
                    <td>{e.memo}</td>
                    <td className="mono">{e.hash.slice(0, 10)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="btn small"
              style={{ marginTop: "0.75rem" }}
              onClick={async () => {
                const problem = await checkDemoLedger(state);
                setError("");
                setMessage(problem ? `Record problem: ${problem}` : "Record checks out — every entry links to the one before it.");
              }}
            >
              Check the record
            </button>
          </>
        )}
      </section>
    </main>
  );
}
