import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import {
	DatePicker,
	LocalizationProvider,
	TimePicker,
} from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Dayjs } from "dayjs";
import "dayjs/locale/sv";
import { useRef, useState } from "react";
import { RequestTypeField } from "#/components/request-type-field";
import { getCapabilities, type RequestType } from "#/lib/permissions";
import { useAppBarTitle } from "#/lib/use-app-bar-title";
import { useOptionalUser } from "#/lib/user-context";
import { createRequest } from "#/server/requests";

export const Route = createFileRoute("/_authenticated/requests/new")({
	beforeLoad: ({ context }) => {
		if (!getCapabilities(context.user?.roles ?? []).canCreateAny)
			throw new Error("unauthorized");
	},
	component: NewRequestPage,
});

function NewRequestPage() {
	useAppBarTitle("Ny förfrågan");
	const navigate = useNavigate();
	const user = useOptionalUser();
	const { creatableTypes } = getCapabilities(user?.roles ?? []);
	const [types, setTypes] = useState<RequestType[]>([
		creatableTypes[0] ?? "leader",
	]);
	const [typesError, setTypesError] = useState(false);
	const typesFieldRef = useRef<HTMLDivElement>(null);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [date, setDate] = useState<Dayjs | null>(null);
	const [startTime, setStartTime] = useState<Dayjs | null>(null);
	const [endTime, setEndTime] = useState<Dayjs | null>(null);
	const [peopleNeeded, setPeopleNeeded] = useState("1");
	const [location, setLocation] = useState("");
	const [contactName, setContactName] = useState("");
	const [contactPhone, setContactPhone] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!title || !description || !location || !date || !startTime || !endTime)
			return;
		if (types.length === 0) {
			setTypesError(true);
			typesFieldRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "center",
			});
			return;
		}
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
			if (startDateTime.valueOf() <= Date.now()) {
				setError("Förfrågan måste vara i framtiden.");
				setSubmitting(false);
				return;
			}
			if (endDateTime.valueOf() <= startDateTime.valueOf()) {
				setError("Sluttiden måste vara efter starttiden.");
				setSubmitting(false);
				return;
			}
			await createRequest({
				data: {
					title,
					description,
					startTime: startDateTime.toISOString(),
					endTime: endDateTime.toISOString(),
					peopleNeeded: Number(peopleNeeded),
					location,
					contactName: contactName || undefined,
					contactPhone: contactPhone || undefined,
					types,
				},
			});
			navigate({ to: "/" });
		} catch {
			setError("Något gick fel. Försök igen.");
			setSubmitting(false);
		}
	}

	return (
		<LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="sv">
			<Box maxWidth={600}>
				<form onSubmit={handleSubmit}>
					<Stack spacing={3}>
						<Box ref={typesFieldRef}>
							<RequestTypeField
								creatableTypes={creatableTypes}
								value={types}
								onChange={(next) => {
									setTypes(next);
									if (next.length > 0) setTypesError(false);
								}}
								error={typesError}
							/>
						</Box>
						<TextField
							label="Titel"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							required
							fullWidth
						/>
						<Box>
							<Typography
								variant="caption"
								color="text.secondary"
								display="block"
								mb={0.5}
							>
								Beskriv vad uppgiften innebär och vad volontären behöver ta med
								sig eller ha på sig.
							</Typography>
							<TextField
								label="Beskrivning"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								required
								fullWidth
								multiline
								minRows={5}
							/>
						</Box>
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
							onChange={(e) => setPeopleNeeded(e.target.value)}
							required
							fullWidth
							slotProps={{
								htmlInput: { min: 1 },
								inputLabel: { shrink: true },
							}}
						/>
						<TextField
							label="Plats"
							value={location}
							onChange={(e) => setLocation(e.target.value)}
							required
							fullWidth
							placeholder="t.ex. Gå till blå flaggan på parkeringen"
							helperText="Beskriv noggrant var volontären ska infinna sig."
						/>
						<Box display="flex" gap={2}>
							<TextField
								label="Kontaktperson (valfritt)"
								value={contactName}
								onChange={(e) => setContactName(e.target.value)}
								fullWidth
							/>
							<TextField
								label="Telefonnummer (valfritt)"
								value={contactPhone}
								onChange={(e) => setContactPhone(e.target.value)}
								fullWidth
							/>
						</Box>
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
								onClick={() => navigate({ to: "/" })}
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
