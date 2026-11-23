/**
 * @anyanwu/ledger — the public record. Every money event (treasury funded,
 * pay run, stream claimed, payment received) is one entry in a hash chain:
 * each entry's hash covers the previous entry's hash, so changing any
 * old entry breaks every hash after it. Anyone can re-check the chain
 * with `verifyLedger` — no trust needed.
 *
 * Hashing uses SHA-256 from the platform's Web Crypto (`globalThis.crypto`),
 * which exists in Node 18+ and in browsers. Amounts are plain decimal
 * strings of smallest units, so the same event always hashes the same way.
 */
import { z } from "zod";

export const LedgerEventSchema = z.object({
  /** What happened: "treasury_funded" | "pay_run" | "stream_started" | "stream_claimed" | "payment_received" */
  type: z.string().min(1).max(40),
  /** Wallet that acted. */
  actor: z.string().min(1).max(100),
  /** Wallet that was paid, when there is one. */
  counterparty: z.string().max(100).optional(),
  /** Amount in smallest units, as a decimal string. "0" when no money moved. */
  amountUnits: z.string().regex(/^\d+$/),
  /** Human-readable note, e.g. "November pay run — 2 people". */
  memo: z.string().max(200),
  /** ISO timestamp of the event. */
  createdAt: z.string().min(1),
});
export type LedgerEvent = z.infer<typeof LedgerEventSchema>;

export interface LedgerEntry extends LedgerEvent {
  seq: number;
  prevHash: string;
  hash: string;
}

export const GENESIS_HASH = "0".repeat(64);

export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("SHA-256 is not available on this platform");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The exact bytes that get hashed for one entry. Keep this stable forever. */
function canonical(entry: Omit<LedgerEntry, "hash">): string {
  return JSON.stringify([
    entry.seq,
    entry.prevHash,
    entry.type,
    entry.actor,
    entry.counterparty ?? "",
    entry.amountUnits,
    entry.memo,
    entry.createdAt,
  ]);
}

/** Add one event to the end of the chain. Never edit an old entry. */
export async function appendLedger(entries: readonly LedgerEntry[], event: LedgerEvent): Promise<LedgerEntry[]> {
  const parsed = LedgerEventSchema.parse(event);
  const prev = entries[entries.length - 1];
  const seq = prev ? prev.seq + 1 : 0;
  const prevHash = prev ? prev.hash : GENESIS_HASH;
  const draft = { ...parsed, seq, prevHash };
  const hash = await sha256Hex(canonical(draft));
  return [...entries, { ...draft, hash }];
}

/** Re-check the whole chain. Returns the first problem found, or null. */
export async function verifyLedger(entries: readonly LedgerEntry[]): Promise<string | null> {
  let prevHash = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.prevHash !== prevHash) {
      return `entry ${entry.seq}: previous hash does not match the entry before it`;
    }
    const { hash, ...rest } = entry;
    if ((await sha256Hex(canonical(rest))) !== hash) {
      return `entry ${entry.seq}: hash does not match its contents`;
    }
    prevHash = hash;
  }
  return null;
}
