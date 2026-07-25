import type { Dayjs } from "dayjs";

export interface TimeInterval {
	start: Dayjs;
	end: Dayjs;
}

const minutesOfDay = (time: Dayjs): number => time.hour() * 60 + time.minute();

/**
 * True when the end clock time is strictly earlier in the day than the start
 * clock time, i.e. the shift is meant to run past midnight (e.g. 23:30 → 01:00).
 * Callers use this to warn the user, before submit, that the end lands on the
 * next day.
 */
export function spansNextDay(startTime: Dayjs, endTime: Dayjs): boolean {
	return minutesOfDay(endTime) < minutesOfDay(startTime);
}

/**
 * True when start and end are the exact same clock time. This is the one case
 * the next-day roll cannot disambiguate (zero-length vs. a full 24 h), so the
 * forms reject it rather than guess.
 */
export function sameClockTime(startTime: Dayjs, endTime: Dayjs): boolean {
	return minutesOfDay(startTime) === minutesOfDay(endTime);
}

/**
 * Combines a single calendar date with separate start/end clock times into an
 * absolute interval. When the end time is earlier in the day than the start
 * time the shift is taken to run past midnight, so the end is rolled to the
 * following day (23:30 → 01:00 becomes a 90-minute interval spanning two
 * dates). The DB stores full timestamps, so no other layer needs to change.
 */
export function assembleInterval(
	date: Dayjs,
	startTime: Dayjs,
	endTime: Dayjs,
): TimeInterval {
	const start = date
		.hour(startTime.hour())
		.minute(startTime.minute())
		.second(0)
		.millisecond(0);
	let end = date
		.hour(endTime.hour())
		.minute(endTime.minute())
		.second(0)
		.millisecond(0);
	if (!end.isAfter(start)) end = end.add(1, "day");
	return { start, end };
}

/** True when the two instants fall on different local calendar days. */
export function crossesMidnight(
	start: Date | string,
	end: Date | string,
): boolean {
	const s = new Date(start);
	const e = new Date(end);
	return (
		s.getFullYear() !== e.getFullYear() ||
		s.getMonth() !== e.getMonth() ||
		s.getDate() !== e.getDate()
	);
}
