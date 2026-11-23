import { describe, expect, it } from "vitest";
import {
  canAfford,
  fromBaseUnits,
  planPayroll,
  streamAccrued,
  streamTotal,
  toBaseUnits,
  type Member,
} from "./index.js";

const ada: Member = { name: "Ada", wallet: "0x1111111111111111111111111111111111111111", monthlyPay: "250", payStyle: "lump" };
const bola: Member = { name: "Bola", wallet: "0x2222222222222222222222222222222222222222", monthlyPay: "120.50", payStyle: "stream" };

describe("toBaseUnits / fromBaseUnits (QUSDC has 6 decimals)", () => {
  it("parses whole and fractional amounts exactly, no floats", () => {
    expect(toBaseUnits("250", 6)).toBe(250_000_000n);
    expect(toBaseUnits("120.50", 6)).toBe(120_500_000n);
    expect(toBaseUnits("0.000001", 6)).toBe(1n);
  });

  it("round-trips without losing a unit", () => {
    expect(fromBaseUnits(toBaseUnits("120.50", 6), 6)).toBe("120.5");
    expect(fromBaseUnits(0n, 6)).toBe("0");
    expect(fromBaseUnits(toBaseUnits("1000", 18), 18)).toBe("1000");
  });

  it("rejects more decimals than the coin has, and bad input", () => {
    expect(() => toBaseUnits("1.0000001", 6)).toThrow(/too many decimals/);
    expect(() => toBaseUnits("ten", 6)).toThrow();
    expect(() => toBaseUnits("-5", 6)).toThrow();
    expect(() => fromBaseUnits(-1n, 6)).toThrow();
  });
});

describe("planPayroll", () => {
  it("adds a run up and takes the fee, rounded down", () => {
    const plan = planPayroll([ada, bola], 100, 6); // 1% fee
    expect(plan.grossUnits).toBe(370_500_000n);
    expect(plan.feeUnits).toBe(3_705_000n);
    expect(plan.totalUnits).toBe(374_205_000n);
    expect(plan.lines).toHaveLength(2);
  });

  it("charges no fee at 0 bps", () => {
    const plan = planPayroll([ada], 0, 6);
    expect(plan.feeUnits).toBe(0n);
    expect(plan.totalUnits).toBe(plan.grossUnits);
  });

  it("is deterministic: same team, same plan", () => {
    expect(planPayroll([ada, bola], 100, 6)).toEqual(planPayroll([ada, bola], 100, 6));
  });

  it("refuses a wallet paid twice in one run", () => {
    expect(() => planPayroll([ada, { ...ada, name: "Ada again" }], 0, 6)).toThrow(/paid twice/);
  });

  it("refuses bad wallets, zero pay, empty teams, and wild fees", () => {
    expect(() => planPayroll([{ ...ada, wallet: "not-an-address" }], 0, 6)).toThrow();
    expect(() => planPayroll([{ ...ada, monthlyPay: "0" }], 0, 6)).toThrow(/more than zero/);
    expect(() => planPayroll([], 0, 6)).toThrow(/at least one person/);
    expect(() => planPayroll([ada], 10_001, 6)).toThrow(/fee must be/);
    expect(() => planPayroll([ada], -1, 6)).toThrow(/fee must be/);
  });
});

describe("canAfford", () => {
  it("says yes only when the treasury covers gross + fee", () => {
    const plan = planPayroll([ada, bola], 100, 6);
    expect(canAfford(plan, plan.totalUnits)).toBe(true);
    expect(canAfford(plan, plan.totalUnits - 1n)).toBe(false);
  });
});

describe("streamAccrued", () => {
  const terms = { ratePerSecondUnits: 100n, start: 1_000, cliffSeconds: 100, end: 2_000 };

  it("pays nothing before the cliff", () => {
    expect(streamAccrued(terms, 999)).toBe(0n);
    expect(streamAccrued(terms, 1_099)).toBe(0n);
  });

  it("grows in a straight line after the cliff, and stops at the end", () => {
    expect(streamAccrued(terms, 1_100)).toBe(10_000n);
    expect(streamAccrued(terms, 1_500)).toBe(50_000n);
    expect(streamAccrued(terms, 2_000)).toBe(100_000n);
    expect(streamAccrued(terms, 99_999)).toBe(100_000n);
    expect(streamTotal(terms)).toBe(100_000n);
  });

  it("rejects a stream that ends before it starts, or a cliff past the end", () => {
    expect(() => streamAccrued({ ...terms, end: 1_000 }, 1_500)).toThrow();
    expect(() => streamAccrued({ ...terms, cliffSeconds: 9_999 }, 1_500)).toThrow();
    expect(() => streamAccrued({ ...terms, ratePerSecondUnits: -1n }, 1_500)).toThrow();
  });
});
