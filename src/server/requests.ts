import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { prisma } from "#/db";
import { verifyAndGetUser } from "#/lib/auth";
import { resolveMyBlock } from "#/lib/blocks";
import {
	canManageRequest,
	canViewRoster,
	getCapabilities,
	normalizeRequestTypes,
	REQUEST_TYPES,
	type RequestType,
} from "#/lib/permissions";
import { requireUser } from "#/server/auth";
import { withLogging } from "#/server/utils";

export const getRequests = createServerFn({ method: "GET" }).handler(() =>
	withLogging("getRequests", async () => {
		const token = getCookie("j26-auth_access-token");
		const user = token ? await verifyAndGetUser(token) : null;
		const caps = getCapabilities(user?.roles ?? []);

		// Model B: a user only sees the event types they hold a capability
		// for. No capability (incl. logged-out) → nothing.
		if (caps.visibleTypes.length === 0) return [];

		const requests = await prisma.request.findMany({
			orderBy: { startTime: "asc" },
			// A request is visible if any of its audiences is visible to the user.
			where: { types: { hasSome: caps.visibleTypes } },
			include: {
				signups: {
					select: {
						userId: true,
						userName: true,
						scoutGroup: true,
						phone: true,
						comment: true,
					},
				},
				blocks: {
					select: {
						userId: true,
						userName: true,
						reason: true,
					},
				},
			},
		});

		return requests.map((req) => {
			// Managers (creator/admin) can act on the request — they alone see
			// the block list. Any creator, however, may view the signup roster
			// (with contact details) of ANY request to coordinate across passes.
			const canManage = canManageRequest(caps, req, user?.sub);
			const canSeeRoster = canViewRoster(caps, req, user?.sub);
			return {
				...req,
				signups: req.signups.map((s) =>
					canSeeRoster
						? s
						: {
								userId: s.userId,
								userName: null,
								scoutGroup: null,
								phone: null,
								comment: null,
							},
				),
				blocks: canManage ? req.blocks : ([] as typeof req.blocks),
				myBlock: resolveMyBlock(req.blocks, user?.sub ?? null),
			};
		});
	}),
);

export const getRequest = createServerFn({ method: "GET" })
	.inputValidator((input: { id: string }) => input)
	.handler(({ data }) =>
		withLogging("getRequest", async () => {
			const token = getCookie("j26-auth_access-token");
			const user = token ? await verifyAndGetUser(token) : null;
			const caps = getCapabilities(user?.roles ?? []);
			const request = await prisma.request.findUnique({
				where: { id: data.id },
			});
			if (!request) throw new Response("Not Found", { status: 404 });
			if (!normalizeRequestTypes(request.types).some((t) => caps.canSee(t)))
				throw new Response("Forbidden", { status: 403 });
			return request;
		}),
	);

interface CreateRequestInput {
	title: string;
	description: string;
	startTime: string;
	endTime: string;
	peopleNeeded: number;
	location: string;
	contactName?: string;
	contactPhone?: string;
	types: RequestType[];
}

export const createRequest = createServerFn({ method: "POST" })
	.inputValidator((input: CreateRequestInput) => input)
	.handler(({ data }) =>
		withLogging("createRequest", async () => {
			const user = await requireUser();
			const caps = getCapabilities(user.roles);
			if (!caps.canCreateAny) throw new Response("Forbidden", { status: 403 });
			// Creation is not per-type; just require a non-empty set of known types.
			const types = REQUEST_TYPES.filter((t) => data.types.includes(t));
			if (types.length === 0)
				throw new Response("Bad Request", { status: 400 });
			return prisma.request.create({
				data: {
					title: data.title,
					description: data.description,
					startTime: new Date(data.startTime),
					endTime: new Date(data.endTime),
					peopleNeeded: data.peopleNeeded,
					location: data.location,
					contactName: data.contactName ?? null,
					contactPhone: data.contactPhone ?? null,
					types,
					createdBy: user.sub,
					creatorName: user.name,
				},
			});
		}),
	);

