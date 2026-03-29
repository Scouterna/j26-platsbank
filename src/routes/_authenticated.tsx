import { Box, Container, Typography } from "@mui/material";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { UserContext } from "#/lib/user-context";
import { getUserStatus } from "#/server/auth";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const { user, tokenPresent } = await getUserStatus();
		// Token present but rejected → deny access
		if (tokenPresent && !user) throw new Error("unauthorized");
		return { user };
	},
	errorComponent: Unauthorized,
	component: AuthenticatedLayout,
});

function Unauthorized() {
	return (
		<Box
			display="flex"
			flexDirection="column"
			alignItems="center"
			justifyContent="center"
			minHeight="100vh"
			gap={2}
		>
			<Typography variant="h4" component="h1">
				Åtkomst nekad
			</Typography>
			<Typography variant="body1" color="text.secondary">
				Du har inte behörighet att använda J26 Platsbank. Kontakta en
				administratör om du tror att detta är fel.
			</Typography>
		</Box>
	);
}

function AuthenticatedLayout() {
	const { user } = Route.useRouteContext();

	return (
		<UserContext.Provider value={user}>
			<Container maxWidth="lg" sx={{ mt: 1, mb: 4 }}>
				<Outlet />
			</Container>
		</UserContext.Provider>
	);
}
