/**
 * Demo state for the app. Everything lives in your own browser
 * (localStorage) and in test money — nothing here moves on-chain, and
 * nothing leaves your machine. The point of the demo is to show the flow:
 * add a team, fund the treasury, run a pay run, watch the record grow.
 *
 * When the contracts are deployed, the same screens will read and write
 * the chain instead. Until then, every screen says plainly that this is
 * demo money.
 */
import { appendLedger, verifyLedger, type LedgerEntry } from "@anyanwu/ledger";
import {
  createSchedule,
  currentPayPeriod,
  fromBaseUnits,
  isDue,
  isOverdue,
  markRun,
  nextDueAt,
  planPayroll,
  streamAccrued,
  toBaseUnits,
  wouldDuplicate,
  type Member,
  type PaySchedule,
  type Repeat,
} from "@anyanwu/shared";

export const DECIMALS = 6; // QUSDC has 6 decimals; the test token matches it.
const STORAGE_KEY = "anyanwu-demo-v1";

export interface DemoStream {
  id: string;
  worker: string;
  workerName: string;
  ratePerSecondUnits: string;
  start: number;
  cliffSeconds: number;
  end: number;
  claimedUnits: string;
}

export interface DemoState {
  members: Member[];
  /** Treasury balance in smallest units, as a string. */
  treasuryUnits: string;
  ledger: LedgerEntry[];
  streams: DemoStream[];
  schedules: PaySchedule[];
}

export const EMPTY_STATE: DemoState = { members: [], treasuryUnits: "0", ledger: [], streams: [], schedules: [] };

/** A pay-run memo: the pay period, e.g. "Nov 2026", plus an optional short note. */
export interface PayMemo {
  payPeriod?: string;
  note?: string;
}

/** Build the memo stored with every payment of a run. Kept short: the ledger caps memos at 200 characters. */
export function payRunMemo(period: string, name: string, amountDisplay: string, note?: string): string {
  const base = `${period} — Pay run — ${name}, ${amountDisplay} test dollars`;
  const trimmed = (note ?? "").trim();
  if (!trimmed) return base;
  const withNote = `${base} — ${trimmed}`;
  return withNote.length <= 200 ? withNote : `${base.slice(0, 197)}…`;
}

