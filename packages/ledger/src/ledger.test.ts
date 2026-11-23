import { describe, expect, it } from "vitest";
import { appendLedger, GENESIS_HASH, verifyLedger, type LedgerEntry, type LedgerEvent } from "./index.js";

const funded: LedgerEvent = {
  type: "treasury_funded",
  actor: "0xEmployer",
  amountUnits: "1000000000",
  memo: "Treasury funded — 1,000 test dollars",
  createdAt: "2026-11-23T06:00:00.000Z",
};
const paid: LedgerEvent = {
  type: "pay_run",
  actor: "0xEmployer",
  counterparty: "0xAda",
  amountUnits: "250000000",
  memo: "November pay run — 2 people",
  createdAt: "2026-11-23T06:05:00.000Z",
};

describe("appendLedger", () => {
  it("starts the chain from the genesis hash", async () => {
    const entries = await appendLedger([], funded);
    expect(entries).toHaveLength(1);
    expect(entries[0].seq).toBe(0);
    expect(entries[0].prevHash).toBe(GENESIS_HASH);
    expect(entries[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("chains each entry to the one before it", async () => {
    const entries = await appendLedger(await appendLedger([], funded), paid);
    expect(entries[1].seq).toBe(1);
    expect(entries[1].prevHash).toBe(entries[0].hash);
  });

  it("is deterministic: same events, same hashes", async () => {
    const a = await appendLedger(await appendLedger([], funded), paid);
    const b = await appendLedger(await appendLedger([], funded), paid);
    expect(a).toEqual(b);
  });

  it("refuses a bad event", async () => {
    await expect(appendLedger([], { ...funded, amountUnits: "12.5" })).rejects.toThrow();
    await expect(appendLedger([], { ...funded, amountUnits: "-1" })).rejects.toThrow();
  });
});

describe("verifyLedger", () => {
  it("passes a clean chain", async () => {
    const entries = await appendLedger(await appendLedger([], funded), paid);
    expect(await verifyLedger(entries)).toBeNull();
  });

  it("catches a changed amount in an old entry", async () => {
    const entries = await appendLedger(await appendLedger([], funded), paid);
    const tampered: LedgerEntry[] = [{ ...entries[0], amountUnits: "1" }, entries[1]];
    expect(await verifyLedger(tampered)).toMatch(/entry 0: hash does not match/);
  });

  it("catches a removed middle entry", async () => {
    const entries = await appendLedger(await appendLedger([], funded), paid);
    expect(await verifyLedger([entries[0], entries[1]])).toBeNull();
    const cut = [entries[1]];
    expect(await verifyLedger(cut)).toMatch(/previous hash does not match/);
  });
});