interface UpdateRequestInput {
	id: string;
	title: string;
	description: string;
	startTime: string;
	endTime: string;
	peopleNeeded: number;
	location: string;
	contactName?: string;
	contactPhone?: string;
	types: RequestType[];
}

export const updateRequest = createServerFn({ method: "POST" })
	.inputValidator((input: UpdateRequestInput) => input)
	.handler(({ data }) =>
		withLogging("updateRequest", async () => {
			const user = await requireUser();
			const caps = getCapabilities(user.roles);
			const request = await prisma.request.findUnique({
				where: { id: data.id },
			});
			if (!request) throw new Response("Not Found", { status: 404 });
			if (!canManageRequest(caps, request, user.sub))
				throw new Response("Forbidden", { status: 403 });
			// A manager can assign any audience (creation is not per-type); just
			// require a non-empty set of known types.
			const types = REQUEST_TYPES.filter((t) => data.types.includes(t));
			if (types.length === 0)
				throw new Response("Bad Request", { status: 400 });
			return prisma.request.update({
				where: { id: data.id },
				data: {
					title: data.title,
					description: data.description,
					startTime: new Date(data.startTime),
					endTime: new Date(data.endTime),
					peopleNeeded: data.peopleNeeded,
					location: data.location,
					contactName: data.contactName ?? null,
					contactPhone: data.contactPhone ?? null,
					types,
				},
			});
		}),
	);

export const signUpForRequest = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { requestId: string; phone?: string; comment?: string }) => input,
	)
	.handler(({ data }) =>
		withLogging("signUpForRequest", async () => {
			const user = await requireUser();
			const caps = getCapabilities(user.roles);
			const request = await prisma.request.findUnique({
				where: { id: data.requestId },
			});
			if (!request) throw new Response("Not Found", { status: 404 });
			if (!normalizeRequestTypes(request.types).some((t) => caps.canBook(t)))
				throw new Response("Forbidden", { status: 403 });
			const block = await prisma.requestBlock.findUnique({
				where: {
					requestId_userId: { requestId: data.requestId, userId: user.sub },
				},
			});
			if (block) throw new Response("Forbidden", { status: 403 });
			return prisma.requestSignup.create({
				data: {
					requestId: data.requestId,
					userId: user.sub,
					userName: user.name,
					phone: data.phone ?? null,
					comment: data.comment ?? null,
				},
			});
		}),
	);

/**
 * Sign someone else up by free-text name + scout group. Requires
 * `requests:admin:book` (or `admin`) plus the booker's own ability to book the
 * event's type. The booked person gets a synthetic userId so they don't
 * collide with real signups.
 */
export const bookOnBehalf = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			requestId: string;
			name: string;
			scoutGroup: string;
			phone?: string;
			comment?: string;
		}) => input,
	)
	.handler(({ data }) =>
		withLogging("bookOnBehalf", async () => {
			const user = await requireUser();
			const caps = getCapabilities(user.roles);
			const request = await prisma.request.findUnique({
				where: { id: data.requestId },
			});
			if (!request) throw new Response("Not Found", { status: 404 });
			if (
				!normalizeRequestTypes(request.types).some((t) =>
					caps.canBookOnBehalf(t),
				)
			)
				throw new Response("Forbidden", { status: 403 });
			const { randomUUID } = await import("node:crypto");
			return prisma.requestSignup.create({
				data: {
					requestId: data.requestId,
					userId: randomUUID(),
					userName: data.name,
					scoutGroup: data.scoutGroup,
					phone: data.phone ?? null,
					comment: data.comment ?? null,
				},
			});
		}),
	);

