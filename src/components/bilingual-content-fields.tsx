import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { Box, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useTranslate } from "@tolgee/react";
import { useEffect, useState } from "react";

/** The three poster-authored fields, for one language. */
export interface LangContent {
	title: string;
	description: string;
	location: string;
}

/** Both mandatory languages of a request's content. */
export interface BilingualContent {
	sv: LangContent;
	en: LangContent;
}

export const emptyBilingualContent: BilingualContent = {
	sv: { title: "", description: "", location: "" },
	en: { title: "", description: "", location: "" },
};

export function isLangComplete(c: LangContent): boolean {
	return (
		c.title.trim() !== "" &&
		c.description.trim() !== "" &&
		c.location.trim() !== ""
	);
}

export function isBilingualComplete(c: BilingualContent): boolean {
	return isLangComplete(c.sv) && isLangComplete(c.en);
}

// Field labels, help texts and placeholders are fixed to the *content*
// language (they instruct the poster in the language they are writing), so
// they are intentionally not routed through Tolgee's UI translations.
const COPY = {
	sv: {
		tab: "Svenska",
		title: "Titel",
		description: "Beskrivning",
		location: "Plats",
		descriptionHelp:
			"Beskriv vad uppgiften innebär och vad volontären behöver ta med sig eller ha på sig.",
		locationHelp: "Beskriv noggrant var volontären ska infinna sig.",
		locationPlaceholder: "t.ex. Gå till blå flaggan på parkeringen",
	},
	en: {
		tab: "English",
		title: "Title",
		description: "Description",
		location: "Location",
		descriptionHelp:
			"Describe what the task involves and what the volunteer needs to bring or wear.",
		locationHelp: "Describe precisely where the volunteer should go.",
		locationPlaceholder: "e.g. Go to the blue flag by the parking lot",
	},
} as const;

interface Props {
	value: BilingualContent;
	onChange: (value: BilingualContent) => void;
	/** When true, empty required fields turn red and the first incomplete
	 * language tab is selected. Parents flip this on a failed submit. */
	showErrors?: boolean;
}

export function BilingualContentFields({
	value,
	onChange,
	showErrors = false,
}: Props) {
	const { t } = useTranslate("platsbank");
	const [lang, setLang] = useState<"sv" | "en">("sv");

	// On a failed submit, jump to the first language that still needs input so
	// the poster sees the red fields immediately.
	useEffect(() => {
		if (!showErrors) return;
		if (!isLangComplete(value.sv)) setLang("sv");
		else if (!isLangComplete(value.en)) setLang("en");
	}, [showErrors, value.sv, value.en]);

	const copy = COPY[lang];
	const current = value[lang];

	const set = (field: keyof LangContent, v: string) =>
		onChange({ ...value, [lang]: { ...current, [field]: v } });

	const missing = (field: keyof LangContent) =>
		showErrors && current[field].trim() === "";

	const tabLabel = (l: "sv" | "en") => (
		<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
			{COPY[l].tab}
			{isLangComplete(value[l]) ? (
				<CheckCircleIcon fontSize="small" color="success" />
			) : (
				<ErrorOutlineIcon
					fontSize="small"
					color={showErrors ? "error" : "disabled"}
				/>
			)}
		</Box>
	);

	const hasError = showErrors && !isBilingualComplete(value);

	return (
		<Box sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
			<Tabs
				value={lang}
				onChange={(_, v) => setLang(v)}
				variant="fullWidth"
				sx={{ borderBottom: 1, borderColor: "divider" }}
			>
				<Tab value="sv" label={tabLabel("sv")} />
				<Tab value="en" label={tabLabel("en")} />
			</Tabs>
			<Stack spacing={3} sx={{ p: 2 }}>
				<TextField
					label={copy.title}
					value={current.title}
					onChange={(e) => set("title", e.target.value)}
					required
					fullWidth
					error={missing("title")}
				/>
				<Box>
					<Typography
						variant="caption"
						color="text.secondary"
						display="block"
						mb={0.5}
					>
						{copy.descriptionHelp}
					</Typography>
					<TextField
						label={copy.description}
						value={current.description}
						onChange={(e) => set("description", e.target.value)}
						required
						fullWidth
						multiline
						minRows={5}
						error={missing("description")}
					/>
				</Box>
				<TextField
					label={copy.location}
					value={current.location}
					onChange={(e) => set("location", e.target.value)}
					required
					fullWidth
					placeholder={copy.locationPlaceholder}
					helperText={copy.locationHelp}
					error={missing("location")}
				/>
			</Stack>
			<Box sx={{ px: 2, pb: 2 }}>
				<Typography
					variant="caption"
					color={hasError ? "error" : "text.secondary"}
				>
					{t(
						"form.bilingualHint",
						"Alla evenemang måste skrivas på både svenska och engelska.",
					)}
				</Typography>
			</Box>
		</Box>
	);
}
