import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PeopleIcon from "@mui/icons-material/People";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PhoneIcon from "@mui/icons-material/Phone";
import UndoIcon from "@mui/icons-material/Undo";
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	Chip,
	Collapse,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	Divider,
	Drawer,
	IconButton,
	Skeleton,
	Stack,
	Tab,
	Tabs,
	TextField,
	Tooltip,
	Typography,
} from "@mui/material";
import {
	createFileRoute,
	Link,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
	canManageRequest,
	canViewRoster,
	getCapabilities,
	normalizeRequestTypes,
} from "#/lib/permissions";
import { useAppBarTitle } from "#/lib/use-app-bar-title";
import { useOptionalUser } from "#/lib/user-context";
import {
	bookOnBehalf,
	claimGuestSignups,
	deleteRequest,
	getRequests,
	kickFromRequest,
	signUpForRequest,
	unblockFromRequest,
	withdrawFromRequest,
} from "#/server/requests";

const CLAIM_TOKENS_KEY = "j26-claim-tokens";
const INFO_HIDDEN_KEY = "j26-platsbank-info-hidden";

interface GuestSignup {
	token: string;
	requestId: string;
	userId: string;
}

function getStoredSignups(): GuestSignup[] {
	try {
		return JSON.parse(localStorage.getItem(CLAIM_TOKENS_KEY) ?? "[]");
	} catch {
		return [];
	}
}

function saveStoredSignups(signups: GuestSignup[]) {
	localStorage.setItem(CLAIM_TOKENS_KEY, JSON.stringify(signups));
}

export const Route = createFileRoute("/_authenticated/")({
	loader: () => getRequests(),
	component: RequestsPage,
});

function formatTime(d: Date | string) {
	return new Date(d).toLocaleTimeString("sv-SE", { timeStyle: "short" });
}

function formatDate(d: Date | string) {
	return new Date(d).toLocaleDateString("sv-SE", { dateStyle: "long" });
}