// Transitional: anonymous guests can no longer self-register under model B, but
// this remains so signups created by the old guest flow can still be migrated
// onto a real account the first time that person logs in.
export const claimGuestSignups = createServerFn({ method: "POST" })
	.inputValidator((input: { tokens: string[] }) => input)
	.handler(({ data }) =>
		withLogging("claimGuestSignups", async () => {
			const user = await requireUser();
			let claimed = 0;
			for (const token of data.tokens) {
				const signup = await prisma.requestSignup.findUnique({
					where: { claimToken: token },
				});
				if (!signup) continue;
				const guestBlock = await prisma.requestBlock.findUnique({
					where: {
						requestId_userId: {
							requestId: signup.requestId,
							userId: signup.userId,
						},
					},
				});
				const userBlock = await prisma.requestBlock.findUnique({
					where: {
						requestId_userId: { requestId: signup.requestId, userId: user.sub },
					},
				});
				if (guestBlock || userBlock) {
					// Transfer block to real user if it was only on the guest account
					if (guestBlock && !userBlock) {
						await prisma.requestBlock.create({
							data: {
								requestId: signup.requestId,
								userId: user.sub,
								userName: user.name,
								reason: guestBlock.reason,
							},
						});
					}
					await prisma.requestSignup.delete({ where: { id: signup.id } });
					continue;
				}
				const alreadySignedUp = await prisma.requestSignup.findUnique({
					where: {
						requestId_userId: { requestId: signup.requestId, userId: user.sub },
					},
				});
				if (alreadySignedUp) {
					// Authenticated signup takes precedence — drop the anonymous one
					await prisma.requestSignup.delete({ where: { id: signup.id } });
				} else {
					await prisma.requestSignup.update({
						where: { id: signup.id },
						data: { userId: user.sub, userName: user.name, claimToken: null },
					});
					claimed++;
				}
			}
			return { claimed };
		}),
	);

export const withdrawFromRequest = createServerFn({ method: "POST" })
	.inputValidator((input: { requestId: string }) => input)
	.handler(({ data }) =>
		withLogging("withdrawFromRequest", async () => {
			const user = await requireUser();
			return prisma.requestSignup.delete({
				where: {
					requestId_userId: { requestId: data.requestId, userId: user.sub },
				},
			});
		}),
	);

export const kickFromRequest = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { requestId: string; userId: string; reason: string }) => input,
	)
	.handler(({ data }) =>
		withLogging("kickFromRequest", async () => {
			const user = await requireUser();
			const caps = getCapabilities(user.roles);
			const request = await prisma.request.findUnique({
				where: { id: data.requestId },
			});
			if (!request) throw new Response("Not Found", { status: 404 });
			if (!canManageRequest(caps, request, user.sub))
				throw new Response("Forbidden", { status: 403 });
			const signup = await prisma.requestSignup.findUnique({
				where: {
					requestId_userId: { requestId: data.requestId, userId: data.userId },
				},
			});
			if (!signup) throw new Response("Not Found", { status: 404 });
			await prisma.$transaction([
				prisma.requestSignup.delete({ where: { id: signup.id } }),
				prisma.requestBlock.upsert({
					where: {
						requestId_userId: {
							requestId: data.requestId,
							userId: data.userId,
						},
					},
					update: { reason: data.reason, userName: signup.userName },
					create: {
						requestId: data.requestId,
						userId: data.userId,
						userName: signup.userName,
						reason: data.reason,
					},
				}),
			]);
		}),
	);

export const unblockFromRequest = createServerFn({ method: "POST" })
	.inputValidator((input: { requestId: string; userId: string }) => input)
	.handler(({ data }) =>
		withLogging("unblockFromRequest", async () => {
			const user = await requireUser();
			const caps = getCapabilities(user.roles);
			const request = await prisma.request.findUnique({
				where: { id: data.requestId },
			});
			if (!request) throw new Response("Not Found", { status: 404 });
			if (!canManageRequest(caps, request, user.sub))
				throw new Response("Forbidden", { status: 403 });
			return prisma.requestBlock.delete({
				where: {
					requestId_userId: { requestId: data.requestId, userId: data.userId },
				},
			});
		}),
	);

export const deleteRequest = createServerFn({ method: "POST" })
	.inputValidator((input: { id: string }) => input)
	.handler(({ data }) =>
		withLogging("deleteRequest", async () => {
			const user = await requireUser();
			const caps = getCapabilities(user.roles);
			const request = await prisma.request.findUnique({
				where: { id: data.id },
			});
			if (!request) throw new Response("Not Found", { status: 404 });
			if (!canManageRequest(caps, request, user.sub))
				throw new Response("Forbidden", { status: 403 });
			return prisma.request.delete({ where: { id: data.id } });
		}),
	);
