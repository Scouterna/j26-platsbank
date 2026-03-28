import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

const ISSUER = "https://dev.id.scouterna.se/realms/jamboree26";

const JWKS = createRemoteJWKSet(
	new URL(`${ISSUER}/protocol/openid-connect/certs`),
);

interface KeycloakPayload extends JWTPayload {
	resource_access?: {
		"j26-platsbank"?: {
			roles: string[];
		};
	};
	name?: string;
	preferred_username?: string;
	email?: string;
	picture?: string;
}

export interface AppUser {
	sub: string;
	name: string;
	email: string;
	preferredUsername: string;
	picture?: string;
	roles: string[];
}

export async function verifyAndGetUser(token: string): Promise<AppUser | null> {
	try {
		const { payload } = await jwtVerify<KeycloakPayload>(token, JWKS, {
			issuer: ISSUER,
		});

		return {
			sub: payload.sub!,
			name: payload.name ?? "Okänd",
			email: payload.email ?? "",
			preferredUsername: payload.preferred_username ?? "",
			picture: payload.picture,
			roles: payload.resource_access?.["j26-platsbank"]?.roles ?? [],
		};
	} catch (err) {
		console.error("[auth] verifyAndGetUser failed:", err);
		return null;
	}
}
