# Agentprint — Product and Technical Plan

## 1. Product definition

Agentprint is a public proof-of-work profile for developers who build with
AI agents.

A user installs one small local agent. It discovers supported coding harnesses,
reads their local usage records, normalizes token usage, and periodically syncs
privacy-safe aggregates. The platform turns that activity into a combined,
GitHub-style contribution field that can be shared as part of the user's
developer identity.

The product should answer three questions quickly:

1. How consistently does this person work with agents?
2. How much agent activity have they accumulated?
3. Which harnesses and models make up that activity?

It is not an employee-monitoring tool, a prompt archive, or a leaderboard of
who can spend the most money.

## 2. Product principles

- **Install once, then disappear.** Normal use should not require manually
  running sync commands.
- **Metadata only by default.** Never upload prompts, responses, file contents,
  repository names, paths, or secrets.
- **Honest numbers.** Tokens, estimated cost, and active time are different
  measurements and must stay visibly distinct.
- **Local-first resilience.** Usage is collected and queued offline before it is
  synced.
- **Public by choice.** A profile starts private; the user explicitly chooses
  what becomes public.
- **Calm status, not gamified noise.** The profile should feel credible enough
  to put next to a GitHub or personal-site link.
- **Adapters are isolated.** A harness format change should affect one adapter,
  not the collector or API.

## 3. Scope

### MVP

- GitHub or Google sign-in, followed by profile name and handle selection.
- Device-code authentication for the CLI.
- First-class macOS, Linux, and Windows support.
- Codex, Claude Code, and OpenCode adapters.
- Automatic local discovery and periodic sync.
- Offline queue and cursor-based incremental collection.
- Combined daily heatmap for the trailing 12 months.
- Harness and model filters.
- Public/private profile controls.
- Summary metrics: total tokens, estimated spend, active days, current streak,
  longest streak, and most-used harness.
- A shareable profile URL and embeddable SVG card.
- Data export and device revocation.

### Immediately after MVP

- More harness adapters.
- Teams and organization pages.
- Weekly/monthly comparison views.
- Signed profile badges.
- Import/backfill controls.
- Optional repository attribution using local one-way aliases, never raw paths.

### Explicitly out of scope for MVP

- Prompt or response storage.
- Source-code collection.
- Employer productivity scoring.
- Global “highest spender” leaderboard.
- Social feed, comments, reactions, or follows.
- Exact dollar claims when provider/model pricing cannot be established.
- Mobile app.

## 4. Measurement model

### Canonical usage record

Each source record is normalized locally into:

```text
UsageRecord
  event_id             stable hash for idempotency
  schema_version
  occurred_at          UTC timestamp
  local_date           date in the user's configured timezone
  harness_id
  harness_version?     optional
  provider_id?
  model_id?
  input_tokens
  output_tokens
  cached_input_tokens?
  reasoning_tokens?
  total_tokens
  estimated_cost_micros?
  cost_basis?          reported | price-table | unavailable
  source_fingerprint   anonymous installation/source identity
```

No text content enters this schema.

### Public metrics

- **Total tokens:** input + output + separately reported token categories,
  following a documented formula.
- **Estimated spend:** shown only where reported by the harness or calculated
  from a versioned price table. Always labeled “estimated” unless the provider
  reports it directly.
- **Active day:** a local calendar day containing at least one accepted usage
  record.
- **Streak:** consecutive active local dates. Recomputed if the user changes
  timezone.
- **Intensity:** based on a user's own trailing distribution, not a single
  global token threshold. This keeps the heatmap readable for both light and
  heavy users.

The heatmap tooltip should show exact values. Color intensity should never be
the only way to retrieve the number.

### Why aggregation happens twice

The local agent preserves normalized event-level metadata in its short-lived
queue so retries are reliable. The server stores immutable normalized usage
events for correction/audit and maintains daily aggregates for fast profile
reads. Raw uploaded usage events can be expired after a configurable retention
window once aggregates are verified.

## 5. CLI and background agent

### Recommended implementation

Build the collector in **Go**:

- Single native binary with low idle memory.
- Straightforward cross-compilation.
- Good filesystem, SQLite, scheduling, and OS-service support.
- No Node/Python runtime required on the user's machine.

Call the binary `agentprint` for now. The name and command can be changed
without changing the internal architecture.

### User experience

macOS/Linux:

```sh
curl -fsSL https://agentprint.dev/install.sh | sh
agentprint login
agentprint status
```

Windows:

```powershell
irm https://agentprint.dev/install.ps1 | iex
agentprint login
agentprint status
```

