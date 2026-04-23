import { useCallback, useEffect } from "react";

interface AppBarAction {
	icon: string;
	label: string;
	type: "navigate" | "event";
	path?: string;
	id?: string;
}

interface UseAppBarOptions {
	title: string;
	action?: AppBarAction | null;
	onAction?: () => void;
}

function postAppBar(title: string, action?: AppBarAction | null) {
	const message: Record<string, unknown> = { type: "j26:appBar", title };
	if (action !== undefined) {
		message.action = action;
	}
	window.parent.postMessage(message, window.location.origin);
}

/**
 * Set the shell app bar title and optionally register an action button.
 *
 * When `action.type` is `"event"`, the shell posts a `j26:appBarAction`
 * message back; supply `onAction` to handle it.
 */
export function useAppBarTitle(
	titleOrOptions: string | UseAppBarOptions,
): void {
	const opts =
		typeof titleOrOptions === "string"
			? { title: titleOrOptions }
			: titleOrOptions;

	const { title, action, onAction } = opts;

	// Destructure to primitives so useEffect deps are stable.
	const actionIcon = action?.icon;
	const actionLabel = action?.label;
	const actionType = action?.type;
	const actionPath = action?.type === "navigate" ? action.path : undefined;
	const actionId = action?.type === "event" ? action.id : undefined;

	useEffect(() => {
		if (!actionType || !actionIcon || !actionLabel) {
			postAppBar(title, action === null ? null : undefined);
			return;
		}
		if (actionType === "navigate" && actionPath) {
			postAppBar(title, {
				icon: actionIcon,
				label: actionLabel,
				type: "navigate",
				path: actionPath,
			});
		} else if (actionType === "event" && actionId) {
			postAppBar(title, {
				icon: actionIcon,
				label: actionLabel,
				type: "event",
				id: actionId,
			});
		}
	}, [
		title,
		action,
		actionIcon,
		actionLabel,
		actionType,
		actionPath,
		actionId,
	]);

	const handleAction = useCallback(() => {
		onAction?.();
	}, [onAction]);

	useEffect(() => {
		if (actionType !== "event" || !actionId) return;

		function handleMessage(event: MessageEvent) {
			if (event.origin !== window.location.origin) return;
			const data = event.data;
			if (data?.type === "j26:appBarAction" && data.id === actionId) {
				handleAction();
			}
		}

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [actionType, actionId, handleAction]);
}
