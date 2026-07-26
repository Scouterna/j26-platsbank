import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { assembleInterval, sameClockTime, spansNextDay } from "./datetime";

const date = dayjs("2026-07-25T00:00:00");
const at = (hhmm: string) => dayjs(`2026-01-01T${hhmm}:00`);

describe("spansNextDay", () => {
	it("is true when the end is earlier in the day than the start", () => {
		expect(spansNextDay(at("23:30"), at("01:00"))).toBe(true);
	});

	it("is false for a normal same-day interval", () => {
		expect(spansNextDay(at("10:00"), at("12:00"))).toBe(false);
	});

	it("is false when start and end are equal", () => {
		expect(spansNextDay(at("12:00"), at("12:00"))).toBe(false);
	});
});

describe("sameClockTime", () => {
	it("is true only when start and end clock times match", () => {
		expect(sameClockTime(at("12:00"), at("12:00"))).toBe(true);
		expect(sameClockTime(at("12:00"), at("12:30"))).toBe(false);
	});
});

describe("assembleInterval", () => {
	it("keeps a same-day interval on the picked date", () => {
		const { start, end } = assembleInterval(date, at("18:00"), at("20:00"));
		expect(start.format("YYYY-MM-DD HH:mm")).toBe("2026-07-25 18:00");
		expect(end.format("YYYY-MM-DD HH:mm")).toBe("2026-07-25 20:00");
	});

	it("rolls the end to the next day when it wraps past midnight", () => {
		const { start, end } = assembleInterval(date, at("23:30"), at("01:00"));
		expect(start.format("YYYY-MM-DD HH:mm")).toBe("2026-07-25 23:30");
		expect(end.format("YYYY-MM-DD HH:mm")).toBe("2026-07-26 01:00");
		expect(end.diff(start, "minute")).toBe(90);
	});

	it("zeroes seconds and milliseconds", () => {
		const { start, end } = assembleInterval(date, at("09:15"), at("10:45"));
		expect(start.second()).toBe(0);
		expect(start.millisecond()).toBe(0);
		expect(end.second()).toBe(0);
		expect(end.millisecond()).toBe(0);
	});
});
