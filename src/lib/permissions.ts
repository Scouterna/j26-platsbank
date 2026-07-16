/**
 * Centralised rights model for j26-platsbank.
 *
 * Every authorization decision derives from the Keycloak roles carried in the
 * JWT (`AppUser.roles`). This module is the single source of truth — server
 * functions and the UI must both compute capabilities from here rather than
 * checking role strings inline.
 *
 * Visibility model "B": there are no public events. A user only ever sees the
 * event types they hold a capability for; no roles (or logged out) → nothing.
 *
 * Creation is coarse; visibility is per-audience:
 *   - canCreate is a single capability (not per-type): a request may target
 *     either or both audiences. A request carries a set of types.
 *   - canSee/canBook stay per-type: a `requests:{type}:book` role only unlocks
 *     that audience's events.
 *
 * Per audience type (`leader` | `staff`):
 *   - canSee(type) === canBook(type):
 *       admin | requests:create | requests:{type}:book
 *
 * Cross-cutting:
 *   - `admin` is full god-mode (see/book both types, create, manage any request).
 *   - `requests:create` grants creation of BOTH types plus see/book BOTH types.
 *     It is the only non-admin role that can create.
 *   - canManageRequest: admin, or the creator (who necessarily holds create).
 *   - canBookOnBehalf(type): (admin | requests:admin:book) AND canBook(type).
 */

export type RequestType = "leader" | "staff";

export const REQUEST_TYPES: readonly RequestType[] = ["leader", "staff"];

/**
 * Keycloak role identifiers, as found in
 * `resource_access["j26-platsbank"].roles`. Use these constants instead of
 * inline string literals so typos surface at compile time.
 */
export const Role = {
	/** Full god-mode: see/book both types, create, and manage any request. */
	Admin: "admin",
	/** Create events (both types) and see/book both types. */
	CreateAll: "requests:create",
	/** Book an event on behalf of another person (subject to canBook). */
	AdminBook: "requests:admin:book",
	LeaderBook: "requests:leader:book",
	StaffBook: "requests:staff:book",
} as const;

export type RoleId = (typeof Role)[keyof typeof Role];

/** Coerce a free-form DB `type` string into a known RequestType. */
export function normalizeRequestType(type: string): RequestType {
	return type === "staff" ? "staff" : "leader";
}

/**
 * Coerce a DB `types` array into distinct known RequestTypes, preserving the
 * canonical order. Falls back to `["leader"]` if nothing recognisable is
 * present, matching the historical single-column default.
 */
export function normalizeRequestTypes(types: readonly string[]): RequestType[] {
	const known = REQUEST_TYPES.filter((t) => types.includes(t));
	return known.length > 0 ? known : ["leader"];
}

export interface Capabilities {
	/** Full god-mode. */
	readonly isAdmin: boolean;
	/** Can browse events of this type. Equivalent to `canBook` under model B. */
	canSee(type: RequestType): boolean;
	/** Can sign oneself up for events of this type. */
	canBook(type: RequestType): boolean;
	/** Can sign someone else up for an event of this type. */
	canBookOnBehalf(type: RequestType): boolean;
	/** Types the user may see/book — drives list queries. */
	readonly visibleTypes: RequestType[];
	/** Audiences the user may assign when creating — all types, or none. */
	readonly creatableTypes: RequestType[];
	/** True when the user can see at least one type. */
	readonly canSeeAny: boolean;
	/** True when the user can create events (creation is not per-type). */
	readonly canCreateAny: boolean;
}

/**
 * Derive the full capability set from a user's Keycloak roles. Pure — safe to
 * call on both the server (verified user) and the client (`user.roles`).
 */
export function getCapabilities(roles: readonly string[] = []): Capabilities {
	const set = new Set(roles);
	const isAdmin = set.has(Role.Admin);
	const createAll = set.has(Role.CreateAll);
	const hasAdminBook = set.has(Role.AdminBook);

	// Creation is granted solely by `requests:create` (or admin), and covers
	// BOTH types.
	const canCreate = isAdmin || createAll;

	// Seeing/booking stays segregated by audience: a leader:book role only
	// unlocks leader events, staff:book only staff events. `admin` and
	// `requests:create` are cross-cutting and unlock both.
	const canBook = (type: RequestType): boolean =>
		isAdmin ||
		createAll ||
		set.has(type === "leader" ? Role.LeaderBook : Role.StaffBook);

	// Model B has no see-only role, so seeing and booking coincide.
	const canSee = canBook;

	const canBookOnBehalf = (type: RequestType): boolean =>
		(isAdmin || hasAdminBook) && canBook(type);

	const visibleTypes = REQUEST_TYPES.filter((t) => canSee(t));
	const creatableTypes = canCreate ? [...REQUEST_TYPES] : [];

	return {
		isAdmin,
		canSee,
		canBook,
		canBookOnBehalf,
		visibleTypes,
		creatableTypes,
		canSeeAny: visibleTypes.length > 0,
		canCreateAny: canCreate,
	};
}

/**
 * Whether the user may edit/delete/kick/unblock a given request. Admins may
 * manage any request; otherwise only the creator, and only while they still
 * hold a create capability at all (creation is no longer per-type).
 */
export function canManageRequest(
	caps: Capabilities,
	request: { createdBy: string },
	userSub: string | null | undefined,
): boolean {
	if (caps.isAdmin) return true;
	if (!userSub) return false;
	return request.createdBy === userSub && caps.canCreateAny;
}

/**
 * Whether the user may view a request's signup roster (who is booked, with
 * their contact details). Broader than {@link canManageRequest}: any user who
 * can create events may view the roster of ANY request — not just their own —
 * to coordinate across passes. Viewing grants no management actions
 * (kick/block/edit); those stay gated on `canManageRequest`. A request's
 * manager can always view its roster.
 */
export function canViewRoster(
	caps: Capabilities,
	request: { createdBy: string },
	userSub: string | null | undefined,
): boolean {
	return canManageRequest(caps, request, userSub) || caps.canCreateAny;
}
