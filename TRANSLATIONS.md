# Translations (i18n)

The platsbank UI is internationalized with [Tolgee](https://tolgee.io), mirroring
the setup in the `j26-map` app. Languages: **sv, en, uk, nl** (default `sv`). The
active language is read from the `j26-language` cookie set by the shell.

## How it works

- **`src/lib/tolgee.ts`** — the Tolgee instance. Namespace `platsbank`, `FormatIcu`
  (supports `{param}` interpolation *and* ICU plurals), `BackendFetch` for
  production, dev API for local. SSR-safe (guards `document`).
- **`__root.tsx`** wraps the app in `<TolgeeProvider>`.
- Components call `useTranslate("platsbank")` and render text via
  `t("key", "<Swedish default>", params?)`.
- **Swedish is embedded in the code** as the default value of every `t()` call.
  So the app always renders correct Swedish during SSR and first paint, and
  degrades gracefully to Swedish even if Tolgee never loads. Other languages
  overlay once Tolgee data is fetched.

## Status

- ✅ All UI strings go through `t()` (routes, forms, type field, auth layout).
- ✅ 84 keys pushed to Tolgee project (namespace `platsbank`) with `sv` + `en`.
- ⏳ Remaining work below.

## What's left to get en / uk / nl showing in the app

1. **Auto-translate `uk` / `nl` in Tolgee.** Only `sv` + `en` were uploaded. In
   the Tolgee project, open the `platsbank` namespace and run batch
   **Auto-translate** for Ukrainian and Dutch (or confirm auto-translation on new
   keys is enabled).
2. **Review the machine output.** Spot-check the English and the machine `uk`/`nl`,
   especially domain terms (`type.staff` = "Funktionär" → "Staff",
   `type.leader` → "Leader").
3. **Make the app load the translations:**
   - **Local dev (quickest):** set `J26_PUBLIC_TOLGEE_API_KEY` in `.env.local`.
     Tolgee then runs in dev mode and fetches live from the API — no publishing
     needed, and you get in-context editing (alt-click a string). ⚠️ This key is
     bundled into the client, so use a low-scope/read key here, not your write
     token.
   - **Deployed / production:** the app reads a static export from
     `J26_PUBLIC_TOLGEE_BACKEND_FETCH_PREFIX`. Pushing keys does **not** update
     that export. In Tolgee → **Content Delivery (CDN)**: publish (or enable
     auto-publish), make sure the export **includes the `platsbank` namespace**
     (if it's shared with the map app it may be filtered to `map` only), and point
     `J26_PUBLIC_TOLGEE_BACKEND_FETCH_PREFIX` at that export URL.
4. **Verify.** Run `pnpm dev`, set the `j26-language` cookie to `en` (or `uk`/`nl`),
   reload, and confirm the UI switches. In Tolgee, the `platsbank` namespace should
   show 84 keys with `sv` + `en` filled.

> **Most likely gotcha:** the namespace filter on the Content Delivery export. If
> platsbank shares a Tolgee project with the map app and the export only serves the
> `map` namespace, the deployed platsbank silently falls back to Swedish-only.

## Environment variables

Add these to `.env.local` (see `.env.local.template`). The `J26_PUBLIC_` prefix
means the value is exposed to the client bundle (see `envPrefix` in
`vite.config.ts`).

| Variable | Scope | Purpose |
|---|---|---|
| `J26_PUBLIC_TOLGEE_BACKEND_FETCH_PREFIX` | client | Static translation export URL used in production. |
| `J26_PUBLIC_TOLGEE_API_URL` | client | Tolgee instance URL (dev live fetch + push script). |
| `J26_PUBLIC_TOLGEE_PROJECT_ID` | client | Tolgee project id. |
| `J26_PUBLIC_TOLGEE_API_KEY` | client | Optional. Enables dev-mode live fetch + in-context editing. Bundled to client — use a low-scope key. |
| `TOLGEE_API_KEY` | server | Write token for the push script (preferred over the public key). Never bundled. |

## Uploading strings to Tolgee

The importer upserts every key with its `sv` + `en` values. It only sets those two
languages, so machine-translated `uk`/`nl` are left untouched. Safe to re-run.

```bash
pnpm tolgee:push --dry-run   # print all 84 keys, no network
pnpm tolgee:push --check     # validate credentials only (1 request)
pnpm tolgee:push             # upload sv + en
```

Requires `J26_PUBLIC_TOLGEE_API_URL`, `J26_PUBLIC_TOLGEE_PROJECT_ID`, and a write
token in `TOLGEE_API_KEY` (a Project API Key with scopes `keys.create` +
`translations.edit`, or a Personal Access Token).

## Adding or changing a string

1. In the component, use `t("section.key", "Svensk text", params?)`.
2. Add the same key to **`scripts/translations.json`** with `sv` + `en`.
3. Run `pnpm tolgee:push`.

`scripts/translations.json` and the `t()` calls must stay in sync — the Swedish in
the JSON should match the in-code default.

## First-time local setup (e.g. on another machine)

```bash
cp .env.local.template .env.local   # then fill in the values
pnpm install
pnpm dev                            # http://localhost:3000
```

The app runs in Swedish out of the box. To see other languages in dev, set
`J26_PUBLIC_TOLGEE_API_KEY` (see the table above). Local dev also needs
`DATABASE_URL` (Postgres via `docker-compose up`) and `KEYCLOAK_DISCOVERY_URL`.
