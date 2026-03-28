import { createServerFn } from "@tanstack/react-start";
import { prisma } from "#/db";
import { requireUser } from "#/server/auth";

export const getRequests = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireUser();
		return prisma.request.findMany({
			orderBy: { startTime: "asc" },
		});
	},
);

interface CreateRequestInput {
	title: string;
	description: string;
	startTime: string;
	endTime: string;
	peopleNeeded: number;
	location?: string;
}

export const createRequest = createServerFn({ method: "POST" })
	.inputValidator((input: CreateRequestInput) => input)
	.handler(async ({ data }) => {
		const user = await requireUser();
		return prisma.request.create({
			data: {
				title: data.title,
				description: data.description,
				startTime: new Date(data.startTime),
				endTime: new Date(data.endTime),
				peopleNeeded: data.peopleNeeded,
				location: data.location ?? null,
				createdBy: user.sub,
				creatorName: user.name,
			},
		});
	});

export const deleteRequest = createServerFn({ method: "POST" })
	.inputValidator((input: { id: string }) => input)
	.handler(async ({ data }) => {
		const user = await requireUser();
		const request = await prisma.request.findUnique({ where: { id: data.id } });
		if (!request) throw new Response("Not Found", { status: 404 });
		if (request.createdBy !== user.sub)
			throw new Response("Forbidden", { status: 403 });
		return prisma.request.delete({ where: { id: data.id } });
	});
