import { describe, expect, it } from "vitest";
import {
  advanceDate,
  createSchedule,
  currentPayPeriod,
  isDue,
  isOverdue,
  markRun,
  nextDueAt,
  periodKey,
  wouldDuplicate,
  type PaySchedule,
} from "./schedule.js";

// 2026-11-23 is a Monday. All times are UTC.
const NOV_23 = Date.parse("2026-11-23T09:00:00Z");
const NOV_22 = Date.parse("2026-11-22T09:00:00Z");
const NOV_24 = Date.parse("2026-11-24T09:00:00Z");

function once(runAt = "2026-11-23T09:00:00Z"): PaySchedule {
  return createSchedule({ id: "s1", label: "November pay", payPeriod: "Nov 2026", runAt, repeat: "once" });
}

describe("advanceDate", () => {
  it("weekly adds seven days", () => {
    expect(advanceDate(new Date("2026-11-23T09:00:00Z"), "weekly")?.toISOString()).toBe("2026-11-30T09:00:00.000Z");
  });

  it("monthly clamps 31 January to 28 February, never 3 March", () => {
    expect(advanceDate(new Date("2026-01-31T09:00:00Z"), "monthly")?.toISOString()).toBe("2026-02-28T09:00:00.000Z");
  });

  it("monthly moves 15 November to 15 December", () => {
    expect(advanceDate(new Date("2026-11-15T09:00:00Z"), "monthly")?.toISOString()).toBe("2026-12-15T09:00:00.000Z");
  });

  it("once has no next run", () => {
    expect(advanceDate(new Date("2026-11-23T09:00:00Z"), "once")).toBeNull();
  });
});

describe("periodKey", () => {
  it("monthly groups by month", () => {
    expect(periodKey(new Date("2026-11-23T09:00:00Z"), "monthly")).toBe("2026-11");
    expect(periodKey(new Date("2026-11-30T09:00:00Z"), "monthly")).toBe("2026-11");
  });

  it("weekly groups by ISO week, not by month", () => {
    const monday = periodKey(new Date("2026-11-23T09:00:00Z"), "weekly");
    expect(periodKey(new Date("2026-11-29T09:00:00Z"), "weekly")).toBe(monday);
    expect(periodKey(new Date("2026-11-30T09:00:00Z"), "weekly")).not.toBe(monday);
  });

  it("once groups by day", () => {
    expect(periodKey(new Date("2026-11-23T09:00:00Z"), "once")).toBe("2026-11-23");
  });
});

describe("nextDueAt / isDue / isOverdue", () => {
  it("a one-off run is not due before its time, and is due at its time", () => {
    expect(isDue(once(), NOV_22)).toBe(false);
    expect(nextDueAt(once(), NOV_22)).toBe(NOV_23);
    expect(isDue(once(), NOV_23)).toBe(true);
  });

  it("a weekly run is due again seven days later", () => {
    const weekly = createSchedule({ id: "s2", label: "Weekly", payPeriod: "Nov 2026", runAt: "2026-11-23T09:00:00Z", repeat: "weekly" });
    const afterFirst = markRun(weekly, NOV_23);
    expect(isDue(afterFirst, NOV_24)).toBe(false);
    expect(nextDueAt(afterFirst, NOV_24)).toBe(Date.parse("2026-11-30T09:00:00Z"));
    expect(isDue(afterFirst, Date.parse("2026-11-30T09:00:00Z"))).toBe(true);
  });

  it("a run due an hour ago is due, not overdue; a run due two days ago is overdue", () => {
    const late = once("2026-11-21T09:00:00Z");
    expect(isDue(late, Date.parse("2026-11-21T10:00:00Z"))).toBe(true);
    expect(isOverdue(late, Date.parse("2026-11-21T10:00:00Z"))).toBe(false);
    expect(isOverdue(late, Date.parse("2026-11-23T09:00:00Z"))).toBe(true);
  });

  it("a missed week does not stay due forever after the employer catches up", () => {
    const weekly = createSchedule({ id: "s3", label: "Weekly", payPeriod: "Nov 2026", runAt: "2026-11-02T09:00:00Z", repeat: "weekly" });
    const caughtUp = markRun(weekly, NOV_23);
    expect(isDue(caughtUp, NOV_23)).toBe(false);
    expect(nextDueAt(caughtUp, NOV_23)).toBe(Date.parse("2026-11-30T09:00:00Z"));
  });
});

describe("wouldDuplicate / markRun", () => {
  it("running twice for the same period is a duplicate", () => {
    const schedule = once();
    expect(wouldDuplicate(schedule, NOV_23)).toBe(false);
    const ran = markRun(schedule, NOV_23);
    expect(wouldDuplicate(ran, NOV_23)).toBe(true);
    expect(nextDueAt(ran, NOV_23)).toBeNull();
  });

  it("markRun records the period that was paid", () => {
    const ran = markRun(once(), NOV_23);
    expect(ran.lastRunPeriod).toBe("2026-11-23");
    expect(ran.lastRunAt).toBe(new Date(NOV_23).toISOString());
  });

  it("markRun refuses when nothing is due yet", () => {
    expect(() => markRun(once(), NOV_22)).toThrow(/nothing is due/i);
  });
});

describe("createSchedule validation", () => {
  it("rejects a bad date, a bad repeat, and an empty label", () => {
    expect(() => createSchedule({ id: "x", label: "Pay", payPeriod: "Nov 2026", runAt: "not a date", repeat: "weekly" })).toThrow();
    expect(() =>
      createSchedule({ id: "x", label: "Pay", payPeriod: "Nov 2026", runAt: "2026-11-23T09:00:00Z", repeat: "daily" as never }),
    ).toThrow();
    expect(() => createSchedule({ id: "x", label: "  ", payPeriod: "Nov 2026", runAt: "2026-11-23T09:00:00Z", repeat: "once" })).toThrow();
  });
});

describe("currentPayPeriod", () => {
  it("labels a date like Nov 2026", () => {
    expect(currentPayPeriod(NOV_23)).toBe("Nov 2026");
    expect(currentPayPeriod(Date.parse("2026-12-01T00:00:00Z"))).toBe("Dec 2026");
  });
});
