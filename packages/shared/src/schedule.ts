/**
 * @anyanwu/shared — scheduled pay runs. Pure date maths only: no I/O,
 * no clock reads inside the functions (the caller passes `nowMs`), so
 * every answer is easy to test.
 *
 * A schedule says: pay this team on this date, and then either never
 * again ("once"), every week, or every month. The app stores schedules
 * in the browser and only runs one when it is due.
 *
 * The rule that keeps the team from being paid twice for the same
 * period: every scheduled run belongs to one pay period (a day for
 * "once", an ISO week for "weekly", a month for "monthly"). A run is
 * recorded against that period, and a second run for the same period
 * is refused.
 */
import { z } from "zod";

export const RepeatSchema = z.enum(["once", "weekly", "monthly"]);
export type Repeat = z.infer<typeof RepeatSchema>;

export const PayScheduleSchema = z.object({
  id: z.string().min(1).max(80),
  /** Short name, e.g. "November pay". */
  label: z.string().min(1).max(80),
  /** The pay period this schedule pays, e.g. "Nov 2026". Shown on every payment it makes. */
  payPeriod: z.string().min(1).max(40),
  /** ISO timestamp of the first scheduled run. */
  runAt: z.string().min(1),
  repeat: RepeatSchema,
  /** ISO timestamp of the last run that actually happened, or null. */
  lastRunAt: z.string().nullable(),
  /** Pay period of the last run that actually happened, or null. */
  lastRunPeriod: z.string().nullable(),
});
export type PaySchedule = z.infer<typeof PayScheduleSchema>;

const DAY_MS = 24 * 3600 * 1000;

function parseDate(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`not a date: ${iso}`);
  return date;
}

/** "Nov 2026" — the pay-period label for a date. */
export function currentPayPeriod(nowMs: number): string {
  const date = new Date(nowMs);
  return `${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${date.getUTCFullYear()}`;
}

/** Next run after `date` for this repeat. Null when there is no next run. */
export function advanceDate(date: Date, repeat: Repeat): Date | null {
  if (repeat === "once") return null;
  if (repeat === "weekly") return new Date(date.getTime() + 7 * DAY_MS);
  // Monthly: same day next month, clamped to the last day of that month
  // (31 January -> 28 February, never 3 March).
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const targetMonth = month + 1;
  const targetYear = year + Math.floor(targetMonth / 12);
  const lastDay = new Date(Date.UTC(targetYear, (targetMonth % 12) + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth % 12,
      Math.min(day, lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/** The pay period a date belongs to, for this repeat. */
export function periodKey(date: Date, repeat: Repeat): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  if (repeat === "monthly") return `${y}-${m}`;
  if (repeat === "once") return `${y}-${m}-${d}`;
  // ISO week: Thursday of this week decides the week-numbering year.
  const thursday = new Date(date.getTime());
  thursday.setUTCDate(thursday.getUTCDate() + (4 - ((thursday.getUTCDay() + 6) % 7)));
  const weekYear = thursday.getUTCFullYear();
  const weekStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((thursday.getTime() - weekStart.getTime()) / DAY_MS + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function validate(schedule: PaySchedule): PaySchedule {
  const parsed = PayScheduleSchema.parse(schedule);
  parseDate(parsed.runAt);
  if (parsed.lastRunAt) parseDate(parsed.lastRunAt);
  return parsed;
}

/**
 * The next run that has not been paid yet, as a unix timestamp — or null
 * when the schedule is finished (a "once" schedule that already ran).
 * Runs already paid are skipped by their pay period, never by guessing.
 */
export function nextDueAt(schedule: PaySchedule, nowMs: number): number | null {
  const parsed = validate(schedule);
  const lastRunMs = parsed.lastRunAt ? parseDate(parsed.lastRunAt).getTime() : null;
  let occurrence = parseDate(parsed.runAt);
  for (let i = 0; i < 120; i++) {
    // A run covers every occurrence up to the moment it happened, and
    // the pay period it was recorded against. Skip both, so a missed
    // week does not stay due forever after the employer catches up.
    const coveredByTime = lastRunMs !== null && occurrence.getTime() <= lastRunMs;
    const coveredByPeriod = periodKey(occurrence, parsed.repeat) === parsed.lastRunPeriod;
    if (!coveredByTime && !coveredByPeriod) {
      return occurrence.getTime();
    }
    const next = advanceDate(occurrence, parsed.repeat);
    if (!next) return null;
    occurrence = next;
  }
  return null;
}

/** The pay period of the latest run that falls due by `nowMs`, or null when none is due yet. */
export function duePeriodKey(schedule: PaySchedule, nowMs: number): string | null {
  const parsed = validate(schedule);
  let occurrence = parseDate(parsed.runAt);
  let due: Date | null = null;
  for (let i = 0; i < 120; i++) {
    if (occurrence.getTime() > nowMs) break;
    due = occurrence;
    const next = advanceDate(occurrence, parsed.repeat);
    if (!next) break;
    occurrence = next;
  }
  return due ? periodKey(due, parsed.repeat) : null;
}

/** True when a run is due now and has not been paid yet. */
export function isDue(schedule: PaySchedule, nowMs: number): boolean {
  const next = nextDueAt(schedule, nowMs);
  return next !== null && next <= nowMs;
}

/**
 * True when a run has been due for more than a day and still has not
 * been paid. A run due an hour ago is due, not overdue — the employer
 * may simply not have opened the dashboard yet.
 */
export function isOverdue(schedule: PaySchedule, nowMs: number): boolean {
  const next = nextDueAt(schedule, nowMs);
  return next !== null && nowMs - next > DAY_MS;
}

/**
 * True when running now would pay the same period twice. Checked before
 * every scheduled run; the app refuses the run when this is true.
 */
export function wouldDuplicate(schedule: PaySchedule, nowMs: number): boolean {
  const due = duePeriodKey(schedule, nowMs);
  return due !== null && due === validate(schedule).lastRunPeriod;
}

/** Record that the run due at `nowMs` happened. Returns the updated schedule. */
export function markRun(schedule: PaySchedule, nowMs: number): PaySchedule {
  const parsed = validate(schedule);
  const period = duePeriodKey(parsed, nowMs);
  if (!period) throw new Error("Nothing is due to run yet — wait for the scheduled time.");
  return { ...parsed, lastRunAt: new Date(nowMs).toISOString(), lastRunPeriod: period };
}

/** Build a new schedule from the dashboard form. Throws on bad input. */
export function createSchedule(input: {
  id: string;
  label: string;
  payPeriod: string;
  runAt: string;
  repeat: Repeat;
}): PaySchedule {
  return validate({
    id: input.id,
    label: input.label.trim(),
    payPeriod: input.payPeriod.trim(),
    runAt: input.runAt,
    repeat: input.repeat,
    lastRunAt: null,
    lastRunPeriod: null,
  });
}
