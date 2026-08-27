# Repository guidance

## Interface typography

- Do not style interface copy in all caps.
- Do not use `text-transform: uppercase` or decorative letter spacing for labels, eyebrows, statuses, buttons, navigation, metrics, or supporting text.
- Write UI copy in natural sentence case with normal tracking.
- Preserve uppercase only when it is semantically required, such as an acronym, initialism, timezone, activation code, or protocol name.
- Use Tailwind's named typography utilities such as `font-medium`, `font-semibold`, `font-bold`, `text-xs`, `text-sm`, `text-base`, `text-lg`, and the named display-size scale.
- Do not use arbitrary numeric font weights such as `font-[weight:560]` or arbitrary numeric text sizes such as `text-[22px]` and `text-[clamp(...)]`.
- Use responsive variants of the named text-size utilities when typography must change by viewport.

## User-facing copy

- This rule applies to every user-facing surface, including website pages, product UI, onboarding, settings, privacy and security pages, CLI help, prompts, progress messages, success messages, warnings, and errors.
- Never expose internal implementation details, technical architecture, infrastructure, or engineering terminology in user-facing copy.
- Never name or describe internal vendors, services, storage systems, databases, queues, workers, servers, hosts, origins, deployment systems, protocols, schemas, endpoints, processing pipelines, lifecycle mechanisms, or similar implementation choices.
- Privacy and security copy must explain the user's choices, protections, consequences, and controls without explaining the technical mechanism used to provide them.
- CLI copy must explain only what the user can do, what happened, and how to recover. Literal commands, flags, and values that the user must enter may be shown, but their internal implementation must not be described.
- Translate every internal behavior into a direct user outcome. If a detail does not help the user decide, act, understand the result, or recover from a problem, omit it.
- Keep technical details in developer documentation, source code, code comments, tests, and internal diagnostics that are not shown to users.
- Write in short, plain, friendly language. Do not use developer shorthand or implementation notes.
- Do not state behavior that is already obvious from the interface. Supporting copy must add useful context, confidence, or motivation.
- When the user supplies exact copy or approved legal language, preserve it as requested.

## Component reuse

- Before building a custom interface component, check whether the repository already has a suitable component or pattern.
- Prefer reusing and composing components from shadcn/ui and AI SDK Elements when they fit the product requirement.
- Extend an existing component at its intended customization points instead of recreating its behavior, accessibility, or interaction states from scratch.
- Build a custom component only when the existing project components, shadcn/ui, and AI SDK Elements do not adequately support the required experience.