`login` starts a device-code flow in the browser, registers the machine, runs
adapter discovery, performs an initial backfill, and installs the background
service after showing exactly which metadata will be uploaded.

Normal operation then requires no command.

Useful commands:

```text
agentprint status            health, last sync, detected harnesses
agentprint sync              request an immediate sync
agentprint sources           detected adapters and permissions
agentprint privacy           exact fields collected and excluded
agentprint doctor            diagnostics with secret-safe output
agentprint pause             pause background collection
agentprint resume
agentprint logout            revoke local credentials
agentprint uninstall         remove service and local state
```

### Service lifecycle

- macOS: LaunchAgent.
- Linux: user-level systemd service, with a cron fallback only where needed.
- Windows: native per-user background service.
- Wake every few minutes, and also react to relevant filesystem changes where
  reliable.
- Use bounded exponential backoff with jitter.
- Keep a small SQLite database for source cursors, dedupe keys, queued records,
  sync attempts, and agent configuration.
- Encrypt the refresh credential with the OS keychain/keyring. Never place it in
  shell configuration.
- Auto-update only from signed releases, with an opt-out and a pinned channel.

### Adapter contract

Each adapter is a package behind the same interface:

```text
Adapter
  ID() string
  Detect(context) DetectionResult
  Validate(context) HealthResult
  Collect(context, Cursor) Batch<UsageRecord, Cursor>
  Capabilities() CapabilitySet
```

Rules:

- Read-only access to harness-owned files or local APIs.
- The adapter owns format/version detection and token-field mapping.
- The cursor advances only after records are durably queued.
- `event_id` is deterministic across retries.
- Corrupt and unknown records are quarantined locally, not silently discarded.
- Missing token categories remain unknown; they are never guessed.
- Fixture-based contract tests cover every supported harness version.
- An adapter can be disabled remotely for a known-bad version, but collection
  data remains local and recoverable.

### Adapter development sequence

For every harness:

1. Document the authoritative local source and its version behavior.
2. Capture synthetic, redacted fixtures.
3. Map every available token category.
4. Define a stable source record identity.
5. Implement incremental reads and rotation/truncation recovery.
6. Test duplicated files, partial writes, clock changes, malformed records,
   upgrades, and backfills.
7. Compare adapter totals with the harness's own UI on controlled sessions.

## 6. Platform architecture

### Recommended stack

- **Web:** Next.js + React + TypeScript.
- **API:** TypeScript service with a small HTTP framework and generated OpenAPI
  contracts.
- **Database:** PostgreSQL.
- **Queue/jobs:** PostgreSQL-backed jobs initially; add dedicated queue
  infrastructure only when measured load requires it.
- **Caching:** CDN caching for public profiles; no Redis requirement for MVP.
- **Object storage:** release artifacts and generated share cards.
- **Auth:** GitHub and Google OAuth for the web; OAuth device flow for
  the CLI.
- **Observability:** structured logs, traces, error reporting, and explicit sync
  health metrics.

Use a TypeScript monorepo for the platform and a sibling Go module for the
collector:

```text
apps/
  web/                 public profiles and signed-in dashboard
  api/                 ingestion and account API
packages/
  contracts/           OpenAPI/JSON Schema source
  database/            schema, migrations, queries
  design-system/       tokens and reusable UI
  analytics/           aggregation and streak rules
cli/
  cmd/agentprint/
  internal/adapters/
  internal/collector/
  internal/service/
  internal/store/
  internal/sync/
```

The API contract is generated from language-neutral OpenAPI/JSON Schema so Go
and TypeScript do not maintain competing handwritten payload definitions.

### Core server tables

```text
users
profiles
devices
device_credentials
harnesses
models
usage_events
daily_usage
sync_batches
price_book_versions
privacy_settings
profile_aliases
```

Important constraints:

- Unique `(user_id, event_id)` on usage events.
- Unique `(device_id, batch_id)` on sync batches.
- Daily aggregates keyed by `(user_id, local_date, harness_id, model_id)`.
- Append-only price-book versions.
- Revoked device credentials cannot ingest.
- Public profile reads never touch credentials or device diagnostics.

### Ingestion flow

```text
Harness files/local API
  -> adapter
  -> normalized local SQLite queue
  -> compressed, signed sync batch
  -> authenticated ingest API
  -> schema and range validation
  -> idempotent usage-event insert
  -> daily aggregate upsert
  -> profile cache invalidation
```

The API returns accepted, duplicate, and rejected record counts plus a stable
acknowledgement. The local queue deletes a record only after acknowledgement.

### Initial API surface

