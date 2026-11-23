import { describe, expect, it } from "vitest";
import { setPublicRecord } from "../../../../lib/serverLedger";
import { GET, payPeriodOf } from "./route";

const ADA = "0x1111111111111111111111111111111111111111";
const BOLA = "0x2222222222222222222222222222222222222222";

function seed() {
  setPublicRecord({
    ledger: [
      {
        seq: 0, prevHash: "0".repeat(64), hash: "a".repeat(64),
        type: "pay_run", actor: "demo", counterparty: ADA, amountUnits: "250000000",
        memo: "Nov 2026 — Pay run — Ada, 250 test dollars", createdAt: "2026-11-23T10:00:00Z",
      },
      {
        seq: 1, prevHash: "a".repeat(64), hash: "b".repeat(64),
        type: "pay_run", actor: "demo", counterparty: BOLA, amountUnits: "120500000",
        memo: "Nov 2026 — Pay run — Bola, 120.5 test dollars", createdAt: "2026-11-23T10:00:00Z",
      },
      {
        seq: 2, prevHash: "b".repeat(64), hash: "c".repeat(64),
        type: "pay_run", actor: "demo", counterparty: ADA, amountUnits: "250000000",
        memo: "Dec 2026 — Pay run — Ada, 250 test dollars", createdAt: "2026-12-23T10:00:00Z",
      },
      {
        seq: 3, prevHash: "c".repeat(64), hash: "d".repeat(64),
        type: "treasury_funded", actor: "demo", amountUnits: "1000000000",
        memo: "Treasury funded — 1,000 test dollars", createdAt: "2026-12-23T09:00:00Z",
      },
    ],
    streams: [],
  });
}

describe("payPeriodOf", () => {
  it("takes the pay period from the front of a memo", () => {
    expect(payPeriodOf("Nov 2026 — Pay run — Ada, 250 test dollars")).toBe("Nov 2026");
  });
});

describe("GET /api/payroll/runs", () => {
  it("groups one run's payments by pay period, with exact totals", async () => {
    seed();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      runs: { payPeriod: string; payments: number; totalPaidUnits: string; totalPaid: string }[];
      totalRuns: number; note: string;
    };
    expect(body.totalRuns).toBe(2);
    // Most recent first.
    expect(body.runs[0].payPeriod).toBe("Dec 2026");
    expect(body.runs[0].payments).toBe(1);
    expect(body.runs[0].totalPaidUnits).toBe("250000000");
    expect(body.runs[1].payPeriod).toBe("Nov 2026");
    expect(body.runs[1].payments).toBe(2);
    expect(body.runs[1].totalPaidUnits).toBe("370500000");
    expect(body.runs[1].totalPaid).toBe("370.5");
    expect(body.note).toMatch(/Free to read/);
  });

  it("returns an empty list when nothing has been paid yet", async () => {
    setPublicRecord({ ledger: [], streams: [] });
    const body = (await (await GET()).json()) as { runs: unknown[]; totalRuns: number };
    expect(body.runs).toEqual([]);
    expect(body.totalRuns).toBe(0);
  });
});
