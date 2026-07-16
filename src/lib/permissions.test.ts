import { describe, expect, it } from "vitest";
import {
	canManageRequest,
	canViewRoster,
	getCapabilities,
	normalizeRequestType,
	normalizeRequestTypes,
	Role,
} from "./permissions";

describe("normalizeRequestType", () => {
	it("keeps staff", () => {
		expect(normalizeRequestType("staff")).toBe("staff");
	});

	it("keeps leader", () => {
		expect(normalizeRequestType("leader")).toBe("leader");
	});

	it("defaults unknown values to leader", () => {
		expect(normalizeRequestType("")).toBe("leader");
		expect(normalizeRequestType("something")).toBe("leader");
	});
});

describe("normalizeRequestTypes", () => {
	it("keeps known types in canonical order", () => {
		expect(normalizeRequestTypes(["staff", "leader"])).toEqual([
			"leader",
			"staff",
		]);
	});

	it("drops unknown values", () => {
		expect(normalizeRequestTypes(["leader", "bogus"])).toEqual(["leader"]);
	});

	it("dedupes to distinct known types", () => {
		expect(normalizeRequestTypes(["staff", "staff"])).toEqual(["staff"]);
	});

	it("falls back to leader when nothing is recognisable", () => {
		expect(normalizeRequestTypes([])).toEqual(["leader"]);
		expect(normalizeRequestTypes(["nope"])).toEqual(["leader"]);
	});
});

describe("getCapabilities", () => {
	it("grants nothing to a user with no roles", () => {
		const caps = getCapabilities([]);
		expect(caps.isAdmin).toBe(false);
		expect(caps.canSee("leader")).toBe(false);
		expect(caps.canSee("staff")).toBe(false);
		expect(caps.canBook("leader")).toBe(false);
		expect(caps.canBook("staff")).toBe(false);
		expect(caps.visibleTypes).toEqual([]);
		expect(caps.creatableTypes).toEqual([]);
		expect(caps.canSeeAny).toBe(false);
		expect(caps.canCreateAny).toBe(false);
	});

	it("defaults to no roles when called with no argument", () => {
		expect(getCapabilities().canSeeAny).toBe(false);
	});

	it("ignores unknown roles", () => {
		const caps = getCapabilities(["some:other:role", "totally-unrelated"]);
		expect(caps.canSeeAny).toBe(false);
		expect(caps.canCreateAny).toBe(false);
		expect(caps.isAdmin).toBe(false);
	});

	describe("requests:leader:book", () => {
		const caps = getCapabilities([Role.LeaderBook]);

		it("sees and books leader only", () => {
			expect(caps.canSee("leader")).toBe(true);
			expect(caps.canBook("leader")).toBe(true);
			expect(caps.canSee("staff")).toBe(false);
			expect(caps.canBook("staff")).toBe(false);
		});

		it("cannot create anything", () => {
			expect(caps.canCreateAny).toBe(false);
			expect(caps.creatableTypes).toEqual([]);
		});

		it("exposes leader as the only visible type", () => {
			expect(caps.visibleTypes).toEqual(["leader"]);
			expect(caps.canSeeAny).toBe(true);
		});
	});

	describe("requests:staff:book", () => {
		const caps = getCapabilities([Role.StaffBook]);

		it("sees and books staff only", () => {
			expect(caps.canSee("staff")).toBe(true);
			expect(caps.canBook("staff")).toBe(true);
			expect(caps.canSee("leader")).toBe(false);
			expect(caps.canBook("leader")).toBe(false);
			expect(caps.visibleTypes).toEqual(["staff"]);
		});
	});

	describe("requests:create", () => {
		const caps = getCapabilities([Role.CreateAll]);

		it("is the only non-admin role that can create, and covers both types", () => {
			expect(caps.canCreateAny).toBe(true);
			expect(caps.creatableTypes).toEqual(["leader", "staff"]);
		});

		it("sees both types but cannot book either without a book role", () => {
			expect(caps.canSee("leader")).toBe(true);
			expect(caps.canSee("staff")).toBe(true);
			expect(caps.canBook("leader")).toBe(false);
			expect(caps.canBook("staff")).toBe(false);
			expect(caps.visibleTypes).toEqual(["leader", "staff"]);
		});

		it("is not admin", () => {
			expect(caps.isAdmin).toBe(false);
		});
	});

	describe("admin", () => {
		const caps = getCapabilities([Role.Admin]);

		it("grants everything", () => {
			expect(caps.isAdmin).toBe(true);
			expect(caps.canCreateAny).toBe(true);
			expect(caps.canBook("leader")).toBe(true);
			expect(caps.canBook("staff")).toBe(true);
			expect(caps.visibleTypes).toEqual(["leader", "staff"]);
			expect(caps.creatableTypes).toEqual(["leader", "staff"]);
		});
	});

	describe("combined roles", () => {
		it("leader:book + staff:book sees both, creates neither", () => {
			const caps = getCapabilities([Role.LeaderBook, Role.StaffBook]);
			expect(caps.visibleTypes).toEqual(["leader", "staff"]);
			expect(caps.creatableTypes).toEqual([]);
			expect(caps.canCreateAny).toBe(false);
		});

		it("a book role alongside admin:book stays limited to that audience", () => {
			const caps = getCapabilities([Role.LeaderBook, Role.AdminBook]);
			expect(caps.visibleTypes).toEqual(["leader"]);
			expect(caps.canCreateAny).toBe(false);
		});

		it("create + leader:book sees both but books leader only", () => {
			const caps = getCapabilities([Role.CreateAll, Role.LeaderBook]);
			expect(caps.visibleTypes).toEqual(["leader", "staff"]);
			expect(caps.canBook("leader")).toBe(true);
			expect(caps.canBook("staff")).toBe(false);
		});
	});

	describe("canBookOnBehalf", () => {
		it("is false without admin:book, even if you can book yourself", () => {
			const caps = getCapabilities([Role.LeaderBook]);
			expect(caps.canBookOnBehalf("leader")).toBe(false);
		});

		it("admin:book alone is inert — nothing is visible to book on behalf for", () => {
			const caps = getCapabilities([Role.AdminBook]);
			expect(caps.canBookOnBehalf("leader")).toBe(false);
			expect(caps.canBookOnBehalf("staff")).toBe(false);
		});

		it("is limited to types the booker can see", () => {
			const caps = getCapabilities([Role.AdminBook, Role.LeaderBook]);
			expect(caps.canBookOnBehalf("leader")).toBe(true);
			expect(caps.canBookOnBehalf("staff")).toBe(false);
		});

		it("lets a coordinator book on behalf for any audience they can see, even unbookable ones", () => {
			const caps = getCapabilities([Role.CreateAll, Role.AdminBook]);
			expect(caps.canBookOnBehalf("leader")).toBe(true);
			expect(caps.canBookOnBehalf("staff")).toBe(true);
			// ...but still cannot sign themselves up for those audiences
			expect(caps.canBook("leader")).toBe(false);
			expect(caps.canBook("staff")).toBe(false);
		});

		it("admin can book on behalf for any type", () => {
			const caps = getCapabilities([Role.Admin]);
			expect(caps.canBookOnBehalf("leader")).toBe(true);
			expect(caps.canBookOnBehalf("staff")).toBe(true);
		});
	});
});