export function loadDemo(): DemoState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as DemoState;
    if (!Array.isArray(parsed.members) || !Array.isArray(parsed.ledger)) return EMPTY_STATE;
    return {
      ...EMPTY_STATE,
      ...parsed,
      streams: Array.isArray(parsed.streams) ? parsed.streams : [],
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function saveDemo(state: DemoState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetDemo(): DemoState {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  return EMPTY_STATE;
}

export function treasuryDisplay(state: DemoState): string {
  return fromBaseUnits(BigInt(state.treasuryUnits), DECIMALS);
}

/** Add 1,000 test dollars to the demo treasury and record it. */
export async function fundDemoTreasury(state: DemoState, actor: string): Promise<DemoState> {
  const amount = toBaseUnits("1000", DECIMALS);
  const ledger = await appendLedger(state.ledger, {
    type: "treasury_funded",
    actor,
    amountUnits: amount.toString(),
    memo: "Treasury funded — 1,000 test dollars",
    createdAt: new Date().toISOString(),
  });
  return { ...state, treasuryUnits: (BigInt(state.treasuryUnits) + amount).toString(), ledger };
}

/**
 * Pay the whole team at once. Either everyone is paid, or no one is —
 * the plan is checked in full before any money moves. Stream members get
 * a 30-day stream started; lump members are paid in full now. Every
 * payment is recorded with the pay period memo, so the portal and the
 * public read API can show which period it belongs to.
 */
export async function runDemoPayroll(state: DemoState, actor: string, memo?: PayMemo): Promise<DemoState> {
  const plan = planPayroll(state.members, 0, DECIMALS);
  if (BigInt(state.treasuryUnits) < plan.totalUnits) {
    throw new Error(
      `Not enough in the treasury. This run needs ${fromBaseUnits(plan.totalUnits, DECIMALS)} and it holds ${fromBaseUnits(BigInt(state.treasuryUnits), DECIMALS)}.`,
    );
  }
  const period = (memo?.payPeriod ?? "").trim() || currentPayPeriod(Date.now());
  const note = (memo?.note ?? "").trim();
  let ledger = state.ledger;
  let treasury = BigInt(state.treasuryUnits);
  const streams = [...state.streams];
  const now = Math.floor(Date.now() / 1000);
  for (const line of plan.lines) {
    treasury -= line.amountUnits;
    ledger = await appendLedger(ledger, {
      type: "pay_run",
      actor,
      counterparty: line.member.wallet,
      amountUnits: line.amountUnits.toString(),
      memo: payRunMemo(period, line.member.name, fromBaseUnits(line.amountUnits, DECIMALS), note),
      createdAt: new Date().toISOString(),
    });
    if (line.member.payStyle === "stream") {
      const rate = line.amountUnits / BigInt(30 * 24 * 3600);
      streams.push({
        id: `stream-${now}-${line.member.wallet.slice(2, 8)}`,
        worker: line.member.wallet,
        workerName: line.member.name,
        ratePerSecondUnits: rate.toString(),
        start: now,
        cliffSeconds: 0,
        end: now + 30 * 24 * 3600,
        claimedUnits: "0",
      });
      ledger = await appendLedger(ledger, {
        type: "stream_started",
        actor,
        counterparty: line.member.wallet,
        amountUnits: line.amountUnits.toString(),
        memo: `${period} — Stream started — ${line.member.name}, 30 days`,
        createdAt: new Date().toISOString(),
      });
    }
  }
  return { ...state, treasuryUnits: treasury.toString(), ledger, streams };
}

/** Add a scheduled pay run. The first run happens at `runAt`, then repeats. */
export function createDemoSchedule(
  state: DemoState,
  input: { label: string; payPeriod: string; runAt: string; repeat: Repeat },
): DemoState {
  const schedule = createSchedule({
    id: `sched-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    label: input.label,
    payPeriod: input.payPeriod,
    runAt: input.runAt,
    repeat: input.repeat,
  });
  return { ...state, schedules: [...state.schedules, schedule] };
}

export function deleteDemoSchedule(state: DemoState, scheduleId: string): DemoState {
  return { ...state, schedules: state.schedules.filter((s) => s.id !== scheduleId) };
}

export interface DueSchedule {
  schedule: PaySchedule;
  dueAt: number;
  overdue: boolean;
}

/** Schedules that are due right now, soonest first. */
export function dueSchedules(state: DemoState, nowMs: number): DueSchedule[] {
  return state.schedules
    .filter((s) => isDue(s, nowMs))
    .map((s) => ({ schedule: s, dueAt: nextDueAt(s, nowMs) as number, overdue: isOverdue(s, nowMs) }))
    .sort((a, b) => a.dueAt - b.dueAt);
}

/**
 * Run a scheduled pay run. Refuses when the run is not due yet, and
 * refuses when this pay period was already paid — the team is never
 * paid twice for the same period. On success the schedule is marked
 * as run for that period, so its next run moves on.
 */
export async function runScheduledPayroll(state: DemoState, scheduleId: string, actor: string): Promise<DemoState> {
  const schedule = state.schedules.find((s) => s.id === scheduleId);
  if (!schedule) throw new Error("That schedule does not exist any more.");
  const nowMs = Date.now();
  if (wouldDuplicate(schedule, nowMs)) {
    throw new Error(`This pay period (${schedule.payPeriod}) is already paid — the team is never paid twice for the same period.`);
  }
  if (!isDue(schedule, nowMs)) {
    const next = nextDueAt(schedule, nowMs);
    throw new Error(
      `This run is not due yet — the next run is ${next ? new Date(next).toLocaleString() : "never"}.`,
    );
  }
  const paid = await runDemoPayroll(state, actor, { payPeriod: schedule.payPeriod, note: schedule.label });
  return { ...paid, schedules: paid.schedules.map((s) => (s.id === scheduleId ? markRun(s, nowMs) : s)) };
}

/**
 * Send this browser's demo record to the app's free read API, so
 * /api/reputation/[address] and /api/payroll/runs can answer for it.
 * Fire-and-forget: if the server cannot be reached, the demo still
 * works — the record simply is not public yet.
 */
export async function syncPublicRecord(state: DemoState): Promise<void> {
  try {
    await fetch("/api/payroll/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ledger: state.ledger, streams: state.streams }),
    });
  } catch {
    // The demo works without the public record; nothing to show the user.
  }
}

/** What a demo stream has earned by now, minus what was already claimed. */
export function demoClaimable(stream: DemoStream, nowSeconds: number): bigint {
  const earned = streamAccrued(
    {
      ratePerSecondUnits: BigInt(stream.ratePerSecondUnits),
      start: stream.start,
      cliffSeconds: stream.cliffSeconds,
      end: stream.end,
    },
    nowSeconds,
  );
  const due = earned - BigInt(stream.claimedUnits);
  return due > 0n ? due : 0n;
}

/** Claim what a stream has earned so far, and record it. */
export async function claimDemoStream(state: DemoState, streamId: string, actor: string): Promise<DemoState> {
  const stream = state.streams.find((s) => s.id === streamId);
  if (!stream) throw new Error("Stream not found.");
  const due = demoClaimable(stream, Math.floor(Date.now() / 1000));
  if (due <= 0n) throw new Error("Nothing earned yet — come back after some time has passed.");
  const ledger = await appendLedger(state.ledger, {
    type: "stream_claimed",
    actor,
    counterparty: stream.worker,
    amountUnits: due.toString(),
    memo: `Stream claimed — ${stream.workerName}, ${fromBaseUnits(due, DECIMALS)} test dollars`,
    createdAt: new Date().toISOString(),
  });
  const streams = state.streams.map((s) =>
    s.id === streamId ? { ...s, claimedUnits: (BigInt(s.claimedUnits) + due).toString() } : s,
  );
  return { ...state, ledger, streams };
}

/** Re-check the public record. Null means the chain is clean. */
export async function checkDemoLedger(state: DemoState): Promise<string | null> {
  return verifyLedger(state.ledger);
}
