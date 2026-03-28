import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import {
	DatePicker,
	LocalizationProvider,
	TimePicker,
} from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/sv";
import { useState } from "react";
import { createRequest } from "#/server/requests";

export const Route = createFileRoute("/_authenticated/requests/new")({
	beforeLoad: ({ context }) => {
		if (!context.user?.roles.includes("requests:create"))
			throw redirect({ to: "/unauthorized" });
	},
	component: NewRequestPage,
});

function NewRequestPage() {
	const navigate = useNavigate();
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [date, setDate] = useState<Dayjs | null>(null);
	const [startTime, setStartTime] = useState<Dayjs | null>(null);
	const [endTime, setEndTime] = useState<Dayjs | null>(null);
	const [peopleNeeded, setPeopleNeeded] = useState(1);
	const [location, setLocation] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!title || !description || !date || !startTime || !endTime) return;
		setSubmitting(true);
		setError(null);
		try {
			const startDateTime = date
				.hour(startTime.hour())
				.minute(startTime.minute())
				.second(0);
			const endDateTime = date
				.hour(endTime.hour())
				.minute(endTime.minute())
				.second(0);
			await createRequest({
				data: {
					title,
					description,
					startTime: startDateTime.toISOString(),
					endTime: endDateTime.toISOString(),
					peopleNeeded,
					location: location || undefined,
				},
			});
			navigate({ to: "/requests" });
		} catch {
			setError("Något gick fel. Försök igen.");
			setSubmitting(false);
		}
	}

	return (
		<LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="sv">
			<Box maxWidth={600}>
				<Typography variant="h4" component="h1" mb={3}>
					Ny förfrågan
				</Typography>
				<form onSubmit={handleSubmit}>
					<Stack spacing={3}>
						<TextField
							label="Titel"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							required
							fullWidth
						/>
						<TextField
							label="Beskrivning"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							required
							fullWidth
							multiline
							minRows={3}
						/>
						<DatePicker
							label="Datum"
							value={date}
							onChange={setDate}
							slotProps={{ textField: { required: true, fullWidth: true } }}
						/>
						<Box display="flex" gap={2}>
							<TimePicker
								label="Starttid"
								value={startTime}
								onChange={setStartTime}
								ampm={false}
								slotProps={{ textField: { required: true, fullWidth: true } }}
							/>
							<TimePicker
								label="Sluttid"
								value={endTime}
								onChange={setEndTime}
								ampm={false}
								slotProps={{ textField: { required: true, fullWidth: true } }}
							/>
						</Box>
						<TextField
							label="Antal behövda"
							type="number"
							value={peopleNeeded}
							onChange={(e) => setPeopleNeeded(Number(e.target.value))}
							required
							fullWidth
							slotProps={{
								htmlInput: { min: 1 },
								inputLabel: { shrink: true },
							}}
						/>
						<TextField
							label="Plats (valfritt)"
							value={location}
							onChange={(e) => setLocation(e.target.value)}
							fullWidth
						/>
						{error && (
							<Typography color="error" variant="body2">
								{error}
							</Typography>
						)}
						<Box display="flex" gap={2}>
							<Button type="submit" variant="contained" disabled={submitting}>
								{submitting ? "Sparar..." : "Skapa förfrågan"}
							</Button>
							<Button
								variant="outlined"
								onClick={() => navigate({ to: "/requests" })}
								disabled={submitting}
							>
								Avbryt
							</Button>
						</Box>
					</Stack>
				</form>
			</Box>
		</LocalizationProvider>
	);
}
