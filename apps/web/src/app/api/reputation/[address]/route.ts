/**
 * GET /api/reputation/[address] — free to read, no sign-in, no payment.
 *
 * What one wallet has been paid, from the public record: how many
 * payments, how much in total, the last payment, and its streams.
 * This is a read API, not a paid agent API — nobody pays to call it,
 * and it never moves money. Amounts are exact smallest-unit counts
 * (QUSDC has 6 decimals); the plain "totalPaid" string is for display.
 */
import { ADDRESS_RE, fromBaseUnits } from "@anyanwu/shared";
import { getPublicRecord } from "../../../../lib/serverLedger";

const DECIMALS = 6;

export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!ADDRESS_RE.test(address)) {
    return Response.json(
      { error: "That does not look like a wallet address. It should start with 0x and be 42 characters long." },
      { status: 400 },
    );
  }
  const lower = address.toLowerCase();
  const { ledger, streams } = getPublicRecord();
  const payments = ledger.filter(
    (e) => e.counterparty?.toLowerCase() === lower && (e.type === "pay_run" || e.type === "stream_claimed"),
  );
  const totalUnits = payments.reduce((sum, e) => sum + BigInt(e.amountUnits), 0n);
  const last = payments.length > 0 ? payments[payments.length - 1] : null;
  const myStreams = streams
    .filter((s) => s.worker.toLowerCase() === lower)
    .map((s) => ({
      id: s.id,
      workerName: s.workerName,
      claimedUnits: s.claimedUnits,
      claimed: fromBaseUnits(BigInt(s.claimedUnits), DECIMALS),
      endsAt: new Date(s.end * 1000).toISOString(),
    }));
  return Response.json({
    address: lower,
    payments: payments.length,
    totalPaidUnits: totalUnits.toString(),
    totalPaid: fromBaseUnits(totalUnits, DECIMALS),
    lastPayment: last
      ? { type: last.type, amountUnits: last.amountUnits, amount: fromBaseUnits(BigInt(last.amountUnits), DECIMALS), memo: last.memo, createdAt: last.createdAt }
      : null,
    streams: myStreams,
    note: "Free to read. No sign-in, no payment to call this.",
  });
}
