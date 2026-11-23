/**
 * POST /api/payroll/sync — the demo's way of publishing its record.
 *
 * The dashboard keeps the demo in the browser; after each change it
 * sends the record here so the free read routes can answer for it.
 * This is not part of the public API: it takes no payment, needs no
 * sign-in, and only stores what a visitor's own browser chose to
 * share — the same entries their dashboard shows. Anything that does
 * not look like a real record entry is refused.
 */
import { z } from "zod";
import { setPublicRecord } from "../../../../lib/serverLedger";

const LedgerEntrySchema = z.object({
  seq: z.number().int().min(0),
  prevHash: z.string().min(1),
  hash: z.string().min(1),
  type: z.string().min(1).max(40),
  actor: z.string().min(1).max(100),
  counterparty: z.string().max(100).optional(),
  amountUnits: z.string().regex(/^\d+$/),
  memo: z.string().max(200),
  createdAt: z.string().min(1),
});

const StreamSchema = z.object({
  id: z.string().min(1),
  worker: z.string().min(1),
  workerName: z.string().min(1),
  ratePerSecondUnits: z.string().regex(/^\d+$/),
  start: z.number().int(),
  cliffSeconds: z.number().int().min(0),
  end: z.number().int(),
  claimedUnits: z.string().regex(/^\d+$/),
});

const SyncSchema = z.object({
  ledger: z.array(LedgerEntrySchema).max(10_000),
  streams: z.array(StreamSchema).max(10_000),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That is not valid JSON." }, { status: 400 });
  }
  const parsed = SyncSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "That record does not look like Anyanwu's record." }, { status: 400 });
  }
  setPublicRecord(parsed.data);
  return Response.json({ ok: true, entries: parsed.data.ledger.length, streams: parsed.data.streams.length });
}
