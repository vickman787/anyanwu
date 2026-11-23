import { describe, expect, it } from "vitest";
import { buildChecklist, checklistReady, type ChecklistInput } from "./checklist.js";

const allGood: ChecklistInput = {
  walletConnected: true,
  qieIdChecked: true,
  qieIdHoldsName: false,
  treasuryCoversRun: true,
  addressesValid: true,
  amountsExact: true,
};

describe("buildChecklist", () => {
  it("passes everything the app actually checked, and says plainly what it did not", () => {
    const items = buildChecklist(allGood);
    expect(items).toHaveLength(7);
    const byLabel = new Map(items.map((i) => [i.label, i]));
    expect(byLabel.get("Wallet connected")?.status).toBe("passed");
    expect(byLabel.get("Treasury covers the run")?.status).toBe("passed");
    expect(byLabel.get("Amounts are exact")?.status).toBe("passed");
    // Holding no .qie name is information, not a failure.
    expect(byLabel.get(".qie name checked")?.status).toBe("passed");
    expect(byLabel.get(".qie name checked")?.detail).toMatch(/holds no \.qie name yet/);
    // What Anyanwu does not check is shown as not checked — never as passed.
    expect(byLabel.get("Sanctions screening")?.status).toBe("not-checked");
    expect(byLabel.get("Sanctions screening")?.detail).toMatch(/Not checked by Anyanwu/);
    expect(byLabel.get("Identity (KYC) checks")?.status).toBe("not-checked");
    expect(byLabel.get("Identity (KYC) checks")?.detail).toMatch(/Not checked by Anyanwu/);
    expect(checklistReady(items)).toBe(true);
  });

  it("a short treasury fails the run, and the reason says so", () => {
    const items = buildChecklist({ ...allGood, treasuryCoversRun: false });
    expect(items.find((i) => i.label === "Treasury covers the run")?.status).toBe("failed");
    expect(checklistReady(items)).toBe(false);
  });

  it("no wallet connected fails, and an unchecked .qie name is not-checked, not failed", () => {
    const items = buildChecklist({ ...allGood, walletConnected: false, qieIdChecked: false });
    expect(items.find((i) => i.label === "Wallet connected")?.status).toBe("failed");
    expect(items.find((i) => i.label === ".qie name checked")?.status).toBe("not-checked");
    expect(checklistReady(items)).toBe(false);
  });

  it("a held .qie name is reported, not hidden", () => {
    const items = buildChecklist({ ...allGood, qieIdHoldsName: true });
    expect(items.find((i) => i.label === ".qie name checked")?.detail).toMatch(/holds a \.qie name/);
  });

  it("bad addresses fail the run", () => {
    const items = buildChecklist({ ...allGood, addressesValid: false });
    expect(items.find((i) => i.label === "Addresses are valid")?.status).toBe("failed");
    expect(checklistReady(items)).toBe(false);
  });
});
