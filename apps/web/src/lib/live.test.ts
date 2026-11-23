import { describe, expect, it } from "vitest";
import {
  encodeApprove,
  encodeBalance,
  encodeFund,
  encodeRunPayroll,
  liveTxUrl,
  noteToBytes32,
  parsePayRunId,
  PAY_RUN_TOPIC,
  SELECTORS,
} from "./live";

describe("live encoding", () => {
  it("uses the selectors checked with cast sig", () => {
    expect(SELECTORS.approve).toBe("0x095ea7b3");
    expect(SELECTORS.allowance).toBe("0xdd62ed3e");
    expect(SELECTORS.balanceOf).toBe("0x70a08231");
    expect(SELECTORS.fund).toBe("0xca1d209d");
    expect(SELECTORS.runPayroll).toBe("0x79b0c43e");
    expect(SELECTORS.balance).toBe("0xb69ef8a8");
  });

  it("encodes approve(spender, amount)", () => {
    expect(
      encodeApprove("0x366f7234114C1be6dE95b2DF515890559C5558Ed", 1_000_000n),
    ).toBe(
      "0x095ea7b3" +
        "000000000000000000000000366f7234114c1be6de95b2df515890559c5558ed" +
        "00000000000000000000000000000000000000000000000000000000000f4240",
    );
  });

  it("encodes fund(amount) and balance()", () => {
    expect(encodeFund(2_500_000n)).toBe(
      "0xca1d209d00000000000000000000000000000000000000000000000000000000002625a0",
    );
    expect(encodeBalance()).toBe("0xb69ef8a8");
  });

  it("encodes a short note as bytes32 and refuses a long one", () => {
    expect(noteToBytes32("Nov 2026")).toBe(
      "0x4e6f762032303236000000000000000000000000000000000000000000000000",
    );
    expect(() => noteToBytes32("a".repeat(32))).toThrow(/too long/);
  });

  it("encodes runPayroll exactly like cast calldata", () => {
    // Ground truth from: cast calldata
    // "runPayroll(address[],uint256[],bytes32)"
    // "[0x1111...1111,0x2222...2222]" "[1000000,2000000]" "0x4e6f76..."
    expect(
      encodeRunPayroll(
        [
          "0x1111111111111111111111111111111111111111",
          "0x2222222222222222222222222222222222222222",
        ],
        [1_000_000n, 2_000_000n],
        "Nov 2026",
      ),
    ).toBe(
      "0x79b0c43e" +
        "0000000000000000000000000000000000000000000000000000000000000060" +
        "00000000000000000000000000000000000000000000000000000000000000c0" +
        "4e6f762032303236000000000000000000000000000000000000000000000000" +
        "0000000000000000000000000000000000000000000000000000000000000002" +
        "0000000000000000000000001111111111111111111111111111111111111111" +
        "0000000000000000000000002222222222222222222222222222222222222222" +
        "0000000000000000000000000000000000000000000000000000000000000002" +
        "00000000000000000000000000000000000000000000000000000000000f4240" +
        "00000000000000000000000000000000000000000000000000000000001e8480",
    );
  });

  it("refuses an empty run and mismatched lists", () => {
    expect(() => encodeRunPayroll([], [], "Nov 2026")).toThrow(/at least one person/);
    expect(() =>
      encodeRunPayroll(["0x1111111111111111111111111111111111111111"], [1n, 2n], "Nov 2026"),
    ).toThrow(/do not line up/);
  });

  it("reads the run number out of a PayRun receipt", () => {
    const receipt = {
      status: "0x1",
      logs: [
        {
          address: "0x17802a05560bCa3615E6758df066Ac3B420b13A4",
          topics: [PAY_RUN_TOPIC, "0x0000000000000000000000000000000000000000000000000000000000000007"],
          data: "0x",
        },
      ],
    };
    expect(parsePayRunId(receipt, "0x17802a05560bca3615e6758df066ac3b420b13a4")).toBe(7n);
    expect(parsePayRunId({ status: "0x1", logs: [] }, "0x17802a05560bca3615e6758df066ac3b420b13a4")).toBeNull();
  });

  it("links a tx hash to the QIE explorer", () => {
    expect(liveTxUrl("0xabc")).toBe("https://mainnet.qie.digital/tx/0xabc");
  });

  it("reads live balances from the right contracts", async () => {
    const { readLiveBalances, BATCHER_MAINNET, TREASURY_MAINNET } = await import("./live");
    const calls: { to: string; data: string }[] = [];
    const seen = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { params: [{ to: string; data: string }] };
      const { to, data } = body.params[0];
      calls.push({ to, data });
      // 5 QUSDC in the treasury, 2 in the batcher, 10 in the wallet.
      const account = data.slice(-40).toLowerCase();
      const result =
        to.toLowerCase() === TREASURY_MAINNET.toLowerCase()
          ? "0x00000000000000000000000000000000000000000000000000000000004c4b40"
          : data.startsWith("0x70a08231") && account === BATCHER_MAINNET.toLowerCase().slice(2)
            ? "0x00000000000000000000000000000000000000000000000000000000001e8480"
            : "0x0000000000000000000000000000000000000000000000000000000000989680";
      return { json: async () => ({ result }) } as Response;
    }) as typeof fetch;
    try {
      const balances = await readLiveBalances("0x1111111111111111111111111111111111111111");
      expect(balances.treasuryUnits).toBe(5_000_000n);
      expect(balances.batcherUnits).toBe(2_000_000n);
      expect(balances.myQusdcUnits).toBe(10_000_000n);
      // The batcher balance is read as the token's balanceOf it — never
      // as a balance() call on the batcher, which reverts.
      expect(calls.some((c) => c.to.toLowerCase() === BATCHER_MAINNET.toLowerCase() && c.data === "0xb69ef8a8")).toBe(false);
    } finally {
      globalThis.fetch = seen;
    }
  });
});