```text
POST /v1/device/code
POST /v1/device/token
POST /v1/devices/register
POST /v1/sync/batches
GET  /v1/sync/batches/:id
GET  /v1/me
GET  /v1/me/devices
DELETE /v1/me/devices/:id
GET  /v1/me/usage
PATCH /v1/me/profile
GET  /v1/profiles/:handle
GET  /v1/profiles/:handle/activity
GET  /v1/profiles/:handle/card.svg
```

## 7. Privacy, trust, and abuse resistance

### Default collection boundary

Collected:

- Timestamp and local date.
- Harness and optional version.
- Provider/model identifiers when present.
- Numeric token categories.
- Reported or estimated numeric cost with provenance.
- Anonymous source/device identity.

Never collected:

- Prompt/response text.
- Source code or file contents.
- File and repository paths.
- Shell history.
- API keys.
- Account credentials from other tools.
- User-entered project or client names.

### User controls

- Private profile by default.
- Independently hide token totals, cost, harness mix, model mix, and streaks.
- Pause collection without uninstalling.
- Revoke a device remotely.
- Export normalized personal data.
- Delete account and server-side data.
- See the last sync and every detected source.

### Trust model

This data originates on a user-controlled machine and cannot be made perfectly
fraud-proof. Do not claim otherwise.

Use signed releases, per-device credentials, server-side sanity limits, batch
signatures, clock-skew checks, idempotency, and anomaly flags. Label the public
profile as “synced from connected tools,” not “verified productivity.” Later,
provider-authorized imports may earn a distinct verification mark.

## 8. Product surfaces

### Public profile

The public page is the primary shareable artifact:

- Compact identity row: avatar, handle, short bio, timezone, joined date.
- One dominant 12-month **Agent Contribution Field**.
- Daily / weekly / cumulative view controls.
- Exact accessible tooltip per day.
- Summary rail: lifetime tokens, estimated spend, active days, current streak,
  longest streak.
- Harness composition below the field, using restrained labels and percentages.
- Optional model breakdown.
- Share/export action.
- “Synced from N connected harnesses” trust note and last-updated time.

### Signed-in dashboard

- Sync health and latest accepted batch.
- Connected devices and detected harnesses.
- Private usage explorer.
- Profile visibility controls.
- Pricing/cost provenance.
- Export and deletion controls.

### Onboarding

1. Sign in.
2. Choose a public handle.
3. Install the local agent.
4. Complete device authentication.
5. Review discovered harnesses and collection boundary.
6. Watch the first backfill arrive.
7. Preview the profile privately.
8. Publish selected metrics.

## 9. Visual direction

### Human and intent

The primary user is a developer finishing an agent-assisted work session,
checking whether their activity synced, and sharing a credible long-term signal
with peers. The page should feel **quiet, precise, earned, and slightly
forensic**—closer to a well-made developer instrument than a social-media
achievement screen.

### Domain exploration

**Domain concepts:** token streams, context windows, agent sessions, tool calls,
model routing, terminal traces, daily cadence, shipping velocity, cumulative
work, and connected harnesses.

**Color world:** near-black terminal glass, graphite hardware, slate log text,
muted steel-blue activity, pale blue “live” events, warm off-white primary
type, and restrained amber only for incomplete/estimated data.

**Signature:** the **Agent Contribution Field**. Each day remains one combined
cell, but its internal hover/focus treatment reveals a thin “trace” showing the
harness composition for that day. At rest it is calm and unified; on inspection
it exposes where the activity came from.

**Defaults rejected:**

- Generic dashboard card grid -> one continuous metric rail attached visually
  to the contribution field.
- Rainbow heatmap per harness -> a unified blue-steel intensity scale; harness
  identity appears in filters and the daily trace.
- Trophy/gamification UI -> precise activity language, provenance, and quiet
  milestones.

### System

- Dark-first, with a fully designed light theme rather than a simple inversion.
- Border-only depth using low-contrast separators; no floating glass cards or
  dramatic shadows.
- Four-point spacing base.
- Technical but readable sans-serif for interface copy; tabular monospace for
  numeric data and tool identifiers.
- Moderately sharp corners: small controls, slightly softer large field shell.
- One blue-steel accent family. Amber is semantic and only means estimated or
  incomplete.
- Motion is limited to fast opacity, focus, tooltip, and filter transitions.
  No bounce, glow pulse, or decorative gradients.
- Mobile preserves the full year through horizontal scrolling with sticky month
  labels; it must not collapse into an unreadable mini-grid.

### Accessibility requirements

