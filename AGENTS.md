# Repository guidance

## Interface typography

- Do not style interface copy in all caps.
- Do not use `text-transform: uppercase` or decorative letter spacing for labels, eyebrows, statuses, buttons, navigation, metrics, or supporting text.
- Write UI copy in natural sentence case with normal tracking.
- Preserve uppercase only when it is semantically required, such as an acronym, initialism, timezone, activation code, or protocol name.
- Use Tailwind's named typography utilities such as `font-medium`, `font-semibold`, `font-bold`, `text-xs`, `text-sm`, `text-base`, `text-lg`, and the named display-size scale.
- Do not use arbitrary numeric font weights such as `font-[weight:560]` or arbitrary numeric text sizes such as `text-[22px]` and `text-[clamp(...)]`.
- Use responsive variants of the named text-size utilities when typography must change by viewport.

## Website copy

- Write customer-facing copy in plain, friendly language that explains the product value or the outcome for the user.
- Lead with what the user can do, gain, or understand. Do not expose internal implementation details as marketing or supporting copy.
- Avoid infrastructure terms such as cloud, host, server, origin, deployment, or protocol unless the user genuinely needs that detail to complete the task.
- Do not state behavior that is obvious from the interface. Supporting copy must add useful context, confidence, or motivation.
- Prefer short, natural sentences over technical explanations, developer shorthand, or implementation notes.
- When the user supplies exact copy or approved legal language, preserve it as requested.

## Component reuse

- Before building a custom interface component, check whether the repository already has a suitable component or pattern.
- Prefer reusing and composing components from shadcn/ui and AI SDK Elements when they fit the product requirement.
- Extend an existing component at its intended customization points instead of recreating its behavior, accessibility, or interaction states from scratch.
- Build a custom component only when the existing project components, shadcn/ui, and AI SDK Elements do not adequately support the required experience.
