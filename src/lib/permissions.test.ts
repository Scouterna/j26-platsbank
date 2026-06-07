import { describe, expect, it } from "vitest";
import {
	canManageRequest,
	getCapabilities,
	normalizeRequestType,
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

describe("getCapabilities", () => {
	it("grants nothing to a user with no roles", () => {
		const caps = getCapabilities([]);
		expect(caps.isAdmin).toBe(false);
		expect(caps.canSee("leader")).toBe(false);
		expect(caps.canSee("staff")).toBe(false);
		expect(caps.canBook("leader")).toBe(false);
		expect(caps.canBook("staff")).toBe(false);
		expect(caps.canCreate("leader")).toBe(false);
		expect(caps.canCreate("staff")).toBe(false);
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
			expect(caps.canCreate("leader")).toBe(false);
			expect(caps.canCreate("staff")).toBe(false);
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

	describe("requests:leader:create", () => {
		const caps = getCapabilities([Role.LeaderCreate]);

		it("implies booking and seeing leader (create ⇒ book ⇒ see)", () => {
			expect(caps.canCreate("leader")).toBe(true);
			expect(caps.canBook("leader")).toBe(true);
			expect(caps.canSee("leader")).toBe(true);
		});

		it("does not touch staff", () => {
			expect(caps.canCreate("staff")).toBe(false);
			expect(caps.canBook("staff")).toBe(false);
			expect(caps.canSee("staff")).toBe(false);
		});

		it("lists leader as creatable and visible", () => {
			expect(caps.creatableTypes).toEqual(["leader"]);
			expect(caps.visibleTypes).toEqual(["leader"]);
		});
	});

	describe("requests:staff:create", () => {
		const caps = getCapabilities([Role.StaffCreate]);

		it("implies booking and seeing staff", () => {
			expect(caps.canCreate("staff")).toBe(true);
			expect(caps.canBook("staff")).toBe(true);
			expect(caps.canSee("staff")).toBe(true);
			expect(caps.creatableTypes).toEqual(["staff"]);
		});
	});

	describe("requests:create", () => {
		const caps = getCapabilities([Role.CreateAll]);

		it("grants create/book/see for both types", () => {
			expect(caps.canCreate("leader")).toBe(true);
			expect(caps.canCreate("staff")).toBe(true);
			expect(caps.canBook("leader")).toBe(true);
			expect(caps.canBook("staff")).toBe(true);
			expect(caps.visibleTypes).toEqual(["leader", "staff"]);
			expect(caps.creatableTypes).toEqual(["leader", "staff"]);
		});

		it("is not admin", () => {
			expect(caps.isAdmin).toBe(false);
		});
	});

	describe("admin", () => {
		const caps = getCapabilities([Role.Admin]);

		it("grants everything", () => {
			expect(caps.isAdmin).toBe(true);
			expect(caps.canCreate("leader")).toBe(true);
			expect(caps.canCreate("staff")).toBe(true);
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
		});

		it("leader:create + staff:book creates leader, books both", () => {
			const caps = getCapabilities([Role.LeaderCreate, Role.StaffBook]);
			expect(caps.creatableTypes).toEqual(["leader"]);
			expect(caps.canBook("leader")).toBe(true);
			expect(caps.canBook("staff")).toBe(true);
			expect(caps.visibleTypes).toEqual(["leader", "staff"]);
		});
	});

	describe("canBookOnBehalf", () => {
		it("is false without admin:book, even if you can book yourself", () => {
			const caps = getCapabilities([Role.LeaderBook]);
			expect(caps.canBookOnBehalf("leader")).toBe(false);
		});

		it("requires a bookable type — admin:book alone is inert", () => {
			const caps = getCapabilities([Role.AdminBook]);
			expect(caps.canBookOnBehalf("leader")).toBe(false);
			expect(caps.canBookOnBehalf("staff")).toBe(false);
		});

		it("is limited to types the booker can book", () => {
			const caps = getCapabilities([Role.AdminBook, Role.LeaderBook]);
			expect(caps.canBookOnBehalf("leader")).toBe(true);
			expect(caps.canBookOnBehalf("staff")).toBe(false);
		});

		it("admin can book on behalf for any type", () => {
			const caps = getCapabilities([Role.Admin]);
			expect(caps.canBookOnBehalf("leader")).toBe(true);
			expect(caps.canBookOnBehalf("staff")).toBe(true);
		});
	});
});

describe("canManageRequest", () => {
	const leaderReq = { createdBy: "owner-1", type: "leader" };
	const staffReq = { createdBy: "owner-1", type: "staff" };

	it("lets an admin manage any request regardless of owner", () => {
		const caps = getCapabilities([Role.Admin]);
		expect(canManageRequest(caps, leaderReq, "someone-else")).toBe(true);
		expect(canManageRequest(caps, staffReq, "someone-else")).toBe(true);
	});

	it("lets the creator manage their request when they can create that type", () => {
		const caps = getCapabilities([Role.LeaderCreate]);
		expect(canManageRequest(caps, leaderReq, "owner-1")).toBe(true);
	});

	it("denies a creator a type they can no longer create", () => {
		const caps = getCapabilities([Role.LeaderCreate]);
		expect(canManageRequest(caps, staffReq, "owner-1")).toBe(false);
	});

	it("denies a non-owner who is not admin", () => {
		const caps = getCapabilities([Role.LeaderCreate]);
		expect(canManageRequest(caps, leaderReq, "intruder")).toBe(false);
	});

	it("denies an owner who only holds a book role", () => {
		const caps = getCapabilities([Role.LeaderBook]);
		expect(canManageRequest(caps, leaderReq, "owner-1")).toBe(false);
	});

	it("denies when there is no user sub and not admin", () => {
		const caps = getCapabilities([Role.CreateAll]);
		expect(canManageRequest(caps, leaderReq, null)).toBe(false);
		expect(canManageRequest(caps, leaderReq, undefined)).toBe(false);
	});
});
