import { Box, Button, Typography } from "@mui/material";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/unauthorized")({
	component: UnauthorizedPage,
});

function UnauthorizedPage() {
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
			<Button variant="outlined" component={Link as any} to="/">
				Tillbaka till startsidan
			</Button>
		</Box>
	);
}
