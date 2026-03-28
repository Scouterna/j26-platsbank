import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { type AppUser, verifyAndGetUser } from "#/lib/auth";

export const getUser = createServerFn({ method: "GET" }).handler(
	async (): Promise<AppUser | null> => {
		const token = getCookie("j26-auth_access-token");
		console.log("[auth] cookie token present:", !!token);
		if (!token) return null;
		return verifyAndGetUser(token);
	},
);

export async function requireUser(): Promise<AppUser> {
	const token = getCookie("j26-auth_access-token");
	if (!token) throw new Response("Unauthorized", { status: 401 });
	const user = await verifyAndGetUser(token);
	if (!user) throw new Response("Forbidden", { status: 403 });
	return user;
}
