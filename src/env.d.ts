/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly J26_PUBLIC_TOLGEE_BACKEND_FETCH_PREFIX?: string;
	readonly J26_PUBLIC_TOLGEE_API_URL?: string;
	readonly J26_PUBLIC_TOLGEE_API_KEY?: string;
	readonly J26_PUBLIC_TOLGEE_PROJECT_ID?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
