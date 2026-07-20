import { Box, Container, Typography } from "@mui/material";
import {
	createFileRoute,
	type ErrorComponentProps,
	Outlet,
} from "@tanstack/react-router";
import { useTranslate } from "@tolgee/react";
import { UserContext } from "#/lib/user-context";
import { getUserStatus } from "#/server/auth";

const UNAUTHORIZED = "unauthorized";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const { user, tokenPresent } = await getUserStatus();
		// Token present but rejected → deny access
		if (tokenPresent && !user) throw new Error(UNAUTHORIZED);
		return { user };
	},
	errorComponent: ErrorBoundary,
	component: AuthenticatedLayout,
});

function ErrorBoundary({ error }: ErrorComponentProps) {
	const { t } = useTranslate("platsbank");
	const isAuthError = error instanceof Error && error.message === UNAUTHORIZED;

	const title = isAuthError
		? t("auth.failedTitle", "Inloggningen misslyckades")
		: t("error.genericTitle", "Något gick fel");
	const body = isAuthError
		? t(
				"auth.failedBody",
				"Vi kunde inte verifiera din inloggning. Försök logga in igen.",
			)
		: t(
				"error.genericBody",
				"Ett oväntat fel inträffade. Försök igen om en stund.",
			);

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
				{title}
			</Typography>
			<Typography variant="body1" color="text.secondary">
				{body}
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
