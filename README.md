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

Profile avatars upload directly from the browser to a short-lived private
`profile-avatars/` key using a constrained signed request. The finalize
endpoint validates the stored length, content type, and image signature before
saving it as the current avatar. Avatar reads continue to go through
Agentprint's profile avatar endpoint, which applies profile visibility before
redirecting to a short-lived signed object URL. Existing UploadThing avatars
remain readable during the migration window; keep `UPLOADTHING_TOKEN` only
until the backfill described below reports zero legacy objects.

To enable PostHog, set `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and
`NEXT_PUBLIC_POSTHOG_HOST` for the browser, then set the matching
`POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` values for server events and before
running `bun run cli:release` so the public ingestion configuration is compiled
into CLI release binaries. The browser samples 10% of sessions for replay and
records pageviews, web vitals, and exceptions. It masks password, email,
telephone, and device-code inputs; removes URL query strings and fragments; and
never records network bodies, headers, or console logs. DOM
autocapture and heatmaps remain disabled in favor of explicit product events.
Signed-in people use their completed Agentprint handle as both the PostHog
distinct ID and visible username. Temporary pre-onboarding handles are not sent.

Selected authenticated CLI commands whose use is not represented in Agentprint's
database start a detached sender that posts the command name, version, OS, and
architecture directly to PostHog with a protected machine identifier and GeoIP
disabled. Agentprint does not send arguments, raw errors, paths, session content,
or credentials, and telemetry never changes a command's result. Set
`AGENTPRINT_TELEMETRY_DISABLED=1` in the CLI environment to opt out without
affecting collection or sync.

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

GitHub Actions runs the CLI tests and builds the same six release archives on
pull requests and pushes to `main`. Pushing a tag that matches the CLI version,
such as `v0.4.1`, also publishes the archives and checksum manifest to a GitHub
Release. Configure the optional `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST`
repository secrets to compile telemetry into tagged release binaries.

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

Publishing sends the bounded gzip payload directly to a private DigitalOcean
Space, then queues validation and publication with Trigger.dev. The Next.js
request path only handles signed integrity metadata and bounded owner-only
display hints. The owner sees a processing entry immediately; that private view
polls until the worker publishes or rejects the upload. The worker verifies the
reserved byte length and SHA-256 digest, applies decompression and schema
limits, and re-scans every upload before atomically writing transcript content
and marking the upload published. Shares default to unlisted—reachable by link,
never indexed, never listed on a profile—and only appear on a profile once the
owner marks them public. Deleting a share removes the transcript.

Configure `SPACES_ENDPOINT`, `SPACES_BUCKET`, `SPACES_ACCESS_KEY_ID`, and
`SPACES_SECRET_ACCESS_KEY` in both the web deployment and Trigger.dev. Keep the
Space private. Add a Spaces CORS rule that allows only
the production web origin to use `POST`, with `*` under Allowed Headers;
browser avatar uploads need that rule, but the bucket and uploaded objects
remain private. Configure
`TRIGGER_PROJECT_REF`, put `TRIGGER_SECRET_KEY` in the web deployment, and give
the Trigger.dev environment the same `DATABASE_URL` and Spaces values. Deploy
the worker with:

```sh
bun --cwd apps/web trigger:deploy
```

The same private Space has three deliberately separate storage boundaries:

- `session-uploads/` stores private session uploads until processing finishes.
- `profile-avatars/` stores private profile avatars.

Keep file listing restricted. Website images, logos, and release downloads
remain checked into `apps/web/public/` and are served by Vercel.

After the database migrations and Spaces configuration are live, inspect and
backfill any avatars created before this change:

```sh
bun run avatars:migrate:dry-run
bun run avatars:migrate
bun run avatars:migrate:dry-run
```

The migration is retry-safe: it conditionally replaces the database key only
if the avatar has not changed, removes an unused new object after a race, and
reports partial failures. Keep `UPLOADTHING_TOKEN` available to the web app and
the one-off migration command until the final dry run reports zero. Removing
that token later is a separate cleanup step; it does not belong in the initial
rollout.

Upload reservations last 15 minutes. Once finalized, the database and Trigger
run retain the queued job for 24 hours so normal queue delay cannot invalidate a
completed upload. `agentprint share-status <upload-id>` reports queued,
processing, published, and failed outcomes. Admission is capped per account,
per client address, per-account bytes, and by a 5,000-per-hour global circuit breaker;
the worker separately limits execution concurrency to two.

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

Database migrations are an explicit deployment check; the web build never
mutates a database. The `Production release` GitHub workflow uses the
`DATABASE_DIRECT_URL` repository secret with Neon's direct, non-pooled
connection URL, runs pending migrations, and then deploys the Trigger.dev
tasks. Store the Trigger.dev deployment token as `TRIGGER_ACCESS_TOKEN` and set
the `TRIGGER_PROJECT_REF` repository variable. In Vercel, make the workflow's
`Production release` job a required deployment check so a failed migration or
task deployment withholds the production domain. Local development continues
to use `bun run db:migrate`. Applied migration checksums are immutable; make
every schema change in a new, sequentially numbered SQL file.

The database integration suite requires the local PostgreSQL container. Browser
tests exercise desktop and mobile Chromium.

## Privacy boundary

The canonical contract is in
[`packages/contracts/openapi/openapi.yaml`](./packages/contracts/openapi/openapi.yaml).
It rejects unknown fields, so prompt, response, content, repository, and path
fields cannot enter an ingestion batch. Public profile choices are enforced
when the profile payload is built, not only hidden in the browser.

Session sharing is the one path that carries content, and it is deliberately
separate: bounded reservation and finalize endpoints, its own strict contract
(`SessionShare`), its own tables, and an explicit per-session consent step. The
block vocabulary is closed, every field is size-bounded, and the server rejects
anything it does not recognise. `agentprint privacy` prints both boundaries.
