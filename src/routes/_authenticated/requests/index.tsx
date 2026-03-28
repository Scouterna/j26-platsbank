import {
	Box,
	Button,
	Card,
	CardContent,
	Chip,
	IconButton,
	Stack,
	Tooltip,
	Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PeopleIcon from "@mui/icons-material/People";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useUser } from "#/lib/user-context";
import { deleteRequest, getRequests } from "#/server/requests";

export const Route = createFileRoute("/_authenticated/requests/")({
	loader: () => getRequests(),
	component: RequestsPage,
});

function formatDate(d: Date | string) {
	return new Date(d).toLocaleDateString("sv-SE", { dateStyle: "long" });
}

function formatTime(d: Date | string) {
	return new Date(d).toLocaleTimeString("sv-SE", { timeStyle: "short" });
}

function RequestsPage() {
	const requests = Route.useLoaderData();
	const user = useUser();
	const router = useRouter();

	async function handleDelete(id: string) {
		await deleteRequest({ data: { id } });
		router.invalidate();
	}

	return (
		<Box>
			<Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
				<Typography variant="h4" component="h1">
					Förfrågningar
				</Typography>
				<Button
					variant="contained"
					startIcon={<AddIcon />}
					component={Link as any}
					to="/requests/new"
				>
					Ny förfrågan
				</Button>
			</Box>

			{requests.length === 0 ? (
				<Typography color="text.secondary">
					Inga förfrågningar ännu. Skapa den första!
				</Typography>
			) : (
				<Stack spacing={2}>
					{requests.map((req) => (
						<Card key={req.id} variant="outlined">
							<CardContent>
								<Box display="flex" justifyContent="space-between" alignItems="flex-start">
									<Box flex={1}>
										<Typography variant="subtitle1" fontWeight={600} gutterBottom>
											{req.title}
										</Typography>
										<Typography variant="body2" gutterBottom>
											{req.description}
										</Typography>
										<Typography variant="body2" color="text.secondary">
											{formatDate(req.startTime)}, {formatTime(req.startTime)}–{formatTime(req.endTime)}
										</Typography>
										<Box display="flex" gap={1} mt={1} flexWrap="wrap" alignItems="center">
											<Chip
												icon={<PeopleIcon />}
												label={`${req.peopleNeeded} person${req.peopleNeeded !== 1 ? "er" : ""}`}
												size="small"
												variant="outlined"
											/>
											{req.location && (
												<Chip
													icon={<LocationOnIcon />}
													label={req.location}
													size="small"
													variant="outlined"
												/>
											)}
											<Typography variant="caption" color="text.secondary">
												Skapad av {req.creatorName}
											</Typography>
										</Box>
									</Box>
									{req.createdBy === user.sub && (
										<Tooltip title="Ta bort">
											<IconButton
												size="small"
												color="error"
												onClick={() => handleDelete(req.id)}
											>
												<DeleteIcon fontSize="small" />
											</IconButton>
										</Tooltip>
									)}
								</Box>
							</CardContent>
						</Card>
					))}
				</Stack>
			)}
		</Box>
	);
}