function getDayKey(d: Date | string) {
	const date = new Date(d);
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getDayLabel(d: Date | string) {
	const date = new Date(d);
	const today = new Date();
	const tomorrow = new Date(today);
	tomorrow.setDate(today.getDate() + 1);

	const sameDay = (a: Date, b: Date) =>
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate();

	if (sameDay(date, today)) return "Idag";
	if (sameDay(date, tomorrow)) return "Imorgon";

	const diffDays = (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
	if (diffDays > 0 && diffDays < 7) {
		return date.toLocaleDateString("sv-SE", { weekday: "long" });
	}

	if (date.getFullYear() === today.getFullYear()) {
		return date.toLocaleDateString("sv-SE", {
			month: "long",
			weekday: "long",
			day: "numeric",
		});
	}

	return date.toLocaleDateString("sv-SE", { dateStyle: "long" });
}

type Request = NonNullable<Awaited<ReturnType<typeof getRequests>>>[number];

function groupByDay(items: Request[]) {
	const map = new Map<string, { label: string; items: Request[] }>();
	for (const item of items) {
		const key = getDayKey(item.startTime);
		if (!map.has(key)) {
			map.set(key, { label: getDayLabel(item.startTime), items: [] });
		}
		map.get(key)!.items.push(item);
	}
	return Array.from(map.values());
}

type KickTarget = { requestId: string; userId: string; userName: string };

function RequestsPage() {
	const requests = Route.useLoaderData();
	const user = useOptionalUser();
	const router = useRouter();
	const isRouterLoading = useRouterState({
		select: (s) => s.status !== "idle",
	});

	const caps = getCapabilities(user?.roles ?? []);
	const canCreate = caps.canCreateAny;
	const showTypeLabel = caps.visibleTypes.length > 1;

	const handleRefresh = useCallback(() => router.invalidate(), [router]);

	useAppBarTitle({
		title: "Förfrågningar",
		action: {
			icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"/></svg>',
			label: "Uppdatera",
			type: "event",
			id: "refresh",
		},
		onAction: handleRefresh,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on user identity only
	useEffect(() => {
		// Migrate any pre-existing guest signups stored locally onto the now
		// logged-in account. New guest signups are no longer created.
		if (!user) return;
		const stored = getStoredSignups();
		if (stored.length === 0) return;
		const tokens = stored.map((s) => s.token);
		claimGuestSignups({ data: { tokens } }).then(({ claimed }) => {
			saveStoredSignups([]);
			if (claimed > 0) router.invalidate();
		});
	}, [user?.sub]);

	useEffect(() => {
		const id = setInterval(() => router.invalidate(), 30_000);
		return () => clearInterval(id);
	}, [router]);

	const [infoOpen, setInfoOpen] = useState(
		() =>
			typeof window === "undefined" || !localStorage.getItem(INFO_HIDDEN_KEY),
	);
	const [tab, setTab] = useState<"others" | "mine" | "signed-up">("others");
	const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
		null,
	);
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
	const [pendingWithdrawId, setPendingWithdrawId] = useState<string | null>(
		null,
	);
	const [signupDialogId, setSignupDialogId] = useState<string | null>(null);
	const [signupComment, setSignupComment] = useState("");
	const [signupPhone, setSignupPhone] = useState("");
	const [pastCollapsed, setPastCollapsed] = useState(true);
	const [kickTarget, setKickTarget] = useState<KickTarget | null>(null);
	const [kickReason, setKickReason] = useState("");
	const [onBehalfRequestId, setOnBehalfRequestId] = useState<string | null>(
		null,
	);
	const [onBehalfName, setOnBehalfName] = useState("");
	const [onBehalfScoutGroup, setOnBehalfScoutGroup] = useState("");
	const [onBehalfPhone, setOnBehalfPhone] = useState("");
	const [onBehalfComment, setOnBehalfComment] = useState("");

	if (!requests) return null;

	const infoBanner = (
		<>
			<Collapse in={infoOpen}>
				<Alert
					severity="info"
					variant="outlined"
					sx={{ mb: 2 }}
					onClose={() => {
						localStorage.setItem(INFO_HIDDEN_KEY, "1");
						setInfoOpen(false);
					}}
				>
					I platsbanken kan funktionärer annonsera behov av hjälp. Du som ledare
					eller funktionär kan anmäla dig för att hjälpa till. I särskilda fall
					kan lägerledningen komma att be specifika byar eller kårer att skriva
					upp sig på vissa pass.
				</Alert>
			</Collapse>
			{!infoOpen && (
				<Alert
					severity="info"
					variant="outlined"
					sx={{ mb: 2, cursor: "pointer", py: 0.5 }}
					onClick={() => {
						localStorage.removeItem(INFO_HIDDEN_KEY);
						setInfoOpen(true);
					}}
					action={<ExpandMoreIcon fontSize="small" />}
				>
					Om platsbanken
				</Alert>
			)}
		</>
	);

	if (!user) {
		return (
			<Box>
				{infoBanner}
				<Typography color="text.secondary">
					Logga in för att se förfrågningar.
				</Typography>
			</Box>
		);
	}

	if (!caps.canSeeAny) {
		return (
			<Box>
				{infoBanner}
				<Typography color="text.secondary">
					Du har inte behörighet att se några förfrågningar. Kontakta
					lägerledningen om du tror att detta är fel.
				</Typography>
			</Box>
		);
	}

	const selectedRequest =
		requests.find((r) => r.id === selectedRequestId) ?? null;

	const filtered =
		tab === "signed-up"
			? requests.filter((r) => r.signups.some((s) => s.userId === user.sub))
			: canCreate
				? requests.filter((r) =>
						tab === "mine"
							? r.createdBy === user.sub
							: r.createdBy !== user.sub,
					)
				: requests;
	const now = new Date();
	const currentFiltered = filtered.filter((r) => new Date(r.endTime) >= now);
	const pastFiltered = filtered.filter((r) => new Date(r.endTime) < now);

	const sortItems = (items: Request[]) =>
		[...items].sort((a, b) => {
			const aUp = a.signups.some((s) => s.userId === user.sub) ? 0 : 1;
			const bUp = b.signups.some((s) => s.userId === user.sub) ? 0 : 1;
			if (aUp !== bUp) return aUp - bUp;
			return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
		});

	const grouped = groupByDay(
		[...currentFiltered].sort(
			(a, b) =>
				new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
		),
	).map((group) => ({ ...group, items: sortItems(group.items) }));

	const pastGrouped = groupByDay(
		[...pastFiltered].sort(
			(a, b) =>
				new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
		),
	).map((group) => ({ ...group, items: sortItems(group.items) }));

	async function handleDeleteConfirm() {
		if (!pendingDeleteId) return;
		await deleteRequest({ data: { id: pendingDeleteId } });
		setPendingDeleteId(null);
		if (selectedRequestId === pendingDeleteId) setSelectedRequestId(null);
		router.invalidate();
	}

	async function handleSignupConfirm() {
		if (!signupDialogId) return;
		await signUpForRequest({
			data: {
				requestId: signupDialogId,
				phone: signupPhone || undefined,
				comment: signupComment || undefined,
			},
		});
		setSignupDialogId(null);
		setSignupComment("");
		setSignupPhone("");
		router.invalidate();
	}

	async function handleOnBehalfConfirm() {
		if (!onBehalfRequestId) return;
		await bookOnBehalf({
			data: {
				requestId: onBehalfRequestId,
				name: onBehalfName,
				scoutGroup: onBehalfScoutGroup,
				phone: onBehalfPhone || undefined,
				comment: onBehalfComment || undefined,
			},
		});
		setOnBehalfRequestId(null);
		setOnBehalfName("");
		setOnBehalfScoutGroup("");
		setOnBehalfPhone("");
		setOnBehalfComment("");
		router.invalidate();
	}

	async function handleWithdraw(requestId: string) {
		await withdrawFromRequest({ data: { requestId } });
		router.invalidate();
	}

	async function handleKickConfirm() {
		if (!kickTarget) return;
		await kickFromRequest({
			data: {
				requestId: kickTarget.requestId,
				userId: kickTarget.userId,
				reason: kickReason,
			},
		});
		setKickTarget(null);
		setKickReason("");
		router.invalidate();
	}

	async function handleUnblock(requestId: string, userId: string) {
		await unblockFromRequest({ data: { requestId, userId } });
		router.invalidate();
	}

	return (
		<Box>
			{infoBanner}

			<Box
				display="flex"
				justifyContent="space-between"
				alignItems={{ xs: "flex-start", sm: "center" }}
				flexDirection={{ xs: "column", sm: "row" }}
				mb={3}
			>
				<Box
					display="flex"
					gap={1}
					alignItems="center"
					order={{ xs: 0, sm: 1 }}
					alignSelf={{ xs: "flex-end", sm: "auto" }}
				>
					{canCreate && (
						<Button
							variant="contained"
							startIcon={<AddIcon />}
							component={Link}
							to="/requests/new"
						>
							Ny förfrågan
						</Button>
					)}
				</Box>
				<Tabs
					value={tab}
					onChange={(_, v) => setTab(v)}
					sx={{ order: { xs: 1, sm: 0 } }}
				>
					{canCreate ? (
						<Tab label="Andras" value="others" />
					) : (
						<Tab label="Alla" value="others" />
					)}
					{canCreate && <Tab label="Mina" value="mine" />}
					<Tab label="Anmälda" value="signed-up" />
				</Tabs>
			</Box>
			{filtered.length === 0 ? (
				<Typography color="text.secondary">
					{tab === "mine"
						? "Du har inga förfrågningar än."
						: tab === "signed-up"
							? "Du är inte anmäld till någon förfrågan."
							: "Inga förfrågningar ännu."}
				</Typography>
			) : (
				<Stack spacing={4}>
					{grouped.length === 0 && (
						<Typography color="text.secondary">
							Inga kommande förfrågningar.
						</Typography>
					)}
					{grouped.map(({ label, items }) => {
						const collapsed = collapsedDays.has(label);
						const toggle = () =>
							setCollapsedDays((prev) => {
								const next = new Set(prev);
								if (next.has(label)) next.delete(label);
								else next.add(label);
								return next;
							});
						return (
							<Box key={label}>
								<Box
									display="flex"
									alignItems="center"
									onClick={toggle}
									sx={{
										cursor: "pointer",
										userSelect: "none",
										mb: collapsed ? 0 : 1,
									}}
								>
									<Typography
										variant="h6"
										sx={{
											textTransform: "capitalize",
											color: "text.secondary",
											flex: 1,
										}}
									>
										{label}
									</Typography>
									<IconButton size="small" sx={{ color: "text.secondary" }}>
										{collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
									</IconButton>
								</Box>
								<Collapse in={!collapsed}>
									<Stack spacing={2}>
										{items.map((req) => {
											const isSignedUp = req.signups.some(
												(s) => s.userId === user.sub,
											);
											const isRemoved = !!req.myBlock;
											const isFull = req.signups.length >= req.peopleNeeded;

											return (
												<Card
													key={req.id}
													variant="outlined"
													onClick={() => setSelectedRequestId(req.id)}
													sx={{
														cursor: "pointer",
														"&:hover": { borderColor: "primary.light" },
														...(isSignedUp
															? { borderColor: "primary.main" }
															: {}),
													}}
												>
													<CardContent sx={{ "&:last-child": { pb: 2 } }}>
														<Box display="flex" alignItems="center" gap={1}>
															<Box flex={1} minWidth={0}>
																<Typography
																	variant="subtitle1"
																	fontWeight={600}
																	noWrap
																>
																	{req.title}
																</Typography>
																<Box
																	display="flex"
																	gap={1}
																	mt={0.5}
																	alignItems="center"
																	flexWrap="wrap"
																>
																	<Typography
																		variant="body2"
																		color="text.secondary"
																	>
																		{formatTime(req.startTime)}–
																		{formatTime(req.endTime)}
																	</Typography>
																	<Chip
																		icon={<PeopleIcon />}
																		label={`${req.signups.length}/${req.peopleNeeded}`}
																		size="small"
																		variant="outlined"
																		color={isFull ? "success" : "default"}
																	/>
																	{showTypeLabel &&
																		normalizeRequestTypes(req.types).map(
																			(t) => (
																				<Chip
																					key={t}
																					label={
																						t === "staff"
																							? "Funktionär"
																							: "Ledare"
																					}
																					size="small"
																					color={
																						t === "staff"
																							? "secondary"
																							: "primary"
																					}
																					variant="outlined"
																				/>
																			),
																		)}
																</Box>
															</Box>

															<Box
																display="flex"
																alignItems="center"
																gap={0.5}
																flexShrink={0}
																onClick={(e) => e.stopPropagation()}
															>
																{tab !== "mine" &&
																	(isRouterLoading ? (
																		<Skeleton
																			variant="rounded"
																			width={80}
																			height={30}
																		/>
																	) : isRemoved ? (
																		<Button
																			size="small"
																			variant="outlined"
																			color="warning"
																			onClick={() =>
																				setSelectedRequestId(req.id)
																			}
																		>
																			Nekad
																		</Button>
																	) : isSignedUp ? (
																		<Button
																			size="small"
																			variant="outlined"
																			color="warning"
																			onClick={() =>
																				setPendingWithdrawId(req.id)
																			}
																		>
																			Avanmäl
																		</Button>
																	) : (
																		<Button
																			size="small"
																			variant="outlined"
																			color="primary"
																			disabled={isFull}
																			onClick={() => {
																				setSignupDialogId(req.id);
																				setSignupComment("");
																			}}
																		>
																			{isFull ? "Fullt" : "Anmäl dig"}
																		</Button>
																	))}
															</Box>
															<ChevronRightIcon
																fontSize="small"
																sx={{ color: "text.disabled", flexShrink: 0 }}
															/>
														</Box>
													</CardContent>
												</Card>
											);
										})}
									</Stack>
								</Collapse>
							</Box>
						);
					})}
					{pastGrouped.length > 0 && (
						<Box>
							<Box
								display="flex"
								alignItems="center"
								onClick={() => setPastCollapsed((v) => !v)}
								sx={{
									cursor: "pointer",
									userSelect: "none",
									mb: pastCollapsed ? 0 : 1,
								}}
							>
								<Typography
									variant="h6"
									sx={{ color: "text.disabled", flex: 1 }}
								>
									Tidigare
								</Typography>
								<IconButton size="small" sx={{ color: "text.disabled" }}>
									{pastCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
								</IconButton>
							</Box>
							<Collapse in={!pastCollapsed}>
								<Stack spacing={4}>
									{pastGrouped.map(({ label, items }) => {
										const collapsed = collapsedDays.has(`past-${label}`);
										const toggle = () =>
											setCollapsedDays((prev) => {
												const next = new Set(prev);
												const key = `past-${label}`;
												if (next.has(key)) next.delete(key);
												else next.add(key);
												return next;
											});
										return (
											<Box key={`past-${label}`}>
												<Box
													display="flex"
													alignItems="center"
													onClick={toggle}
													sx={{
														cursor: "pointer",
														userSelect: "none",
														mb: collapsed ? 0 : 1,
													}}
												>
													<Typography
														variant="h6"
														sx={{
															textTransform: "capitalize",
															color: "text.disabled",
															flex: 1,
														}}
													>
														{label}
													</Typography>
													<IconButton
														size="small"
														sx={{ color: "text.disabled" }}
													>
														{collapsed ? (
															<ExpandMoreIcon />
														) : (
															<ExpandLessIcon />
														)}
													</IconButton>
												</Box>
												<Collapse in={!collapsed}>
													<Stack spacing={2}>
														{items.map((req) => {
															const isSignedUp = req.signups.some(
																(s) => s.userId === user.sub,
															);
															const isFull =
																req.signups.length >= req.peopleNeeded;
															return (
																<Card
																	key={req.id}
																	variant="outlined"
																	onClick={() => setSelectedRequestId(req.id)}
																	sx={{
																		cursor: "pointer",
																		opacity: 0.6,
																		"&:hover": { borderColor: "primary.light" },
																		...(isSignedUp
																			? { borderColor: "primary.main" }
																			: {}),
																	}}
																>
																	<CardContent
																		sx={{ "&:last-child": { pb: 2 } }}
																	>
																		<Box
																			display="flex"
																			justifyContent="space-between"
																			alignItems="flex-start"
																			gap={1}
																		>
																			<Box flex={1} minWidth={0}>
																				<Typography
																					variant="subtitle1"
																					fontWeight={500}
																					noWrap
																				>
																					{req.title}
																				</Typography>
																				<Typography
																					variant="body2"
																					color="text.secondary"
																				>
																					{formatTime(req.startTime)}–
																					{formatTime(req.endTime)}
																				</Typography>
																			</Box>
																			<Box
																				display="flex"
																				alignItems="center"
																				gap={0.5}
																				flexShrink={0}
																			>
																				<Chip
																					icon={<PeopleIcon />}
																					label={`${req.signups.length}/${req.peopleNeeded}`}
																					size="small"
																					variant="outlined"
																					color={isFull ? "success" : "default"}
																				/>
																				<ChevronRightIcon
																					fontSize="small"
																					sx={{ color: "text.disabled" }}
																				/>
																			</Box>
																		</Box>
																	</CardContent>
																</Card>
															);
														})}
													</Stack>
												</Collapse>
											</Box>
										);
									})}
								</Stack>
							</Collapse>
						</Box>
					)}
				</Stack>
			)}
			{/* Detail drawer */}
			<Drawer
				anchor="right"
				open={selectedRequest !== null}
				onClose={() => setSelectedRequestId(null)}
				PaperProps={{ sx: { width: { xs: "100%", sm: 400 }, p: 3 } }}
			>
				{selectedRequest &&
					(() => {
						const req = selectedRequest;
						const isSignedUp = req.signups.some((s) => s.userId === user.sub);
						const isRemoved = !!req.myBlock;
						const isFull = req.signups.length >= req.peopleNeeded;
						const isOwner = canManageRequest(caps, req, user.sub);
						// Creators may view the roster of any request (read-only unless
						// they also manage it); managers additionally get the kick action.
						const canSeeRoster = canViewRoster(caps, req, user.sub);
						const canOnBehalf = normalizeRequestTypes(req.types).some((t) =>
							caps.canBookOnBehalf(t),
						);

						return (
							<Box display="flex" flexDirection="column" height="100%">
								<Box display="flex" alignItems="flex-start" gap={1} mb={2}>
									<Box flex={1}>
										<Typography variant="h6" fontWeight={600}>
											{req.title}
										</Typography>
										<Typography variant="body2" color="text.secondary">
											{formatDate(req.startTime)}, {formatTime(req.startTime)}–
											{formatTime(req.endTime)}
										</Typography>
									</Box>
									<IconButton
										size="small"
										onClick={() => setSelectedRequestId(null)}
									>
										<CloseIcon />
									</IconButton>
								</Box>

								<Divider sx={{ mb: 2 }} />

								<Stack spacing={2} flex={1} overflow="auto">
									{req.description && (
										<Box>
											<Typography
												variant="overline"
												color="text.secondary"
												display="block"
											>
												Beskrivning
											</Typography>
											<Typography variant="body2">{req.description}</Typography>
										</Box>
									)}

									<Box display="flex" gap={1} flexWrap="wrap">
										<Chip
											icon={<PeopleIcon />}
											label={`${req.signups.length}/${req.peopleNeeded} person${req.peopleNeeded !== 1 ? "er" : ""}`}
											size="small"
											variant="outlined"
											color={isFull ? "success" : "default"}
										/>
										{req.location && (
											<Chip
												icon={<LocationOnIcon />}
												label={req.location}
												size="small"
												variant="outlined"
											/>
										)}
									</Box>

									{(req.contactName || req.contactPhone) && (
										<Box>
											<Typography
												variant="overline"
												color="text.secondary"
												display="block"
											>
												Kontaktperson
											</Typography>
											{req.contactName && (
												<Typography variant="body2">
													{req.contactName}
												</Typography>
											)}
											{req.contactPhone && (
												<Box
													display="flex"
													alignItems="center"
													gap={0.5}
													mt={0.25}
												>
													<PhoneIcon
														sx={{ fontSize: 14, color: "text.secondary" }}
													/>
													<Typography
														variant="body2"
														component="a"
														href={`tel:${req.contactPhone}`}
														sx={{
															color: "inherit",
															textDecoration: "none",
															"&:hover": { textDecoration: "underline" },
														}}
													>
														{req.contactPhone}
													</Typography>
												</Box>
											)}
										</Box>
									)}

									<Typography variant="caption" color="text.secondary">
										Skapad av {req.creatorName}
									</Typography>

									{canSeeRoster && req.signups.length > 0 && (
										<Box>
											<Typography
												variant="overline"
												color="text.secondary"
												display="block"
												mb={0.5}
											>
												Anmälda
											</Typography>
											<Stack spacing={1}>
												{req.signups.map((s) => (
													<Box
														key={s.userId}
														display="flex"
														alignItems="flex-start"
														justifyContent="space-between"
														gap={1}
													>
														<Box>
															<Typography variant="body2">
																{s.userName}
															</Typography>
															{s.scoutGroup && (
																<Typography
																	variant="caption"
																	color="text.secondary"
																	display="block"
																>
																	{s.scoutGroup}
																</Typography>
															)}
															{s.phone && (
																<Typography
																	variant="caption"
																	color="text.secondary"
																	display="block"
																	component="a"
																	href={`tel:${s.phone}`}
																	sx={{
																		textDecoration: "none",
																		"&:hover": { textDecoration: "underline" },
																	}}
																>
																	<PhoneIcon
																		sx={{
																			fontSize: 10,
																			mr: 0.5,
																			verticalAlign: "middle",
																		}}
																	/>
																	{s.phone}
																</Typography>
															)}
															{s.comment && (
																<Typography
																	variant="caption"
																	color="text.secondary"
																	display="block"
																>
																	{s.comment}
																</Typography>
															)}
														</Box>
														{isOwner && (
															<Tooltip title="Ta bort från förfrågan">
																<IconButton
																	size="small"
																	color="warning"
																	onClick={() =>
																		setKickTarget({
																			requestId: req.id,
																			userId: s.userId,
																			userName: s.userName ?? "",
																		})
																	}
																>
																	<DeleteIcon fontSize="small" />
																</IconButton>
															</Tooltip>
														)}
													</Box>
												))}
											</Stack>
										</Box>
									)}

									{isOwner && req.blocks.length > 0 && (
										<Box>
											<Typography
												variant="overline"
												color="text.secondary"
												display="block"
												mb={0.5}
											>
												Blockerade
											</Typography>
											<Stack spacing={1}>
												{req.blocks.map((b) => (
													<Box
														key={b.userId}
														display="flex"
														alignItems="flex-start"
														justifyContent="space-between"
														gap={1}
													>
														<Box>
															<Typography variant="body2">
																{b.userName}
															</Typography>
															<Typography
																variant="caption"
																color="text.secondary"
																display="block"
															>
																{b.reason}
															</Typography>
														</Box>
														<Tooltip title="Återinför">
															<IconButton
																size="small"
																color="primary"
																onClick={() => handleUnblock(req.id, b.userId)}
															>
																<UndoIcon fontSize="small" />
															</IconButton>
														</Tooltip>
													</Box>
												))}
											</Stack>
										</Box>
									)}

									{!isOwner && isRemoved && (
										<Alert severity="warning">
											Du har nekats deltagande i denna förfrågan.
											{req.myBlock && ` Anledning: ${req.myBlock}`}
										</Alert>
									)}
								</Stack>

								<Box mt={2} pt={2} borderTop={1} borderColor="divider">
									<Stack spacing={1}>
										{isOwner ? (
											<Box display="flex" gap={1}>
												<Button
													variant="outlined"
													startIcon={<EditIcon />}
													component={Link as any}
													to="/requests/$requestId/edit"
													params={{ requestId: req.id }}
													sx={{ flex: 1 }}
												>
													Redigera
												</Button>
												<Button
													variant="outlined"
													color="error"
													onClick={() => setPendingDeleteId(req.id)}
													sx={{ flex: 1 }}
												>
													Avbryt förfrågan
												</Button>
											</Box>
										) : isRouterLoading ? (
											<Skeleton variant="rounded" height={36} />
										) : isRemoved ? null : isSignedUp ? (
											<Button
												fullWidth
												variant="outlined"
												color="warning"
												onClick={() => setPendingWithdrawId(req.id)}
											>
												Avanmäl mig
											</Button>
										) : (
											<Button
												fullWidth
												variant="contained"
												disabled={isFull}
												onClick={() => {
													setSignupDialogId(req.id);
													setSignupComment("");
												}}
											>
												{isFull ? "Fullt" : "Anmäl dig"}
											</Button>
										)}
										{canOnBehalf && (
											<Button
												fullWidth
												variant="outlined"
												startIcon={<PersonAddIcon />}
												onClick={() => {
													setOnBehalfRequestId(req.id);
													setOnBehalfName("");
													setOnBehalfScoutGroup("");
													setOnBehalfPhone("");
													setOnBehalfComment("");
												}}
											>
												Anmäl någon annan
											</Button>
										)}
									</Stack>
								</Box>
							</Box>
						);
					})()}
			</Drawer>
			{/* Signup dialog */}
			<Dialog
				open={signupDialogId !== null}
				onClose={() => setSignupDialogId(null)}
				fullWidth
				maxWidth="xs"
			>
				<DialogTitle>Anmäl dig</DialogTitle>
				<DialogContent>
					<Stack spacing={2} sx={{ mt: 1 }}>
						<TextField
							label="Telefonnummer (valfritt)"
							fullWidth
							value={signupPhone}
							onChange={(e) => setSignupPhone(e.target.value)}
							helperText="Delas med arrangörer för att underlätta kommunikation."
						/>
						<TextField
							label="Kommentar (valfri)"
							fullWidth
							multiline
							rows={2}
							value={signupComment}
							onChange={(e) => setSignupComment(e.target.value)}
						/>
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setSignupDialogId(null)}>Avbryt</Button>
					<Button variant="contained" onClick={handleSignupConfirm}>
						Anmäl
					</Button>
				</DialogActions>
			</Dialog>
			{/* Book on behalf dialog */}
			<Dialog
				open={onBehalfRequestId !== null}
				onClose={() => setOnBehalfRequestId(null)}
				fullWidth
				maxWidth="xs"
			>
				<DialogTitle>Anmäl någon annan</DialogTitle>
				<DialogContent>
					<Stack spacing={2} sx={{ mt: 1 }}>
						<TextField
							label="Namn"
							fullWidth
							required
							value={onBehalfName}
							onChange={(e) => setOnBehalfName(e.target.value)}
						/>
						<TextField
							label="Vilken scoutkår tillhör personen?"
							fullWidth
							required
							value={onBehalfScoutGroup}
							onChange={(e) => setOnBehalfScoutGroup(e.target.value)}
						/>
						<TextField
							label="Telefonnummer (valfritt)"
							fullWidth
							value={onBehalfPhone}
							onChange={(e) => setOnBehalfPhone(e.target.value)}
						/>
						<TextField
							label="Kommentar (valfri)"
							fullWidth
							multiline
							rows={2}
							value={onBehalfComment}
							onChange={(e) => setOnBehalfComment(e.target.value)}
						/>
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setOnBehalfRequestId(null)}>Avbryt</Button>
					<Button
						variant="contained"
						onClick={handleOnBehalfConfirm}
						disabled={!onBehalfName.trim() || !onBehalfScoutGroup.trim()}
					>
						Anmäl
					</Button>
				</DialogActions>
			</Dialog>
			{/* Kick dialog */}
			<Dialog
				open={kickTarget !== null}
				onClose={() => setKickTarget(null)}
				fullWidth
				maxWidth="xs"
			>
				<DialogTitle>Ta bort {kickTarget?.userName}?</DialogTitle>
				<DialogContent>
					<DialogContentText>Ange anledning (obligatoriskt).</DialogContentText>
					<TextField
						label="Anledning"
						fullWidth
						multiline
						rows={3}
						value={kickReason}
						onChange={(e) => setKickReason(e.target.value)}
						sx={{ mt: 1 }}
					/>
					<DialogContentText sx={{ mt: 1 }}>
						Tänk på att motiveringen syns för personen du tar bort.
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setKickTarget(null)}>Avbryt</Button>
					<Button
						color="error"
						disabled={!kickReason.trim()}
						onClick={handleKickConfirm}
					>
						Ta bort
					</Button>
				</DialogActions>
			</Dialog>
			{/* Withdraw confirmation dialog */}
			<Dialog
				open={pendingWithdrawId !== null}
				onClose={() => setPendingWithdrawId(null)}
			>
				<DialogTitle>Avanmäl dig?</DialogTitle>
				<DialogContent>
					<DialogContentText>
						Är du säker på att du vill avanmäla dig? Tänk på att personen du
						anmält dig till troligtvis räknar med att du kommer.
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setPendingWithdrawId(null)}>Avbryt</Button>
					<Button
						color="warning"
						variant="contained"
						onClick={async () => {
							if (!pendingWithdrawId) return;
							await handleWithdraw(pendingWithdrawId);
							setPendingWithdrawId(null);
						}}
					>
						Avanmäl
					</Button>
				</DialogActions>
			</Dialog>
			{/* Delete request dialog */}
			<Dialog
				open={pendingDeleteId !== null}
				onClose={() => setPendingDeleteId(null)}
			>
				<DialogTitle>Avbryt förfrågan?</DialogTitle>
				<DialogContent>
					<DialogContentText>
						Är du säker på att du vill avbryta förfrågan? Det går inte att
						ångra.
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setPendingDeleteId(null)}>Avbryt</Button>
					<Button color="error" onClick={handleDeleteConfirm}>
						Ta bort
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
