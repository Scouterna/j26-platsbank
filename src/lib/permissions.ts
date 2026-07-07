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
 * Per type (`leader` | `staff`):
 *   - canSee(type) === canBook(type):
 *       admin | requests:create | requests:{type}:create | requests:{type}:book
 *   - canCreate(type):
 *       admin | requests:create | requests:{type}:create
 *
 * Cross-cutting:
 *   - `admin` is full god-mode (see/book/create both types, manage any request).
 *   - A creator role implies the matching book (and therefore see) capability.
 *   - canManageRequest: admin, or the creator who can still create that type.
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
	/** Full god-mode: see/book/create both types and manage any request. */
	Admin: "admin",
	/** Create events of any type. */
	CreateAll: "requests:create",
	/** Book an event on behalf of another person (subject to canBook). */
	AdminBook: "requests:admin:book",
	LeaderCreate: "requests:leader:create",
	StaffCreate: "requests:staff:create",
	LeaderBook: "requests:leader:book",
	StaffBook: "requests:staff:book",
} as const;

export type RoleId = (typeof Role)[keyof typeof Role];

/** Coerce a free-form DB `type` string into a known RequestType. */
export function normalizeRequestType(type: string): RequestType {
	return type === "staff" ? "staff" : "leader";
}

export interface Capabilities {
	/** Full god-mode. */
	readonly isAdmin: boolean;
	/** Can browse events of this type. Equivalent to `canBook` under model B. */
	canSee(type: RequestType): boolean;
	/** Can sign oneself up for events of this type. */
	canBook(type: RequestType): boolean;
	/** Can create events of this type. */
	canCreate(type: RequestType): boolean;
	/** Can sign someone else up for an event of this type. */
	canBookOnBehalf(type: RequestType): boolean;
	/** Types the user may see/book — drives list queries. */
	readonly visibleTypes: RequestType[];
	/** Types the user may create — drives the create/edit type switcher. */
	readonly creatableTypes: RequestType[];
	/** True when the user can see at least one type. */
	readonly canSeeAny: boolean;
	/** True when the user can create at least one type. */
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

	const canCreate = (type: RequestType): boolean =>
		isAdmin ||
		createAll ||
		set.has(type === "leader" ? Role.LeaderCreate : Role.StaffCreate);

	// A create role implies booking; a book role grants it directly.
	const canBook = (type: RequestType): boolean =>
		canCreate(type) ||
		set.has(type === "leader" ? Role.LeaderBook : Role.StaffBook);

	// Model B has no see-only role, so seeing and booking coincide.
	const canSee = canBook;

	const canBookOnBehalf = (type: RequestType): boolean =>
		(isAdmin || hasAdminBook) && canBook(type);

	const visibleTypes = REQUEST_TYPES.filter((t) => canSee(t));
	const creatableTypes = REQUEST_TYPES.filter((t) => canCreate(t));

	return {
		isAdmin,
		canSee,
		canBook,
		canCreate,
		canBookOnBehalf,
		visibleTypes,
		creatableTypes,
		canSeeAny: visibleTypes.length > 0,
		canCreateAny: creatableTypes.length > 0,
	};
}

/**
 * Whether the user may edit/delete/kick/unblock a given request. Admins may
 * manage any request; otherwise only the creator, and only while they still
 * hold the create capability for that request's type.
 */
export function canManageRequest(
	caps: Capabilities,
	request: { createdBy: string; type: string },
	userSub: string | null | undefined,
): boolean {
	if (caps.isAdmin) return true;
	if (!userSub) return false;
	return (
		request.createdBy === userSub &&
		caps.canCreate(normalizeRequestType(request.type))
	);
}
