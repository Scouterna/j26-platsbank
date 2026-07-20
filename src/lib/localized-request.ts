import { useTolgee } from "@tolgee/react";

/**
 * Poster-authored content exists in Swedish (the source) and English (a
 * mandatory translation). These are the fields needed to localise a request
 * for display — a request row satisfies this shape.
 */
export interface LocalizableRequestContent {
	title: string;
	titleEn: string;
	description: string;
	descriptionEn: string;
	location: string;
	locationEn: string;
}

export interface LocalizedRequestContent {
	title: string;
	description: string;
	location: string;
}

/**
 * Pick the content language for display from the viewer's active UI language:
 * Swedish viewers get Swedish, everyone else (en / uk / nl) gets English.
 * English falls back to the Swedish source only if it is somehow missing, so
 * lists never render blank.
 */
export function localizeRequestContent(
	req: LocalizableRequestContent,
	language: string,
): LocalizedRequestContent {
	if (language === "sv") {
		return {
			title: req.title,
			description: req.description,
			location: req.location,
		};
	}
	return {
		title: req.titleEn || req.title,
		description: req.descriptionEn || req.description,
		location: req.locationEn || req.location,
	};
}

/**
 * The viewer's active content language, tracked reactively so display updates
 * when the shell switches language. Defaults to Swedish.
 */
export function useContentLanguage(): string {
	const tolgee = useTolgee(["language"]);
	return tolgee.getLanguage() ?? "sv";
}