describe("canManageRequest", () => {
	const req = { createdBy: "owner-1" };

	it("lets an admin manage any request regardless of owner", () => {
		const caps = getCapabilities([Role.Admin]);
		expect(canManageRequest(caps, req, "someone-else")).toBe(true);
	});

	it("lets the creator manage their request when they can create", () => {
		const caps = getCapabilities([Role.CreateAll]);
		expect(canManageRequest(caps, req, "owner-1")).toBe(true);
	});

	it("denies a non-owner who is not admin", () => {
		const caps = getCapabilities([Role.CreateAll]);
		expect(canManageRequest(caps, req, "intruder")).toBe(false);
	});

	it("denies an owner who only holds a book role", () => {
		const caps = getCapabilities([Role.LeaderBook]);
		expect(canManageRequest(caps, req, "owner-1")).toBe(false);
	});

	it("denies when there is no user sub and not admin", () => {
		const caps = getCapabilities([Role.CreateAll]);
		expect(canManageRequest(caps, req, null)).toBe(false);
		expect(canManageRequest(caps, req, undefined)).toBe(false);
	});
});

describe("canViewRoster", () => {
	const req = { createdBy: "owner-1" };

	it("lets an admin view any roster", () => {
		const caps = getCapabilities([Role.Admin]);
		expect(canViewRoster(caps, req, "someone-else")).toBe(true);
	});

	it("lets a creator view the roster of a request they do not own", () => {
		const caps = getCapabilities([Role.CreateAll]);
		expect(canViewRoster(caps, req, "not-the-owner")).toBe(true);
	});

	it("lets a creator view their own request's roster", () => {
		const caps = getCapabilities([Role.CreateAll]);
		expect(canViewRoster(caps, req, "owner-1")).toBe(true);
	});

	it("denies a user who can only book (roster stays hidden, count only)", () => {
		const caps = getCapabilities([Role.LeaderBook]);
		expect(canViewRoster(caps, req, "owner-1")).toBe(false);
	});

	it("denies a logged-out user", () => {
		const caps = getCapabilities([]);
		expect(canViewRoster(caps, req, null)).toBe(false);
	});
});
