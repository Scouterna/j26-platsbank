import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { verifyAndGetUser } from "#/lib/auth";

export const Route = createFileRoute("/api-config")({
	server: {
		handlers: {
			GET: async () => {
				const token = getCookie("j26-auth_access-token");
				const user = token ? await verifyAndGetUser(token) : null;

				if (!user || user.roles.length === 0) {
					return new Response("Unauthorized", { status: 401 });
				}

				return Response.json({
					navigation: [
						{
							type: "page",
							id: "page_platsbank",
							label: "Platsbank",
							icon: "heart-handshake",
							path: "/_services/platsbank",
						},
					],
				});
			},
		},
	},
});
