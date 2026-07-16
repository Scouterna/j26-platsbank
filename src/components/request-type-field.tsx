import { Box, Chip, Stack, ToggleButton, Typography } from "@mui/material";
import type { RequestType } from "#/lib/permissions";

const TYPE_LABELS: Record<RequestType, string> = {
	leader: "Ledare",
	staff: "Funktionär",
};

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
	// Only creators reach these forms, so this is effectively always true; kept
	// as a defensive fallback for a single assignable audience.
	const hasChoice = creatableTypes.length > 1;

	const toggle = (t: RequestType) => {
		onChange(value.includes(t) ? value.filter((v) => v !== t) : [...value, t]);
	};

	if (!hasChoice) {
		return (
			<Box>
				<Typography variant="body2" color="text.secondary" mb={1}>
					Typ av förfrågan
				</Typography>
				<Chip
					label={TYPE_LABELS[value[0] ?? "leader"]}
					color={value[0] === "staff" ? "secondary" : "primary"}
					variant="outlined"
				/>
			</Box>
		);
	}

	return (
		<Box>
			<Typography variant="body2" color="text.secondary" mb={1}>
				Vem ska se förfrågan?
			</Typography>
			<Stack direction="row" gap={1} flexWrap="wrap">
				{creatableTypes.map((t) => (
					<ToggleButton
						key={t}
						value={t}
						selected={value.includes(t)}
						onChange={() => toggle(t)}
						color="primary"
						sx={{
							textTransform: "none",
							px: 3,
							...(error ? { borderColor: "error.main" } : {}),
						}}
					>
						{TYPE_LABELS[t]}
					</ToggleButton>
				))}
			</Stack>
			<Typography
				variant="caption"
				color={error ? "error" : "text.secondary"}
				display="block"
				mt={0.75}
			>
				{error
					? "Välj minst en – ledare eller funktionär."
					: "Välj en eller båda. Ledare ser endast ledarpass och funktionärer endast funktionärspass."}
			</Typography>
		</Box>
	);
}
