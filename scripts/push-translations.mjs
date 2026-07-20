#!/usr/bin/env node
/**
 * Push all platsbank UI strings (Swedish + English) to Tolgee.
 *
 * Reads scripts/translations.json ({ "<key>": { sv, en } }) and upserts each key
 * via POST /v2/projects/{projectId}/translations ("Create key or update
 * translations"). Only the languages present in each entry (sv, en) are set, so
 * machine-translated uk/nl values in Tolgee are left untouched. Safe to re-run.
 *
 * Env (loaded from .env.local via the `tolgee:push` npm script):
 *   J26_PUBLIC_TOLGEE_API_URL      e.g. https://j26-tolgee.nihlen.dev
 *   J26_PUBLIC_TOLGEE_PROJECT_ID   e.g. 2
 *   TOLGEE_API_KEY                 a Project API Key (scopes: keys.create +
 *                                  translations.edit) or a Personal Access Token.
 *                                  Falls back to J26_PUBLIC_TOLGEE_API_KEY.
 *
 * Flags:
 *   --dry-run   print what would be sent, make no network calls
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const NAMESPACE = process.env.TOLGEE_NAMESPACE ?? "platsbank";
const dryRun = process.argv.includes("--dry-run");

const apiUrl = (process.env.J26_PUBLIC_TOLGEE_API_URL ?? "").replace(/\/+$/, "");
const projectId = process.env.J26_PUBLIC_TOLGEE_PROJECT_ID ?? "";
const apiKey =
	process.env.TOLGEE_API_KEY ?? process.env.J26_PUBLIC_TOLGEE_API_KEY ?? "";

function fail(message) {
	console.error(`\n✖ ${message}\n`);
	process.exit(1);
}

const checkOnly = process.argv.includes("--check");

if (!apiUrl) fail("Missing J26_PUBLIC_TOLGEE_API_URL.");
if (!projectId) fail("Missing J26_PUBLIC_TOLGEE_PROJECT_ID.");
if (!apiKey && !dryRun)
	fail(
		"Missing TOLGEE_API_KEY (or J26_PUBLIC_TOLGEE_API_KEY). Create a Project API Key\n" +
			"  with scopes 'keys.create' + 'translations.edit', or a Personal Access Token.",
	);
// Catch a placeholder / un-replaced value before spending any request on it.
if (!dryRun && /[<>\s]/.test(apiKey))
	fail(
		`The API key looks like a placeholder (starts with ${JSON.stringify(apiKey.slice(0, 6))}).\n` +
			"  Put a real Tolgee token (tgpak_… Project API Key, or tgpat_… Personal Access Token) in .env.local.",
	);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Turn a fetch Response into a fatal, friendly error for auth/rate-limit cases. */
async function guard(res, where) {
	if (res.status === 401 || res.status === 403) {
		const body = await res.text();
		fail(
			`Auth failed at ${where} — ${res.status} ${body.slice(0, 200)}\n` +
				"  The token is wrong, expired, or lacks access to this project.\n" +
				"  Needs scopes 'keys.create' + 'translations.edit' and access to project " +
				`${projectId}.`,
		);
	}
	if (res.status === 429) {
		let retry = "";
		try {
			retry = ` retryAfter=${JSON.parse(await res.text()).retryAfter}s`;
		} catch {}
		fail(
			`Rate limited at ${where}.${retry}\n` +
				"  Wait for that window to pass, then re-run. (Fix the key first so retries don't extend the limit.)",
		);
	}
}

// Preflight: one authenticated GET so a bad key/project costs 1 request, not 84.
if (!dryRun) {
	const res = await fetch(`${apiUrl}/v2/projects/${projectId}`, {
		headers: { "X-API-Key": apiKey },
	});
	await guard(res, "preflight");
	if (!res.ok) {
		fail(`Preflight failed — ${res.status} ${(await res.text()).slice(0, 200)}`);
	}
	const project = await res.json().catch(() => null);
	console.log(
		`Auth OK → project #${projectId}${project?.name ? ` "${project.name}"` : ""}\n`,
	);
	if (checkOnly) {
		console.log("--check: credentials look good. Re-run without --check to push.");
		process.exit(0);
	}
}

const dataPath = fileURLToPath(new URL("./translations.json", import.meta.url));
/** @type {Record<string, Record<string, string>>} */
const data = JSON.parse(readFileSync(dataPath, "utf8"));
const entries = Object.entries(data);

const endpoint = `${apiUrl}/v2/projects/${projectId}/translations`;
console.log(
	`${dryRun ? "[dry-run] " : ""}Pushing ${entries.length} keys → ${endpoint} (namespace: ${NAMESPACE})\n`,
);

let ok = 0;
const failures = [];

for (const [key, translations] of entries) {
	if (dryRun) {
		console.log(`  • ${key}  ${JSON.stringify(translations)}`);
		ok++;
		continue;
	}
	try {
		const res = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-Key": apiKey,
			},
			body: JSON.stringify({ key, namespace: NAMESPACE, translations }),
		});
		// Stop immediately on auth/rate-limit rather than hammering the API
		// (repeated failures only extend a global rate-limit window).
		await guard(res, `key "${key}"`);
		if (res.ok) {
			ok++;
			console.log(`  ✓ ${key}`);
		} else {
			const body = await res.text();
			failures.push({ key, status: res.status, body });
			console.log(`  ✖ ${key} — ${res.status} ${body.slice(0, 200)}`);
		}
	} catch (err) {
		failures.push({ key, status: 0, body: String(err) });
		console.log(`  ✖ ${key} — ${err}`);
	}
	await sleep(120); // be gentle with the rate limiter
}

console.log(`\nDone. ${ok}/${entries.length} succeeded.`);
if (failures.length > 0) {
	console.error(`${failures.length} failed.`);
	process.exit(1);
}
