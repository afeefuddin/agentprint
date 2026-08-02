export type DailyTotal = {
  localDate: string;
  totalTokens: number;
};

export function calculateStreaks(days: DailyTotal[], today: string) {
  const activeDates = [...new Set(
    days.filter((day) => day.totalTokens > 0).map((day) => day.localDate)
  )].sort();

  let longest = 0;
  let run = 0;
  let previous: Date | undefined;

  for (const value of activeDates) {
    const current = new Date(`${value}T00:00:00Z`);
    const delta = previous ? (current.getTime() - previous.getTime()) / 86_400_000 : 1;
    run = delta === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = current;
  }

  let current = 0;
  if (activeDates.length) {
    const last = activeDates.at(-1)!;
    const todayDate = new Date(`${today}T00:00:00Z`);
    const lastDate = new Date(`${last}T00:00:00Z`);
    const age = (todayDate.getTime() - lastDate.getTime()) / 86_400_000;
    if (age <= 1 && age >= 0) {
      current = 1;
      for (let index = activeDates.length - 1; index > 0; index -= 1) {
        const later = new Date(`${activeDates[index]}T00:00:00Z`);
        const earlier = new Date(`${activeDates[index - 1]}T00:00:00Z`);
        if ((later.getTime() - earlier.getTime()) / 86_400_000 !== 1) break;
        current += 1;
      }
    }
  }

  return { current, longest };
}

export function intensityThresholds(values: number[]) {
  const positive = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!positive.length) return [0, 0, 0, 0] as const;
  const quantile = (percent: number) =>
    positive[Math.min(positive.length - 1, Math.floor((positive.length - 1) * percent))];
  return [quantile(0.2), quantile(0.45), quantile(0.7), quantile(0.9)] as const;
}

export function intensityFor(value: number, thresholds: readonly number[]) {
  if (value <= 0) return 0;
  for (let index = 0; index < thresholds.length; index += 1) {
    if (value <= thresholds[index]) return index + 1;
  }
  return thresholds.length;
}

export function formatTokens(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
