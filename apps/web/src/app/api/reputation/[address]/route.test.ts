import { describe, expect, it } from "vitest";
import { setPublicRecord } from "../../../../lib/serverLedger";
import { GET } from "./route";

const ADA = "0x1111111111111111111111111111111111111111";
const BOLA = "0x2222222222222222222222222222222222222222";

function seed() {
  setPublicRecord({
    ledger: [
      {
        seq: 0, prevHash: "0".repeat(64), hash: "a".repeat(64),
        type: "treasury_funded", actor: "demo", amountUnits: "1000000000",
        memo: "Treasury funded — 1,000 test dollars", createdAt: "2026-11-23T09:00:00Z",
      },
      {
        seq: 1, prevHash: "a".repeat(64), hash: "b".repeat(64),
        type: "pay_run", actor: "demo", counterparty: ADA, amountUnits: "250000000",
        memo: "Nov 2026 — Pay run — Ada, 250 test dollars", createdAt: "2026-11-23T10:00:00Z",
      },
      {
        seq: 2, prevHash: "b".repeat(64), hash: "c".repeat(64),
        type: "pay_run", actor: "demo", counterparty: BOLA, amountUnits: "120500000",
        memo: "Nov 2026 — Pay run — Bola, 120.5 test dollars", createdAt: "2026-11-23T10:00:00Z",
      },
      {
        seq: 3, prevHash: "c".repeat(64), hash: "d".repeat(64),
        type: "stream_claimed", actor: "demo", counterparty: ADA, amountUnits: "5000000",
        memo: "Stream claimed — Ada, 5 test dollars", createdAt: "2026-11-24T10:00:00Z",
      },
    ],
    streams: [
      {
        id: "stream-1", worker: ADA, workerName: "Ada",
        ratePerSecondUnits: "96", start: 1795428000, cliffSeconds: 0,
        end: 1798019999, claimedUnits: "5000000",
      },
    ],
  });
}

describe("GET /api/reputation/[address]", () => {
  it("returns one wallet's payments: count, exact total, last payment, and streams", async () => {
    seed();
    const res = await GET(new Request("http://localhost/api/reputation/x"), { params: Promise.resolve({ address: ADA }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      address: string; payments: number; totalPaidUnits: string; totalPaid: string;
      lastPayment: { memo: string } | null; streams: { workerName: string }[]; note: string;
    };
    expect(body.address).toBe(ADA.toLowerCase());
    expect(body.payments).toBe(2); // one pay run + one stream claim; the treasury funding is not theirs
    expect(body.totalPaidUnits).toBe("255000000");
    expect(body.totalPaid).toBe("255");
    expect(body.lastPayment?.memo).toMatch(/Stream claimed — Ada/);
    expect(body.streams).toHaveLength(1);
    expect(body.streams[0].workerName).toBe("Ada");
    expect(body.note).toMatch(/Free to read/);
  });

  it("returns zero payments for a wallet with no record, not an error", async () => {
    seed();
    const res = await GET(new Request("http://localhost/api/reputation/x"), {
      params: Promise.resolve({ address: "0x3333333333333333333333333333333333333333" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { payments: number; totalPaidUnits: string; lastPayment: unknown };
    expect(body.payments).toBe(0);
    expect(body.totalPaidUnits).toBe("0");
    expect(body.lastPayment).toBeNull();
  });

  it("refuses an address that is not an address", async () => {
    const res = await GET(new Request("http://localhost/api/reputation/x"), { params: Promise.resolve({ address: "not-a-wallet" }) });
    expect(res.status).toBe(400);
  });
});
