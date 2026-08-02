<p align="center">
  <img src="apps/web/public/brand/agentprint-lockup.svg" width="320" alt="Agentprint" />
</p>

Agentprint is a private-by-default proof-of-work profile for developers who
build with AI agents. This repository is a clean implementation of
[`PRODUCT_PLAN.md`](./PRODUCT_PLAN.md).

The web app includes GitHub and Google sign-in, device-code authentication, a
responsive public profile and accessible contribution field, per-metric privacy
controls, device revocation, JSON export, deletion, and embeddable SVG cards.
The native Go collector discovers Codex, Claude Code, and OpenCode, normalizes
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
