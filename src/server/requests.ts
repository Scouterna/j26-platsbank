import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { prisma } from "#/db";
import { verifyAndGetUser } from "#/lib/auth";
import { resolveMyBlock } from "#/lib/blocks";
import { requireUser } from "#/server/auth";
import { withLogging } from "#/server/utils";

interface GetRequestsInput {
	guestUserIds?: string[];
}

export const getRequests = createServerFn({ method: "GET" })
	.inputValidator((input?: GetRequestsInput) => input ?? {})
	.handler(({ data }) =>
		withLogging("getRequests", async () => {
			const token = getCookie("j26-auth_access-token");
			const user = token ? await verifyAndGetUser(token) : null;
			const guestUserIds = data.guestUserIds ?? [];

			const canSeeStaff = user?.roles.includes("requests:staff:book") ?? false;

			const requests = await prisma.request.findMany({
				orderBy: { startTime: "asc" },
				where: canSeeStaff ? undefined : { type: "leader" },
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

			const isAdmin = user?.roles.includes("admin") ?? false;

			return requests.map((req) => {
				const isOwner =
					isAdmin ||
					(user?.sub === req.createdBy &&
						(user?.roles.includes("requests:create") ?? false));
				return {
					...req,
					signups: req.signups.map((s) =>
						isOwner
							? s
							: {
									userId: s.userId,
									userName: null,
									scoutGroup: null,
									phone: null,
									comment: null,
								},
					),
					blocks: isOwner ? req.blocks : ([] as typeof req.blocks),
					myBlock: resolveMyBlock(req.blocks, user?.sub ?? null, guestUserIds),
				};
			});
		}),
	);

export const getRequest = createServerFn({ method: "GET" })
	.inputValidator((input: { id: string }) => input)
	.handler(({ data }) =>
		withLogging("getRequest", () =>
			prisma.request.findUnique({ where: { id: data.id } }),
		),
	);

interface CreateRequestInput {
	title: string;
	description: string;
	startTime: string;
	endTime: string;
	peopleNeeded: number;
	location?: string;
	contactName?: string;
	contactPhone?: string;
	type: "leader" | "staff";
}

export const createRequest = createServerFn({ method: "POST" })
	.inputValidator((input: CreateRequestInput) => input)
	.handler(({ data }) =>
		withLogging("createRequest", async () => {
			const user = await requireUser();
			if (!user.roles.includes("requests:create"))
				throw new Response("Forbidden", { status: 403 });
			if (data.type === "staff" && !user.roles.includes("requests:staff:book"))
				throw new Response("Forbidden", { status: 403 });
			return prisma.request.create({
				data: {
					title: data.title,
					description: data.description,
					startTime: new Date(data.startTime),
					endTime: new Date(data.endTime),
					peopleNeeded: data.peopleNeeded,
					location: data.location ?? null,
					contactName: data.contactName ?? null,
					contactPhone: data.contactPhone ?? null,
					type: data.type,
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
	location?: string;
	contactName?: string;
	contactPhone?: string;
	type: "leader" | "staff";
}

export const updateRequest = createServerFn({ method: "POST" })
	.inputValidator((input: UpdateRequestInput) => input)
	.handler(({ data }) =>
		withLogging("updateRequest", async () => {
			const user = await requireUser();
			const request = await prisma.request.findUnique({
				where: { id: data.id },
			});
			if (!request) throw new Response("Not Found", { status: 404 });
			const isAdmin = user.roles.includes("admin");
			const isOwner =
				request.createdBy === user.sub &&
				user.roles.includes("requests:create");
			if (!isAdmin && !isOwner)
				throw new Response("Forbidden", { status: 403 });
			if (data.type === "staff" && !user.roles.includes("requests:staff:book"))
				throw new Response("Forbidden", { status: 403 });
			return prisma.request.update({
				where: { id: data.id },
				data: {
					title: data.title,
					description: data.description,
					startTime: new Date(data.startTime),
					endTime: new Date(data.endTime),
					peopleNeeded: data.peopleNeeded,
					location: data.location ?? null,
					contactName: data.contactName ?? null,
					contactPhone: data.contactPhone ?? null,
					type: data.type,
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

export const guestSignUpForRequest = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			requestId: string;
			name: string;
			scoutGroup: string;
			phone?: string;
			comment?: string;
		}) => input,
	)
	.handler(
		({ data }): Promise<{ claimToken: string; userId: string }> =>
			withLogging("guestSignUpForRequest", async () => {
				const { randomUUID } = await import("node:crypto");
				const claimToken = randomUUID();
				const userId = randomUUID();
				await prisma.requestSignup.create({
					data: {
						requestId: data.requestId,
						userId,
						userName: data.name,
						scoutGroup: data.scoutGroup,
						phone: data.phone ?? null,
						comment: data.comment ?? null,
						claimToken,
					},
				});
				return { claimToken, userId };
			}),
	);

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

export const withdrawGuestFromRequest = createServerFn({ method: "POST" })
	.inputValidator((input: { claimToken: string }) => input)
	.handler(({ data }) =>
		withLogging("withdrawGuestFromRequest", () =>
			prisma.requestSignup.delete({
				where: { claimToken: data.claimToken },
			}),
		),
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
			const request = await prisma.request.findUnique({
				where: { id: data.requestId },
			});
			if (!request) throw new Response("Not Found", { status: 404 });
			const isAdmin = user.roles.includes("admin");
			const isOwner =
				request.createdBy === user.sub &&
				user.roles.includes("requests:create");
			if (!isAdmin && !isOwner)
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
			const request = await prisma.request.findUnique({
				where: { id: data.requestId },
			});
			if (!request) throw new Response("Not Found", { status: 404 });
			const isAdmin = user.roles.includes("admin");
			const isOwner =
				request.createdBy === user.sub &&
				user.roles.includes("requests:create");
			if (!isAdmin && !isOwner)
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
			const request = await prisma.request.findUnique({
				where: { id: data.id },
			});
			if (!request) throw new Response("Not Found", { status: 404 });
			const isAdmin = user.roles.includes("admin");
			const isOwner =
				request.createdBy === user.sub &&
				user.roles.includes("requests:create");
			if (!isAdmin && !isOwner)
				throw new Response("Forbidden", { status: 403 });
			return prisma.request.delete({ where: { id: data.id } });
		}),
	);
