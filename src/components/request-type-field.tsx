import {
	Box,
	Chip,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
} from "@mui/material";
import type { RequestType } from "#/lib/permissions";

const TYPE_LABELS: Record<RequestType, string> = {
	leader: "Ledare",
	staff: "Funktionär",
};

interface RequestTypeFieldProps {
	/** Types the current user is allowed to create. */
	creatableTypes: readonly RequestType[];
	value: RequestType;
	onChange: (type: RequestType) => void;
}

/**
 * Event-type selector for the create/edit forms. The type is always shown; an
 * interactive switcher only appears when the user can create more than one
 * type — otherwise the single type is shown as a static label.
 */
export function RequestTypeField({
	creatableTypes,
	value,
	onChange,
}: RequestTypeFieldProps) {
	const hasChoice = creatableTypes.length > 1;

	return (
		<Box>
			<Typography variant="body2" color="text.secondary" mb={1}>
				Typ av förfrågan
			</Typography>
			{hasChoice ? (
				<>
					<ToggleButtonGroup
						value={value}
						exclusive
						onChange={(_, v) => {
							if (v) onChange(v as RequestType);
						}}
					>
						{creatableTypes.map((t) => (
							<ToggleButton key={t} value={t}>
								{TYPE_LABELS[t]}
							</ToggleButton>
						))}
					</ToggleButtonGroup>
					<Typography
						variant="caption"
						color="text.secondary"
						display="block"
						mt={0.5}
					>
						Ledare ser endast ledarpass och funktionärer endast funktionärspass.
					</Typography>
				</>
			) : (
				<Chip
					label={TYPE_LABELS[value]}
					color={value === "staff" ? "secondary" : "primary"}
					variant="outlined"
				/>
			)}
		</Box>
	);
}
