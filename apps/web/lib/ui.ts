// Shared Tailwind class recipes. Anything reused across more than a couple of
// components lives here so the utility strings stay in one place, while the
// markup keeps using plain Tailwind classes.

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const cn = cx;

const BUTTON_BASE =
  "inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-full border font-semibold leading-none transition-[filter,background-color,border-color] duration-[140ms] hover:brightness-[.94] active:brightness-[.88] disabled:cursor-wait disabled:opacity-55";

const BUTTON_VARIANTS = {
  primary: "border-blue bg-blue text-blue-ink",
  secondary: "border-line-strong bg-transparent text-ink hover:bg-panel-raised",
  signal: "border-signal-strong bg-signal text-ink-strong hover:bg-signal-strong",
  danger: "border-red bg-red text-blue-ink"
} as const;

const BUTTON_SIZES = {
  base: "min-h-12 px-[21px] text-sm",
  small: "min-h-[39px] px-4 text-xs"
} as const;

type ButtonVariant = keyof typeof BUTTON_VARIANTS;
type ButtonSize = keyof typeof BUTTON_SIZES;

export function buttonClass({
  variant = "primary",
  size = "base",
  className
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
}

// A 34px square icon button, used in headers, rows and toolbars.
export const iconButtonClass =
  "inline-grid size-[34px] cursor-pointer place-items-center rounded-sm border border-line bg-transparent p-0 hover:border-line-strong hover:bg-panel";

// Destructive variant: neutral until hover, so a row of them does not shout.
export const iconButtonDangerClass = `${iconButtonClass} hover:border-[color-mix(in_srgb,var(--color-red)_55%,var(--color-line))] hover:text-red`;

// Toggle switch. Render an empty <i className={switchKnobClass} /> as the only child.
export const switchClass =
  "group relative h-6 w-[42px] flex-[0_0_42px] cursor-pointer rounded-full border border-line-strong bg-canvas-deep p-0 transition-[background-color,border-color] duration-[160ms] hover:border-steel-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55 aria-checked:border-accent aria-checked:bg-accent";

export const switchKnobClass =
  "absolute left-0.5 top-0.5 size-[18px] rounded-full border border-line-strong bg-panel-raised transition-[transform,border-color] duration-[160ms] group-aria-checked:translate-x-[18px] group-aria-checked:border-accent";

// Small muted label that sits above a heading.
export const eyebrowClass = "text-xs font-bold leading-none text-muted";

// Inline form-level error copy.
export const formErrorClass = "mb-3.5 text-xs text-red";

// Full-height application page body, below the fixed header.
export const appMainClass =
  "min-h-[calc(100vh-var(--header-h))] bg-transparent pb-[var(--page-bottom)] pt-[var(--page-top)]";

// Low-emphasis inline action, used in dense rows where a filled button would shout.
export const quietActionClass =
  "inline-flex min-h-[35px] cursor-pointer items-center justify-center gap-[5px] border-0 bg-transparent px-2.5 text-xs text-muted transition-[color,background-color] duration-[130ms] hover:bg-canvas-deep hover:text-ink-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:cursor-wait disabled:opacity-50";

// Inline busy indicator that inherits the surrounding text colour.
export const spinnerClass =
  "size-[13px] rounded-full border-2 border-[color-mix(in_srgb,currentColor_25%,transparent)] border-t-current animate-[friend-spin_650ms_linear_infinite]";

// Initials chip used wherever a person is named in a dense row.
const AVATAR_CHIP_BASE =
  "grid place-items-center rounded-sm border border-steel-2 bg-accent-soft font-bold text-blue";

export function avatarChipClass(compact = false) {
  return cx(
    AVATAR_CHIP_BASE,
    compact
      ? "size-[31px] flex-[0_0_31px] text-2xs"
      : "size-[38px] flex-[0_0_38px] text-xs"
  );
}

// Model distribution chart, shared by the profile page and settings.
export const modelChart = {
  root: "grid grid-flow-col auto-cols-[minmax(78px,1fr)] overflow-x-auto rounded-sm border border-line bg-panel px-4 pb-3.5 pt-[18px] [scrollbar-width:thin] max-tablet:auto-cols-[minmax(68px,1fr)] max-tablet:px-3 max-tablet:pb-3 max-tablet:pt-3.5",
  column:
    "group grid min-w-0 grid-rows-[auto_150px_auto_auto] content-start justify-items-center gap-2 max-tablet:grid-rows-[auto_110px_auto_auto]",
  value: "text-xs font-semibold text-ink-strong [font-variant-numeric:tabular-nums]",
  barWrap:
    "flex h-[150px] w-full items-end border-b border-line-strong px-[27%] max-tablet:h-[110px] max-tablet:px-[20%]",
  bar: "block w-full rounded-t-[4px] transition-opacity duration-150 group-hover:opacity-[.82]",
  mark: "grid size-[26px] place-items-center rounded-full border border-line bg-canvas",
  markImage: "size-[15px] object-contain",
  markDot: "size-[9px] rounded-full",
  name: "w-full px-[5px] text-center text-xs leading-[1.35] text-muted [overflow-wrap:anywhere]"
} as const;

// Section heading used above profile breakdowns.
export const sectionHeading = {
  root: "mb-7 flex items-end justify-between gap-7",
  title: "mt-[7px] text-2xl font-medium tracking-[-.025em] text-ink-strong",
  meta: "text-xs font-medium text-faint"
} as const;

// Circular initials avatar on a profile header.
export const profileAvatarClass =
  "grid size-[76px] place-items-center rounded-full border border-line-strong bg-transparent text-lg font-semibold text-blue";

// @handle line under a profile name.
export const handleClass = "mb-[5px] mt-[7px] text-xs font-medium text-blue";
