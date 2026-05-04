import { describe, expect, it } from "vitest";
import { resolveMyBlock } from "./blocks";

describe("resolveMyBlock", () => {
	const blocks = [
		{ userId: "user-1", reason: "Skojade bara" },
		{ userId: "guest-abc", reason: "Inte i målgruppen" },
	];

	it("returns the auth user's block reason", () => {
		expect(resolveMyBlock(blocks, "user-1", [])).toBe("Skojade bara");
	});

	it("returns null when the auth user has no block", () => {
		expect(resolveMyBlock(blocks, "user-2", [])).toBeNull();
	});

	it("ignores guest userIds when an auth user is present", () => {
		// Guest IDs are only ever sent by unauthenticated clients in practice;
		// this guards the precedence in case both are passed.
		expect(resolveMyBlock(blocks, "user-2", ["guest-abc"])).toBeNull();
	});

	it("returns the guest's block reason when no auth user is present", () => {
		expect(resolveMyBlock(blocks, null, ["guest-abc"])).toBe(
			"Inte i målgruppen",
		);
	});

	it("returns null for a guest with no matching block", () => {
		expect(resolveMyBlock(blocks, null, ["guest-xyz"])).toBeNull();
	});

	it("returns null when no guest userIds are supplied", () => {
		expect(resolveMyBlock(blocks, null, [])).toBeNull();
	});

	it("returns null on an empty blocks list", () => {
		expect(resolveMyBlock([], "user-1", ["guest-abc"])).toBeNull();
	});
});
