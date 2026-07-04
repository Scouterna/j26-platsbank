import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

const DISCOVERY_URL = process.env.KEYCLOAK_DISCOVERY_URL!;

interface OpenIdConfiguration {
	issuer: string;
	jwks_uri: string;
}

let jwksConfigPromise:
	| Promise<{ issuer: string; jwks: ReturnType<typeof createRemoteJWKSet> }>
	| undefined;

function getJwksConfig() {
	if (!jwksConfigPromise) {
		jwksConfigPromise = fetch(DISCOVERY_URL)
			.then((res) => res.json() as Promise<OpenIdConfiguration>)
			.then((config) => ({
				issuer: config.issuer,
				jwks: createRemoteJWKSet(new URL(config.jwks_uri)),
			}))
			.catch((err) => {
				jwksConfigPromise = undefined;
				throw err;
			});
	}
	return jwksConfigPromise;
}

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
		const { issuer, jwks } = await getJwksConfig();
		const { payload } = await jwtVerify<KeycloakPayload>(token, jwks, {
			issuer,
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
