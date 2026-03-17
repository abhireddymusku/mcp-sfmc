# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] — 2026-03-16

### Added

- **Auto-pagination helper** (`src/lib/paginate.ts`): `paginate()` async generator that auto-paginates any list function, yielding individual items across all pages. Exported from `sdk.ts`.
- **CLI mode** (`src/cli.ts`): Run `mcp-sfmc --list-journeys`, `--get-journey <id>`, `--search-content`, `--get-content <id>`, `--get-content-by-name <name>`, `--list-automations`, `--list-sends`, `--list-data-extensions`, `--list-business-units`, and `--help` directly from the terminal. CLI mode is auto-detected when stdin is a TTY or CLI flags are present.
- **Response caching** (`src/lib/cache.ts`): `TtlCache` class for TTL-based in-memory caching. Pass `cacheTtlSeconds` to `createClient()` to cache all method results.
- **Zod validation** (`src/lib/schemas.ts`): All tool inputs now validated with zod schemas. Invalid inputs surface descriptive errors automatically. `zod@^3.24.0` added as a dependency.
- **Dispatch layer tests** (`src/lib/dispatch.test.ts`): 20 new tests covering all major tool domains (journeys, content, sends, data extensions, automations, campaigns, SMS, push). Uses `node:test` with mock fetch — zero additional test dependencies.
- **Journey search by name**: `listJourneys` now accepts `search?: string` parameter for name filtering. Tool definition and SDK updated accordingly.
- **TypeDoc** configuration (`typedoc.json`): `npm run docs` generates Markdown API docs from `src/sdk.ts`. `docs/` added to `.gitignore`.
- **Deno/Bun support** (`deno.json`): `./sdk` export now includes `deno` and `bun` conditions alongside `import`. Example `deno.json` provided.
- **Journey version diff** (`diffJourneyVersions`): New `sfmc_diff_journey_versions` tool and SDK method compares two journey versions — activities added/removed/changed, email asset swaps, and sequence reordering. `JourneyDiff` type exported from SDK.
- **OpenTelemetry tracing** (`src/lib/otel.ts`): Minimal OTel-compatible tracing wrapper. Pass any OTel-compatible `tracer` to `createClient()` options to trace all SDK calls. Uses structural typing — no `@opentelemetry/api` dependency required. `Tracer` and `Span` types exported from SDK.

## [0.1.0] — 2026-03-16

### Added

- **40 read-only tools** across 14 SFMC API domains: Content Builder, Journey Builder, Send Performance, Data Extensions, Automation Studio, Campaigns, Transactional Messaging, SMS, Push, Seed Lists, Deliverability, Contacts, Platform, Business Units
- **Multi-BU support**: `sfmc_set_bu` switches the active BU mid-session; `sfmc_get_current_bu` shows the current scope. No restart required to switch between business units.
- **Folder browsing**: `sfmc_get_folder` and `sfmc_list_content_by_folder` for Content Builder navigation
- **Journey performance rates**: `sfmc_get_journey_stats` now includes computed `openRate`, `clickRate`, and `bounceRate` alongside raw counts for each email activity
- **Rate limit visibility**: server logs retry attempts and wait times to stderr when SFMC returns 429; exhausted retries surface a clear error to Claude instead of returning empty data
- **Exponential backoff**: automatic retry on 429 (up to 3 attempts), honours `Retry-After` header
- **HTML slot resolution**: `sfmc_get_content` and `sfmc_get_content_by_name` fully resolve template-based email slot/block structures
- **Unit tests**: 14 tests for the HTML resolution logic via `node:test` (zero extra dependencies)
- CI/CD: GitHub Actions workflows for build+test on PR and npm publish on `v*` tags

### Security

- All tools are read-only — no SFMC data is created, modified, or deleted
- Subscriber-level PII (DE row data, individual subscriber records) is never returned

### Changed

- Errors from SFMC API calls now surface to Claude with descriptive messages instead of silently returning empty results
