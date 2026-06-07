export interface BlockLike {
	userId: string;
	reason: string;
}

/**
 * Resolves the current user's RequestBlock reason from a list of blocks.
 *
 * - For authenticated users (userSub != null), looks up the block by userSub.
 * - The guestUserIds path is retained for backwards compatibility: it resolved
 *   blocks for anonymous guest signups, which are no longer created. Callers
 *   now always pass an empty list.
 *
 * Returns null when no matching block exists.
 */
export function resolveMyBlock(
	blocks: readonly BlockLike[],
	userSub: string | null,
): string | null {
	if (!userSub) return null;
	return blocks.find((b) => b.userId === userSub)?.reason ?? null;
}
