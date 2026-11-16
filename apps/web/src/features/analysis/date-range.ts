export const ANALYSIS_PRESETS = ['currentMonth', 'previousMonth', 'currentYear', 'previousYear', 'custom'] as const;
export type AnalysisPreset = (typeof ANALYSIS_PRESETS)[number];

const DAY_MS = 86_400_000;

export function shanghaiToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function previousMonthRange(today: string): [string, string] {
  const end = shiftDay(monthStart(today), -1);
  return [monthStart(end), end];
}

export function defaultAnalysisRange(today = shanghaiToday()): [string, string] {
  return [monthStart(today), today];
}

export function rangeForPreset(preset: AnalysisPreset, today = shanghaiToday()): [string, string] | null {
  if (preset === 'currentMonth') return defaultAnalysisRange(today);
  if (preset === 'previousMonth') return previousMonthRange(today);
  if (preset === 'currentYear') return [`${today.slice(0, 4)}-01-01`, today];
  if (preset === 'previousYear') {
    const year = Number(today.slice(0, 4)) - 1;
    return [`${year}-01-01`, `${year}-12-31`];
  }
  return null;
}

export function isAnalysisPreset(value: string | null): value is AnalysisPreset {
  return ANALYSIS_PRESETS.some((preset) => preset === value);
}

export function rangePreset(fromDay: string, toDay: string, today = shanghaiToday()): AnalysisPreset {
  for (const preset of ANALYSIS_PRESETS.slice(0, -1)) {
    const range = rangeForPreset(preset, today);
    if (range?.[0] === fromDay && range[1] === toDay) return preset;
  }
  return 'custom';
}
