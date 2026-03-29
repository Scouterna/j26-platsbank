import { useEffect } from "react";

export function useAppBarTitle(title: string) {
	useEffect(() => {
		window.parent.postMessage({ type: "j26:appBar", title }, window.location.origin);
	}, [title]);
}
