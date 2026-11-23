/**
 * GET /api/payroll/runs — free to read, no sign-in, no payment.
 *
 * Recent pay runs from the public record, grouped by pay period and
 * day (one run pays the whole team, so one run is many payments).
 * This is a read API, not a paid agent API — nobody pays to call it,
 * and it never moves money.
 */
import { fromBaseUnits } from "@anyanwu/shared";
import { getPublicRecord } from "../../../../lib/serverLedger";

const DECIMALS = 6;

/** The pay period is the first part of a pay-run memo, e.g. "Nov 2026". */
export function payPeriodOf(memo: string): string {
  return memo.split(" — ")[0] ?? memo;
}

export async function GET() {
  const { ledger } = getPublicRecord();
  const runs = ledger.filter((e) => e.type === "pay_run");
  const groups = new Map<string, { payPeriod: string; day: string; payments: number; totalUnits: bigint; firstAt: string; lastAt: string }>();
  for (const entry of runs) {
    const day = entry.createdAt.slice(0, 10);
    const key = `${payPeriodOf(entry.memo)}|${day}`;
    const group = groups.get(key) ?? {
      payPeriod: payPeriodOf(entry.memo),
      day,
      payments: 0,
      totalUnits: 0n,
      firstAt: entry.createdAt,
      lastAt: entry.createdAt,
    };
    group.payments += 1;
    group.totalUnits += BigInt(entry.amountUnits);
    if (entry.createdAt < group.firstAt) group.firstAt = entry.createdAt;
    if (entry.createdAt > group.lastAt) group.lastAt = entry.createdAt;
    groups.set(key, group);
  }
  const sorted = [...groups.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)).slice(0, 20);
  return Response.json({
    runs: sorted.map((g) => ({
      payPeriod: g.payPeriod,
      day: g.day,
      payments: g.payments,
      totalPaidUnits: g.totalUnits.toString(),
      totalPaid: fromBaseUnits(g.totalUnits, DECIMALS),
      firstPaymentAt: g.firstAt,
      lastPaymentAt: g.lastAt,
    })),
    totalRuns: sorted.length,
    note: "Free to read. No sign-in, no payment to call this.",
  });
}
