<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/agentprint-lockup-dark.svg">
    <img src="apps/web/public/brand/agentprint-lockup.svg" width="320" alt="Agentprint">
  </picture>
</p>

Agentprint is a private-by-default proof-of-work profile for developers who
build with AI agents.

The web app includes GitHub and Google sign-in, device-code authentication, a
responsive public profile and accessible contribution field, per-metric privacy
controls, device revocation, JSON export, deletion, and embeddable SVG cards.
The native Go collector discovers Codex, Claude Code, OpenCode, and Kimi Code, normalizes
numeric usage metadata into a local SQLite queue, and syncs idempotent batches.

## Local setup

Requirements: Bun 1.3+, Node 24+, Go 1.25+, Docker, and PostgreSQL client tools.

```sh
cp .env.example .env
docker-compose up -d postgres
bun install
bun run db:migrate
bun run db:seed
bun run dev
```

For GitHub sign-in, create a GitHub OAuth app with the callback URL
`http://localhost:3000/api/auth/github/callback`, then set `GITHUB_CLIENT_ID`
and `GITHUB_CLIENT_SECRET` in `.env`. For Google, create a Web application OAuth
client with `http://localhost:3000/api/auth/google/callback` as an authorized
redirect URI, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Use your
deployed origin for both callback URLs outside local development.

To enable PostHog, set `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and
`NEXT_PUBLIC_POSTHOG_HOST` for the browser, then set the matching
`POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` values for server events. The browser
records full-site session replay, pageviews, web vitals, and exceptions. It masks
password, email, telephone, and device-code inputs; removes URL query strings and
fragments; and never records network bodies, headers, or console logs. DOM
autocapture and heatmaps remain disabled in favor of explicit product events.
Signed-in people use their completed Agentprint handle as both the PostHog
distinct ID and visible username. Temporary pre-onboarding handles are not sent.

Authenticated CLI commands send only command name, success, duration, version,
OS, architecture, and a closed error category through Agentprint's API. Raw
arguments, errors, paths, session content, and credentials are never telemetry
properties. Set `AGENTPRINT_TELEMETRY_DISABLED=1` in the CLI environment to opt
out without affecting collection or sync.

Open [http://localhost:3000](http://localhost:3000). The seeded public profile
is available at `/maya-builds`.

## Collector

```sh
bun run cli:build
./cli/agentprint privacy
./cli/agentprint sources
./cli/agentprint login --server http://localhost:3000
```

Build local release archives for macOS, Linux, and Windows:

```sh
bun run cli:release
```

The onboarding installer then downloads them from
`apps/web/public/releases/latest`.

## Session sharing

Background collection never uploads transcript content. Sharing is a separate
pipeline: it publishes one session at a time, only when asked.

```sh
agentprint sessions                 # list local sessions across harnesses
agentprint share --dry-run          # render the exact payload locally, upload nothing
agentprint share <id> --redact strict --visibility public
agentprint shares                   # list what you have published
agentprint unshare <id>             # delete a transcript and break its link
```

Before upload the collector rewrites the transcript on the machine that owns
it: credential shapes become visible `[redacted:...]` markers, the home
directory becomes `~`, the project path becomes `<project>`, images are
dropped, and long tool output is truncated. `--redact strict` additionally
omits tool arguments, tool output, and agent reasoning. The dry run writes a
local HTML preview so the payload can be read before any network call, and the
interactive publish shows the same preview before asking for confirmation.

The server re-scans every upload and refuses one that still contains an
apparent live credential. Shares default to unlisted—reachable by link, never
indexed, never listed on a profile—and only appear on a profile once the owner
marks them public. Deleting a share removes the transcript.

Session readers exist for Claude Code, Codex, and Kimi Code. OpenCode is not
yet supported: recent versions moved message storage into `opencode.db`, so it
needs its own reader.

Existing installations check for a new release at most once per day and offer
to install it before interactive commands. Users can also update immediately:

```sh
agentprint update
```

Use `agentprint update --check` to check without installing or set
`AGENTPRINT_NO_UPDATE_CHECK=1` to disable automatic checks. Release downloads
are verified against the SHA-256 checksums in `releases/latest/manifest.json`
before the current executable is replaced. Login credentials, configuration,
and queued usage records are preserved.

## Verification

```sh
bun run typecheck
bun run lint
bun test packages
bun run test:go
bun run test:e2e
bun run build
```

The database integration suite requires the local PostgreSQL container. Browser
tests exercise desktop and mobile Chromium.

## Privacy boundary

The canonical contract is in
[`packages/contracts/openapi/openapi.yaml`](./packages/contracts/openapi/openapi.yaml).
It rejects unknown fields, so prompt, response, content, repository, and path
fields cannot enter an ingestion batch. Public profile choices are enforced
when the profile payload is built, not only hidden in the browser.

Session sharing is the one path that carries content, and it is deliberately
separate: its own endpoint (`POST /v1/me/shares`), its own strict contract
(`SessionShare`), its own tables, and an explicit per-session consent step. The
block vocabulary is closed, every field is size-bounded, and the server rejects
anything it does not recognise. `agentprint privacy` prints both boundaries.
