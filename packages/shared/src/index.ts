/**
 * @anyanwu/shared — payroll maths. Pure functions only: no I/O, no network,
 * no floats. Every amount is an integer count of the coin's smallest unit
 * (bigint), so a pay run adds up to the exact same total every time, on
 * every machine. QUSDC has 6 decimals; a test token may have 18.
 *
 * Money rules, kept in one place so the web app and the contracts agree:
 * - A pay run is a list of people, each with a whole-number amount.
 * - The employer funds the run first; the run never pays more than it holds.
 * - A small fee (basis points) can be taken per run; the fee is rounded
 *   down, and the leftover dust stays with the employer.
 * - Streaming pay grows in a straight line from a start time, waits out
 *   a cliff, and stops at the end. What you have earned so far is a
 *   function of the clock, nothing else.
 */
import { z } from "zod";

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export const MemberSchema = z.object({
  name: z.string().min(1).max(80),
  wallet: z.string().regex(ADDRESS_RE, "must be an EVM address"),
  /** Monthly pay, as a decimal string like "250" or "250.50". No floats. */
  monthlyPay: z.string().regex(/^\d+(\.\d+)?$/, "must be a decimal number"),
  /** "stream" pays a little at a time as work happens; "lump" pays monthly. */
  payStyle: z.enum(["lump", "stream"]),
});
export type Member = z.infer<typeof MemberSchema>;

/** Parse "250.50" into smallest units. Rejects more decimals than the coin has. */
export function toBaseUnits(amount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error(`bad amount: ${amount}`);
  const [whole, frac = ""] = amount.split(".");
  if (frac.length > decimals) {
    throw new Error(`too many decimals: ${amount} has more than ${decimals}`);
  }
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
}

/** Format smallest units back into a plain decimal string, no trailing zeros. */
export function fromBaseUnits(units: bigint, decimals: number): string {
  if (units < 0n) throw new Error("amount cannot be negative");
  const base = 10n ** BigInt(decimals);
  const whole = units / base;
  const frac = (units % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export interface PayLine {
  member: Member;
  amountUnits: bigint;
}

export interface PayPlan {
  lines: PayLine[];
  /** What the team is owed, before the fee. */
  grossUnits: bigint;
  /** The fee taken from the run, rounded down. */
  feeUnits: bigint;
  /** What leaves the treasury in total: gross + fee. */
  totalUnits: bigint;
  /** What each line is worth in whole coins, for display. */
  decimals: number;
}

/**
 * Plan one pay run. Same members, same fee, same answer — always.
 * Throws on: a bad wallet, a duplicate wallet, a zero or negative amount,
 * an empty team, or a fee outside 0–100%.
 */
export function planPayroll(members: Member[], feeBps: number, decimals: number): PayPlan {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    throw new Error(`fee must be 0–10000 basis points, got ${feeBps}`);
  }
  if (members.length === 0) throw new Error("a pay run needs at least one person");
  const seen = new Set<string>();
  const lines: PayLine[] = members.map((raw) => {
    const member = MemberSchema.parse(raw);
    const key = member.wallet.toLowerCase();
    if (seen.has(key)) throw new Error(`paid twice in one run: ${member.wallet}`);
    seen.add(key);
    const amountUnits = toBaseUnits(member.monthlyPay, decimals);
    if (amountUnits <= 0n) throw new Error(`pay must be more than zero: ${member.name}`);
    return { member, amountUnits };
  });
  const grossUnits = lines.reduce((sum, line) => sum + line.amountUnits, 0n);
  const feeUnits = (grossUnits * BigInt(feeBps)) / 10_000n;
  return { lines, grossUnits, feeUnits, totalUnits: grossUnits + feeUnits, decimals };
}

/** True when the treasury holds enough to cover the whole run. */
export function canAfford(plan: PayPlan, treasuryUnits: bigint): boolean {
  return treasuryUnits >= plan.totalUnits;
}

export interface StreamTerms {
  /** Smallest units paid per second. */
  ratePerSecondUnits: bigint;
  /** Unix seconds the stream starts. */
  start: number;
  /** Seconds after start before anything can be claimed. */
  cliffSeconds: number;
  /** Unix seconds the stream stops. Must be after start. */
  end: number;
}

/**
 * How much a stream has earned by `now` (unix seconds). Zero before the
 * cliff, then a straight line up to the full amount at the end, then flat.
 * Pure clock maths — the contract and the app compute the same number.
 */
export function streamAccrued(terms: StreamTerms, now: number): bigint {
  const { ratePerSecondUnits, start, cliffSeconds, end } = terms;
  if (end <= start) throw new Error("stream must end after it starts");
  if (ratePerSecondUnits < 0n) throw new Error("stream rate cannot be negative");
  if (cliffSeconds < 0 || start + cliffSeconds > end) {
    throw new Error("cliff must fall inside the stream");
  }
  if (now < start + cliffSeconds) return 0n;
  const paidUntil = Math.min(now, end);
  return ratePerSecondUnits * BigInt(paidUntil - start);
}

/** Full amount a stream will ever pay out. */
export function streamTotal(terms: StreamTerms): bigint {
  return streamAccrued(terms, terms.end);
}

export * from "./schedule.js";
export * from "./checklist.js";
