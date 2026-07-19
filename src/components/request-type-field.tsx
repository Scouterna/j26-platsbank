import {
	Box,
	Checkbox,
	Chip,
	FormControlLabel,
	FormGroup,
	Typography,
} from "@mui/material";
import { useTranslate } from "@tolgee/react";
import type { RequestType } from "#/lib/permissions";

interface RequestTypeFieldProps {
	/** Audiences the current user is allowed to assign. */
	creatableTypes: readonly RequestType[];
	value: RequestType[];
	onChange: (types: RequestType[]) => void;
	/** Highlight the field when a save was attempted with nothing selected. */
	error?: boolean;
}

/**
 * Audience selector for the create/edit forms. Each audience is its own
 * independent toggle, so a request can target one, both, or (transiently) none
 * — an empty selection is allowed here and rejected on save by the form.
 */
export function RequestTypeField({
	creatableTypes,
	value,
	onChange,
	error = false,
}: RequestTypeFieldProps) {
	const { t } = useTranslate("platsbank");
	const typeLabel = (audience: RequestType) =>
		audience === "staff"
			? t("type.staff", "Funktionär")
			: t("type.leader", "Ledare");

	// Only creators reach these forms, so this is effectively always true; kept
	// as a defensive fallback for a single assignable audience.
	const hasChoice = creatableTypes.length > 1;

	const toggle = (audience: RequestType) => {
		onChange(
			value.includes(audience)
				? value.filter((v) => v !== audience)
				: [...value, audience],
		);
	};

	if (!hasChoice) {
		return (
			<Box>
				<Typography variant="body2" color="text.secondary" mb={1}>
					{t("type.label", "Typ av förfrågan")}
				</Typography>
				<Chip label={typeLabel(value[0] ?? "leader")} variant="outlined" />
			</Box>
		);
	}

	return (
		<Box>
			<Typography variant="body2" color="text.secondary" mb={1}>
				{t("type.audienceLabel", "Vem ska se förfrågan?")}
			</Typography>
			<FormGroup>
				{creatableTypes.map((audience) => (
					<FormControlLabel
						key={audience}
						control={
							<Checkbox
								checked={value.includes(audience)}
								onChange={() => toggle(audience)}
								color="primary"
							/>
						}
						label={typeLabel(audience)}
					/>
				))}
			</FormGroup>
			<Typography
				variant="caption"
				color={error ? "error" : "text.secondary"}
				display="block"
				mt={0.75}
			>
				{error
					? t("type.error", "Välj minst en – ledare eller funktionär.")
					: t(
							"type.help",
							"Välj en eller båda. Ledare ser endast ledarpass och funktionärer endast funktionärspass.",
						)}
			</Typography>
		</Box>
	);
}
