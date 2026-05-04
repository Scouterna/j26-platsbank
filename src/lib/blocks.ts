export interface BlockLike {
	userId: string;
	reason: string;
}

/**
 * Resolves the current user's RequestBlock reason from a list of blocks.
 *
 * - For authenticated users (userSub != null), looks up the block by userSub.
 * - For unauthenticated guest users, looks up the block by any of the
 *   guestUserIds the client has stored locally — these are the random UUIDs
 *   created when a guest signed up via guestSignUpForRequest.
 *
 * Returns null when no matching block exists.
 */
export function resolveMyBlock(
	blocks: readonly BlockLike[],
	userSub: string | null,
	guestUserIds: readonly string[],
): string | null {
	if (userSub) {
		return blocks.find((b) => b.userId === userSub)?.reason ?? null;
	}
	return blocks.find((b) => guestUserIds.includes(b.userId))?.reason ?? null;
}
