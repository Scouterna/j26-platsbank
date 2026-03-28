import { createContext, useContext } from "react";
import type { AppUser } from "#/lib/auth";

export const UserContext = createContext<AppUser | null>(null);

export function useUser(): AppUser {
	const user = useContext(UserContext);
	if (!user) throw new Error("useUser must be used inside the authenticated layout");
	return user;
}
