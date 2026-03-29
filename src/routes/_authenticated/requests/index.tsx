import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PeopleIcon from "@mui/icons-material/People";
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
import { createFileRoute, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAppBarTitle } from "#/lib/use-app-bar-title";
import { useOptionalUser } from "#/lib/user-context";
import {
	claimGuestSignups,
	deleteRequest,
	getRequests,
	guestSignUpForRequest,
	kickFromRequest,
	signUpForRequest,
	unblockFromRequest,
	withdrawFromRequest,
	withdrawGuestFromRequest,
} from "#/server/requests";

const CLAIM_TOKENS_KEY = "j26-claim-tokens";

interface GuestSignup {
	token: string;
	requestId: string;
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

export const Route = createFileRoute("/_authenticated/requests/")({
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
	const isRouterLoading = useRouterState({ select: (s) => s.status !== "idle" });

	const canCreate = user?.roles.includes("requests:create") ?? false;
	const isAdmin = user?.roles.includes("admin") ?? false;

	useAppBarTitle("Förfrågningar");

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on user identity only
	useEffect(() => {
		if (!user) return;
		const stored = getStoredSignups();
		if (stored.length === 0) return;
		const tokens = stored.map((s) => s.token);
		claimGuestSignups({ data: { tokens } }).then(({ claimed }) => {
			saveStoredSignups([]);
			setGuestSignups([]);
			if (claimed > 0) router.invalidate();
		});
	}, [user?.sub]);

	useEffect(() => {
		const id = setInterval(() => router.invalidate(), 30_000);
		return () => clearInterval(id);
	}, [router]);

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
	const [guestName, setGuestName] = useState("");
	const [guestScoutGroup, setGuestScoutGroup] = useState("");
	const [guestSignups, setGuestSignups] = useState<GuestSignup[]>(() =>
		typeof window !== "undefined" ? getStoredSignups() : [],
	);
	const [kickTarget, setKickTarget] = useState<KickTarget | null>(null);
	const [kickReason, setKickReason] = useState("");

	if (!requests) return null;

	const selectedRequest =
		requests.find((r) => r.id === selectedRequestId) ?? null;

	const filtered =
		tab === "signed-up" && user
			? requests.filter((r) => r.signups.some((s) => s.userId === user.sub))
			: tab === "signed-up" && !user
				? requests.filter((r) => guestSignups.some((g) => g.requestId === r.id))
				: canCreate && user
					? requests.filter((r) =>
							tab === "mine" ? r.createdBy === user.sub : r.createdBy !== user.sub,
						)
					: requests;
	const chronological = [...filtered].sort(
		(a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
	);
	const grouped = groupByDay(chronological).map((group) => ({
		...group,
		items: [...group.items].sort((a, b) => {
			if (user) {
				const aUp = a.signups.some((s) => s.userId === user.sub) ? 0 : 1;
				const bUp = b.signups.some((s) => s.userId === user.sub) ? 0 : 1;
				if (aUp !== bUp) return aUp - bUp;
			}
			return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
		}),
	}));

	async function handleDeleteConfirm() {
		if (!pendingDeleteId) return;
		await deleteRequest({ data: { id: pendingDeleteId } });
		setPendingDeleteId(null);
		if (selectedRequestId === pendingDeleteId) setSelectedRequestId(null);
		router.invalidate();
	}

	async function handleSignupConfirm() {
		if (!signupDialogId) return;
		if (user) {
			await signUpForRequest({
				data: {
					requestId: signupDialogId,
					comment: signupComment || undefined,
				},
			});
		} else {
			const { claimToken } = await guestSignUpForRequest({
				data: {
					requestId: signupDialogId,
					name: guestName,
					scoutGroup: guestScoutGroup,
					comment: signupComment || undefined,
				},
			});
			const updated = [
				...guestSignups,
				{ token: claimToken, requestId: signupDialogId },
			];
			setGuestSignups(updated);
			saveStoredSignups(updated);
		}
		setSignupDialogId(null);
		setSignupComment("");
		setGuestName("");
		setGuestScoutGroup("");
		router.invalidate();
	}

	async function handleWithdraw(requestId: string) {
		if (user) {
			await withdrawFromRequest({ data: { requestId } });
		} else {
			const signup = guestSignups.find((s) => s.requestId === requestId);
			if (!signup) return;
			await withdrawGuestFromRequest({ data: { claimToken: signup.token } });
			const updated = guestSignups.filter((s) => s.requestId !== requestId);
			setGuestSignups(updated);
			saveStoredSignups(updated);
		}
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
			<Box
				display="flex"
				justifyContent="space-between"
				alignItems={{ xs: "flex-start", sm: "center" }}
				flexDirection={{ xs: "column", sm: "row" }}
				mb={3}
			>
				<Box display="flex" gap={1} alignItems="center" order={{ xs: 0, sm: 1 }} alignSelf={{ xs: "flex-end", sm: "auto" }} mt={{ xs: 1, sm: 0 }}>
					<Tooltip title="Uppdatera">
						<IconButton onClick={() => router.invalidate()} disabled={isRouterLoading}>
							<RefreshIcon />
						</IconButton>
					</Tooltip>
					{canCreate && (
						<Button
							variant="contained"
							startIcon={<AddIcon />}
							component={Link as any}
							to="/requests/new"
						>
							Ny förfrågan
						</Button>
					)}
				</Box>
				<Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ order: { xs: 1, sm: 0 } }}>
					{canCreate ? <Tab label="Andras" value="others" /> : <Tab label="Alla" value="others" />}
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
											const isSignedUp = user
												? req.signups.some((s) => s.userId === user.sub)
												: guestSignups.some((s) => s.requestId === req.id);
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
																	) : req.myBlock ? (
																		<Button
																			size="small"
																			variant="outlined"
																			disabled
																		>
																			Borttagen
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
						const isSignedUp = user
							? req.signups.some((s) => s.userId === user.sub)
							: guestSignups.some((s) => s.requestId === req.id);
						const isFull = req.signups.length >= req.peopleNeeded;
						const isOwner =
							isAdmin ||
							(canCreate && user ? req.createdBy === user.sub : false);

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

									<Typography variant="caption" color="text.secondary">
										Skapad av {req.creatorName}
									</Typography>

									{isOwner && req.signups.length > 0 && (
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
																onClick={() =>
																	handleUnblock(req.id, b.userId)
																}
															>
																<UndoIcon fontSize="small" />
															</IconButton>
														</Tooltip>
													</Box>
												))}
											</Stack>
										</Box>
									)}

									{!isOwner && req.myBlock && (
										<Alert severity="warning">
											Du har tagits bort från denna förfrågan. Anledning:{" "}
											{req.myBlock}
										</Alert>
									)}
								</Stack>

								<Box mt={2} pt={2} borderTop={1} borderColor="divider">
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
									) : req.myBlock ? (
										<Button fullWidth variant="outlined" disabled>
											Du har tagits bort från denna förfrågan
										</Button>
									) : isSignedUp ? (
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
						{!user && (
							<>
								<TextField
									label="Namn"
									fullWidth
									required
									value={guestName}
									onChange={(e) => setGuestName(e.target.value)}
								/>
								<TextField
									label="Vilken scoutkår tillhör du?"
									fullWidth
									required
									value={guestScoutGroup}
									onChange={(e) => setGuestScoutGroup(e.target.value)}
								/>
							</>
						)}
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
					<Button
						variant="contained"
						onClick={handleSignupConfirm}
						disabled={!user && (!guestName.trim() || !guestScoutGroup.trim())}
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
