import {
	AppBar,
	Avatar,
	Box,
	Button,
	Container,
	Toolbar,
	Typography,
} from "@mui/material";
import {
	createFileRoute,
	Link,
	Outlet,
} from "@tanstack/react-router";
import { UserContext } from "#/lib/user-context";
import { getUser } from "#/server/auth";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const user = await getUser();
		if (!user) throw new Error("unauthorized");
		return { user };
	},
	errorComponent: Unauthorized,
	component: AuthenticatedLayout,
});

function Unauthorized() {
	return (
		<Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={2}>
			<Typography variant="h4" component="h1">
				Åtkomst nekad
			</Typography>
			<Typography variant="body1" color="text.secondary">
				Du har inte behörighet att använda J26 Platsbank. Kontakta en administratör om du tror att detta är fel.
			</Typography>
		</Box>
	);
}

function AuthenticatedLayout() {
	const { user } = Route.useRouteContext();

	return (
		<UserContext.Provider value={user}>
			<AppBar position="static" sx={{ background: "repeating-linear-gradient(120deg, #f44336 0% 4.15%, #ff9800 4.15% 8.3%, #ffeb3b 8.3% 12.45%, #4caf50 12.45% 16.6%, #2196f3 16.6% 20.75%, #9c27b0 20.75% 25%)", "& *": { textShadow: "0 1px 3px rgba(0,0,0,0.6)" } }}>
				<Toolbar>
					<Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
						J26 Platsbank
					</Typography>
					<Button
						color="inherit"
						component={Link as any}
						to="/requests"
						activeProps={{ style: { textDecoration: "underline" } }}
					>
						Förfrågningar
					</Button>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 2 }}>
						{user.picture ? (
							<Avatar src={user.picture} alt={user.name} sx={{ width: 32, height: 32 }} />
						) : null}
						<Typography variant="body2">{user.name}</Typography>
					</Box>
				</Toolbar>
			</AppBar>
			<Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
				<Outlet />
			</Container>
		</UserContext.Provider>
	);
}
