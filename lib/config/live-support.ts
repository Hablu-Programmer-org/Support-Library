/**
 * Live support schedule and its Bengali copy.
 *
 * Ported from the LMS frontend (`frontend/src/lib/config/support.ts`) so the
 * Support Library can offer the same shift windows from its own shell. The two
 * copies are compared by `scripts/check-live-support-sync.ts` — run it before a
 * release so a schedule change on one side cannot silently diverge from the
 * other.
 *
 * The shift is resolved in the studio's timezone (Asia/Dhaka), not the
 * device's: the frontend previously used `new Date().getHours()`, which put a
 * student travelling (or with the wrong OS timezone) into the wrong window.
 */

const MINUTES_IN_DAY = 24 * 60;

/** The timezone the support shifts are defined in. */
export const SUPPORT_TIME_ZONE = "Asia/Dhaka";

/** Shift windows as minutes since local midnight in `SUPPORT_TIME_ZONE`. */
export const SUPPORT_SHIFTS = {
  morning: { start: 8 * 60, end: 12 * 60 },
  night: { start: 19 * 60 + 30, end: MINUTES_IN_DAY },
} as const;

export type SupportShift = keyof typeof SUPPORT_SHIFTS;

/** `off` means live support is closed right now. */
export type SupportPhase = SupportShift | "off";

/**
 * Where and how to join. Resolved server-side from the environment so the join
 * URL never reaches a browser that has no session (see `lib/live-support.ts`).
 */
export type LiveSupportConfig = {
  platform: string;
  joinUrl: string;
  meetingId: string;
  passcode: string;
};

/**
 * Short, human-speakable reference for a request ("B41F9C").
 *
 * The tail of the ObjectId is not a secret (the student owns the case and cannot
 * open the staff view anyway); it exists so a student can say which request they
 * are in the room for.
 */
export const caseRefFor = (id: string) => id.slice(-6).toUpperCase();

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export const toBnDigits = (value: string | number) =>
  String(value).replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]);

const formatTime = (minutes: number) => {
  const hour =
    minutes >= MINUTES_IN_DAY ? 12 : Math.floor(minutes / 60) % 12 || 12;
  const minute = minutes % 60;

  return toBnDigits(minute ? `${hour}:${String(minute).padStart(2, "0")}` : hour);
};

/** "সকাল ৮ টা থেকে দুপুর ১২ টা এবং সন্ধ্যা ৭:৩০ থেকে রাত ১২ টা" */
export const supportScheduleBn = `সকাল ${formatTime(SUPPORT_SHIFTS.morning.start)} টা থেকে দুপুর ${formatTime(SUPPORT_SHIFTS.morning.end)} টা এবং সন্ধ্যা ${formatTime(SUPPORT_SHIFTS.night.start)} থেকে রাত ${formatTime(SUPPORT_SHIFTS.night.end)} টা`;

/** Total daily support duration, e.g. "৮ ঘণ্টা ৩০ মিনিট". */
export const supportHoursBn = () => {
  const total = Object.values(SUPPORT_SHIFTS).reduce(
    (sum, shift) => sum + (shift.end - shift.start),
    0,
  );
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  return minutes
    ? `${toBnDigits(hours)} ঘণ্টা ${toBnDigits(minutes)} মিনিট`
    : `${toBnDigits(hours)} ঘণ্টা`;
};

/**
 * Minutes since midnight in `SUPPORT_TIME_ZONE`, derived from the instant.
 *
 * `hourCycle: "h23"` is required: without it some engines emit "24" for
 * midnight (h24), which would produce 1440 and wrap into the wrong day.
 */
export function shiftMinutes(date: Date): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: SUPPORT_TIME_ZONE,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  const [hour = 0, minute = 0] = formatted.split(":").map(Number);
  return hour * 60 + minute;
}

/**
 * Which shift an instant falls in, in the studio's timezone.
 *
 * The window is half-open — `start <= t < end` — so exactly 12:00 counts as
 * off-shift, not as the morning session still running.
 */
export function currentShift(date: Date): SupportPhase {
  const minutes = shiftMinutes(date);

  if (minutes >= SUPPORT_SHIFTS.morning.start && minutes < SUPPORT_SHIFTS.morning.end) {
    return "morning";
  }
  if (minutes >= SUPPORT_SHIFTS.night.start && minutes < SUPPORT_SHIFTS.night.end) {
    return "night";
  }
  return "off";
}

/**
 * Calendar day (`YYYY-MM-DD`) in the studio's timezone.
 *
 * Used as the scope of a live-support join, so "one join per request per day"
 * means the day a Dhaka-based mentor would call today — not the UTC day, and not
 * the viewer's device day.
 */
export function dayKeyInDhaka(date: Date): string {
  // `en-CA` formats as YYYY-MM-DD, which is exactly the key shape we index.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SUPPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
