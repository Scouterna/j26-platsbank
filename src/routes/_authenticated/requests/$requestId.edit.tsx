import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import {
	DatePicker,
	LocalizationProvider,
	TimePicker,
} from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslate } from "@tolgee/react";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/sv";
import { useRef, useState } from "react";
import {
	type BilingualContent,
	BilingualContentFields,
	isBilingualComplete,
} from "#/components/bilingual-content-fields";
import { RequestTypeField } from "#/components/request-type-field";
import {
	canManageRequest,
	getCapabilities,
	normalizeRequestTypes,
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
	const { t } = useTranslate("platsbank");
	const req = Route.useLoaderData();
	const user = useUser();
	const caps = getCapabilities(user.roles);

	if (!req || !canManageRequest(caps, req, user.sub)) {
		return (
			<Typography color="error">
				{t(
					"error.notFoundOrForbidden",
					"Förfrågan hittades inte eller du saknar behörighet.",
				)}
			</Typography>
		);
	}

	const initial = {
		content: {
			sv: {
				title: req.title,
				description: req.description,
				location: req.location ?? "",
			},
			en: {
				title: req.titleEn,
				description: req.descriptionEn,
				location: req.locationEn ?? "",
			},
		} satisfies BilingualContent,
		date: dayjs(req.startTime),
		startTime: dayjs(req.startTime),
		endTime: dayjs(req.endTime),
		peopleNeeded: req.peopleNeeded,
		contactName: req.contactName ?? "",
		contactPhone: req.contactPhone ?? "",
		types: normalizeRequestTypes(req.types),
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
	content: BilingualContent;
	date: Dayjs;
	startTime: Dayjs;
	endTime: Dayjs;
	peopleNeeded: number;
	contactName: string;
	contactPhone: string;
	types: RequestType[];
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
	const { t } = useTranslate("platsbank");
	useAppBarTitle(t("appBar.editRequest", "Redigera förfrågan"));
	const navigate = useNavigate();
	const [types, setTypes] = useState<RequestType[]>(initial.types);
	const [typesError, setTypesError] = useState(false);
	const typesFieldRef = useRef<HTMLDivElement>(null);
	const [content, setContent] = useState<BilingualContent>(initial.content);
	const [contentError, setContentError] = useState(false);
	const contentFieldRef = useRef<HTMLDivElement>(null);
	const [date, setDate] = useState<Dayjs | null>(initial.date);
	const [startTime, setStartTime] = useState<Dayjs | null>(initial.startTime);
	const [endTime, setEndTime] = useState<Dayjs | null>(initial.endTime);
	const [peopleNeeded, setPeopleNeeded] = useState(
		String(initial.peopleNeeded),
	);
	const [contactName, setContactName] = useState(initial.contactName);
	const [contactPhone, setContactPhone] = useState(initial.contactPhone);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!date || !startTime || !endTime) return;
		if (!isBilingualComplete(content)) {
			setContentError(true);
			contentFieldRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "center",
			});
			return;
		}
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
			if (endDateTime.valueOf() <= startDateTime.valueOf()) {
				setError(
					t("error.endAfterStart", "Sluttiden måste vara efter starttiden."),
				);
				setSubmitting(false);
				return;
			}
			await updateRequest({
				data: {
					id: requestId,
					title: content.sv.title,
					titleEn: content.en.title,
					description: content.sv.description,
					descriptionEn: content.en.description,
					location: content.sv.location,
					locationEn: content.en.location,
					startTime: startDateTime.toISOString(),
					endTime: endDateTime.toISOString(),
					peopleNeeded: Number(peopleNeeded),
					contactName: contactName || undefined,
					contactPhone: contactPhone || undefined,
					types,
				},
			});
			navigate({ to: "/" });
		} catch {
			setError(t("error.generic", "Något gick fel. Försök igen."));
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
						<Box ref={contentFieldRef}>
							<BilingualContentFields
								value={content}
								onChange={(next) => {
									setContent(next);
									if (isBilingualComplete(next)) setContentError(false);
								}}
								showErrors={contentError}
							/>
						</Box>
						<DatePicker
							label={t("form.dateLabel", "Datum")}
							value={date}
							onChange={setDate}
							slotProps={{ textField: { required: true, fullWidth: true } }}
						/>
						<Box display="flex" gap={2}>
							<TimePicker
								label={t("form.startTimeLabel", "Starttid")}
								value={startTime}
								onChange={setStartTime}
								ampm={false}
								slotProps={{ textField: { required: true, fullWidth: true } }}
							/>
							<TimePicker
								label={t("form.endTimeLabel", "Sluttid")}
								value={endTime}
								onChange={setEndTime}
								ampm={false}
								slotProps={{ textField: { required: true, fullWidth: true } }}
							/>
						</Box>
						<TextField
							label={t("form.peopleNeededLabel", "Antal behövda")}
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
						<Box display="flex" gap={2}>
							<TextField
								label={t("form.contactNameLabel", "Kontaktperson (valfritt)")}
								value={contactName}
								onChange={(e) => setContactName(e.target.value)}
								fullWidth
							/>
							<TextField
								label={t("form.contactPhoneLabel", "Telefonnummer (valfritt)")}
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
								{submitting
									? t("form.saving", "Sparar...")
									: t("form.save", "Spara ändringar")}
							</Button>
							<Button
								variant="outlined"
								onClick={() => navigate({ to: "/" })}
								disabled={submitting}
							>
								{t("common.cancel", "Avbryt")}
							</Button>
						</Box>
					</Stack>
				</form>
			</Box>
		</LocalizationProvider>
	);
}