- Every cell is keyboard reachable through a roving-tabindex grid.
- Tooltips also appear on focus and have an equivalent text summary.
- Intensity levels meet contrast requirements and are supplemented by exact
  values and an optional patterned high-contrast mode.
- `prefers-reduced-motion` is respected.
- All charts have a table or structured text alternative.
- Public profiles remain useful without client-side JavaScript.

## 10. Quality strategy

### CLI

- Unit tests for normalization, cursors, token arithmetic, and retry behavior.
- Golden fixture tests per adapter and harness version.
- Integration tests with a fake API, offline periods, duplicate batches,
  partial files, log rotation, DST changes, and timezone changes.
- Installer/service tests on clean macOS, Linux, and Windows VMs.
- Signed release and update verification tests.

### Platform

- Contract tests generated from the shared schema.
- Database tests for idempotency and aggregate corrections.
- Property tests for streaks, timezones, and token arithmetic.
- API authorization and rate-limit tests.
- Browser tests for onboarding, profile privacy, device revocation, and profile
  rendering.
- Visual regression tests for the heatmap in light/dark, empty/sparse/dense,
  mobile/desktop, and color-vision-safe modes.
- Load test ingestion separately from public profile reads.

### Release gates

- No prompt/content field can exist in the ingest schema.
- A batch retry cannot change totals.
- A timezone change cannot lose usage.
- An adapter backfill matches controlled harness totals.
- Revoked credentials fail immediately.
- Profile visibility settings are enforced at the query boundary, not only in
  the UI.

## 11. Delivery plan

### Phase 0 — Decisions and evidence (3–5 days)

- Verify the authoritative local usage sources for Codex, Claude Code, and
  OpenCode with controlled sessions on every supported operating system.
- Document which history and token fields are available consistently across
  macOS, Linux, and Windows.
- Decide naming, domain, and initial public metric defaults.
- Produce low-fidelity public-profile and onboarding flows.
- Write the privacy specification and normalized schema.

**Exit:** all three harnesses expose enough stable numeric metadata on the
supported operating systems to support a credible MVP, or a documented
capability matrix defines any unavoidable limitations.

### Phase 1 — Walking skeleton (1 week)

- Web account and device-code flow.
- Go CLI login/status.
- One fake adapter producing synthetic usage.
- SQLite queue -> ingest API -> PostgreSQL -> daily aggregate -> profile field.
- End-to-end deployment and observability.

**Exit:** one synthetic local record appears once, and only once, on a private
profile.

### Phase 2 — Real collection (2–3 weeks)

- Codex, Claude Code, and OpenCode adapters with cross-platform fixture suites.
- Discovery, incremental cursors, initial backfill, retries, and diagnostics.
- LaunchAgent, systemd, and Windows service installation.
- Device management and revocation.
- Cost provenance and price-book versioning.

**Exit:** controlled harness sessions match the platform totals after retries
and restarts.

### Phase 3 — Shareable product (2 weeks)

- Crafted responsive profile.
- Combined contribution field and filters.
- Summary metrics and harness/model breakdown.
- Privacy controls and profile publishing.
- Embeddable SVG card.
- Accessibility and visual regression coverage.

**Exit:** a new user can install, sync, review, publish, and share without
developer help.

### Phase 4 — Private beta hardening (1–2 weeks)

- Signed installers and updater.
- Error recovery and support-safe diagnostics.
- Export/deletion flow.
- Abuse limits and anomaly review.
- Performance and security review.
- Recruit 20–50 users across supported OS/harness combinations.

**Exit:** sync success, correctness, privacy, and retention targets hold during
the beta.

## 12. Initial success metrics

- More than 80% of authenticated installs reach first successful sync.
- Median time from install to visible activity under five minutes.
- More than 95% of healthy devices sync within one hour.
- Duplicate ingestion changes totals in zero test/observed cases.
- Less than 1% adapter parsing failure on supported harness versions.
- At least 30% of activated beta users publish or share a profile.
- Week-four collector retention above 50% for activated beta users.
- Zero content-bearing fields received by the ingestion API.

## 13. Confirmed product decisions

1. **Public name:** Agentprint.
2. **Initial harnesses:** Codex, Claude Code, and OpenCode.
3. **Headline metric:** tokens. Estimated spend remains secondary and is always
   labeled according to its provenance.
4. **Launch platforms:** macOS, Linux, and Windows are first-class targets.

## 14. Remaining implementation defaults

These do not block the walking skeleton and can be changed before public beta:

1. Profiles support both real-name and pseudonymous identities equally.
2. The collector is written in Go for a small, self-contained cross-platform
   binary.
3. Profiles require an explicit publish action after the user previews their
   synced data.
