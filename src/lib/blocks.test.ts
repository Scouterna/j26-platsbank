import { describe, expect, it } from "vitest";
import { resolveMyBlock } from "./blocks";

describe("resolveMyBlock", () => {
	const blocks = [
		{ userId: "user-1", reason: "Skojade bara" },
		{ userId: "guest-abc", reason: "Inte i målgruppen" },
	];

	it("returns the auth user's block reason", () => {
		expect(resolveMyBlock(blocks, "user-1")).toBe("Skojade bara");
	});

	it("returns null when the auth user has no block", () => {
		expect(resolveMyBlock(blocks, "user-2")).toBeNull();
	});

	it("returns null when there is no authenticated user", () => {
		expect(resolveMyBlock(blocks, null)).toBeNull();
	});

	it("returns null on an empty blocks list", () => {
		expect(resolveMyBlock([], "user-1")).toBeNull();
	});
});
