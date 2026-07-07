import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import {
	DatePicker,
	LocalizationProvider,
	TimePicker,
} from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/sv";
import { useState } from "react";
import { RequestTypeField } from "#/components/request-type-field";
import {
	canManageRequest,
	getCapabilities,
	normalizeRequestType,
	type RequestType,
} from "#/lib/permissions";
import { useAppBarTitle } from "#/lib/use-app-bar-title";
import { useUser } from "#/lib/user-context";
import { getRequest, updateRequest } from "#/server/requests";

export const Route = createFileRoute(
	"/_authenticated/requests/$requestId/edit",
)({
	beforeLoad: ({ context }) => {
		if (!getCapabilities(context.user?.roles ?? []).canCreateAny)
			throw new Error("unauthorized");
	},
	loader: ({ params }) => getRequest({ data: { id: params.requestId } }),
	component: EditRequestPage,
});

function EditRequestPage() {
	const req = Route.useLoaderData();
	const user = useUser();
	const caps = getCapabilities(user.roles);

	if (!req || !canManageRequest(caps, req, user.sub)) {
		return (
			<Typography color="error">
				Förfrågan hittades inte eller du saknar behörighet.
			</Typography>
		);
	}

	const initial = {
		title: req.title,
		description: req.description,
		date: dayjs(req.startTime),
		startTime: dayjs(req.startTime),
		endTime: dayjs(req.endTime),
		peopleNeeded: req.peopleNeeded,
		location: req.location ?? "",
		contactName: req.contactName ?? "",
		contactPhone: req.contactPhone ?? "",
		type: normalizeRequestType(req.type),
	};

	return (
		<EditForm
			requestId={req.id}
			initial={initial}
			creatableTypes={caps.creatableTypes}
		/>
	);
}

interface FormValues {
	title: string;
	description: string;
	date: Dayjs;
	startTime: Dayjs;
	endTime: Dayjs;
	peopleNeeded: number;
	location: string;
	contactName: string;
	contactPhone: string;
	type: RequestType;
}

function EditForm({
	requestId,
	initial,
	creatableTypes,
}: {
	requestId: string;
	initial: FormValues;
	creatableTypes: readonly RequestType[];
}) {
	useAppBarTitle("Redigera förfrågan");
	const navigate = useNavigate();
	const [type, setType] = useState<RequestType>(initial.type);
	const [title, setTitle] = useState(initial.title);
	const [description, setDescription] = useState(initial.description);
	const [date, setDate] = useState<Dayjs | null>(initial.date);
	const [startTime, setStartTime] = useState<Dayjs | null>(initial.startTime);
	const [endTime, setEndTime] = useState<Dayjs | null>(initial.endTime);
	const [peopleNeeded, setPeopleNeeded] = useState(
		String(initial.peopleNeeded),
	);
	const [location, setLocation] = useState(initial.location);
	const [contactName, setContactName] = useState(initial.contactName);
	const [contactPhone, setContactPhone] = useState(initial.contactPhone);
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
			if (endDateTime.valueOf() <= startDateTime.valueOf()) {
				setError("Sluttiden måste vara efter starttiden.");
				setSubmitting(false);
				return;
			}
			await updateRequest({
				data: {
					id: requestId,
					title,
					description,
					startTime: startDateTime.toISOString(),
					endTime: endDateTime.toISOString(),
					peopleNeeded: Number(peopleNeeded),
					location: location || undefined,
					contactName: contactName || undefined,
					contactPhone: contactPhone || undefined,
					type,
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
						<RequestTypeField
							creatableTypes={creatableTypes}
							value={type}
							onChange={setType}
						/>
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
							label="Plats (valfritt)"
							value={location}
							onChange={(e) => setLocation(e.target.value)}
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
								{submitting ? "Sparar..." : "Spara ändringar"}
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
