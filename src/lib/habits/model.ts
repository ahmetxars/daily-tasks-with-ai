import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";

export const HABIT_COLORS = [
  "sage",
  "moss",
  "pine",
  "mist",
  "clay",
  "dusk",
  "slate",
  "taupe",
] as const;

export type HabitColor = (typeof HABIT_COLORS)[number];

export type Habit = {
  id: string;
  name: string;
  color: HabitColor;
  createdAt: string;
};

export const HABIT_COLOR_CLASS: Record<HabitColor, string> = {
  sage: "bg-habit-sage",
  moss: "bg-habit-moss",
  pine: "bg-habit-pine",
  mist: "bg-habit-mist",
  clay: "bg-habit-clay",
  dusk: "bg-habit-dusk",
  slate: "bg-habit-slate",
  taupe: "bg-habit-taupe",
};

export const HABIT_COLOR_LABEL: Record<HabitColor, string> = {
  sage: "Sage",
  moss: "Moss",
  pine: "Pine",
  mist: "Mist",
  clay: "Clay",
  dusk: "Dusk",
  slate: "Slate",
  taupe: "Taupe",
};

export function dateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function today(): Date {
  return startOfDay(new Date());
}

export function isFutureDay(date: Date, now = today()): boolean {
  return isAfter(startOfDay(date), now);
}

export function isToday(date: Date, now = today()): boolean {
  return isSameDay(date, now);
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = endOfWeek(anchor, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function monthGrid(anchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function monthLabel(anchor: Date): string {
  return format(anchor, "MMMM yyyy");
}

export function weekdayMed(date: Date): string {
  return format(date, "EEE");
}

export function inSameMonth(date: Date, anchor: Date): boolean {
  return isSameMonth(date, anchor);
}

export function isCheckedOn(
  checks: Record<string, string[]>,
  habitId: string,
  key: string,
): boolean {
  return (checks[habitId] ?? []).includes(key);
}

export type HabitStats = {
  currentStreak: number;
  longestStreak: number;
  last30: { done: number; total: number };
  thisWeek: { done: number; total: number };
  total: number;
};

function sortedUnique(dates: string[]): string[] {
  return [...new Set(dates)].sort();
}

function streakThrough(sortedDescKeys: string[], fromKey: string): number {
  let streak = 0;
  let cursor = fromKey;
  const set = new Set(sortedDescKeys);
  while (set.has(cursor)) {
    streak += 1;
    cursor = dateKey(subDays(parseDateKey(cursor), 1));
  }
  return streak;
}

export function habitStats(
  dates: string[] | undefined,
  now = today(),
): HabitStats {
  const keys = sortedUnique(dates ?? []);
  const total = keys.length;
  const todayKey = dateKey(now);
  const yesterdayKey = dateKey(subDays(now, 1));
  const startFrom = keys.includes(todayKey) ? todayKey : yesterdayKey;
  const currentStreak = streakThrough(keys, startFrom);

  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of keys) {
    if (prev && dateKey(addDays(parseDateKey(prev), 1)) === key) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prev = key;
  }

  const last30Total = 30;
  let last30Done = 0;
  for (let i = 0; i < last30Total; i += 1) {
    const key = dateKey(subDays(now, i));
    if (keys.includes(key)) last30Done += 1;
  }

  const week = weekDays(now);
  let weekDone = 0;
  let weekTotal = 0;
  for (const day of week) {
    if (isFutureDay(day, now)) continue;
    weekTotal += 1;
    if (keys.includes(dateKey(day))) weekDone += 1;
  }

  return {
    currentStreak,
    longestStreak,
    last30: { done: last30Done, total: last30Total },
    thisWeek: { done: weekDone, total: weekTotal },
    total,
  };
}

export function dayCompletion(
  habits: Habit[],
  checks: Record<string, string[]>,
  key: string,
): { done: number; total: number } {
  const total = habits.length;
  let done = 0;
  for (const habit of habits) {
    if (isCheckedOn(checks, habit.id, key)) done += 1;
  }
  return { done, total };
}

function hash01(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function historyFor(habitId: string, rate: number, now: Date): string[] {
  const out: string[] = [];
  const missEvery = 5 + (habitId.length % 4);
  for (let i = 1; i < 56; i += 1) {
    const day = subDays(now, i);
    const key = dateKey(day);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const forcedMiss = i % missEvery === 0;
    if (forcedMiss) continue;
    const threshold = weekend ? rate - 0.18 : rate;
    if (hash01(`${habitId}:${key}`) < threshold) out.push(key);
  }
  for (let i = 1; i <= 3; i += 1) {
    const key = dateKey(subDays(now, i));
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

export type GroveSnapshot = {
  initialized: boolean;
  habits: Habit[];
  checks: Record<string, string[]>;
};

export function createSeed(now = today()): GroveSnapshot {
  const createdAt = now.toISOString();
  const habits: Habit[] = [
    { id: "morning-light", name: "Morning light", color: "sage", createdAt },
    { id: "move", name: "Move the body", color: "moss", createdAt },
    { id: "read", name: "Read a page", color: "mist", createdAt },
    { id: "cook", name: "Cook at home", color: "clay", createdAt },
    { id: "lights-out", name: "Lights out", color: "dusk", createdAt },
  ];

  const rates: Record<string, number> = {
    "morning-light": 0.82,
    move: 0.7,
    read: 0.76,
    cook: 0.62,
    "lights-out": 0.8,
  };

  const checks: Record<string, string[]> = {};
  for (const habit of habits) {
    checks[habit.id] = historyFor(habit.id, rates[habit.id] ?? 0.7, now);
  }

  return { initialized: true, habits, checks };
}

export function formatDayHeading(date: Date, now = today()): string {
  if (isToday(date, now)) return "Today";
  if (isSameDay(date, subDays(now, 1))) return "Yesterday";
  return format(date, "EEEE");
}

export function formatDaySub(date: Date): string {
  return format(date, "MMMM d");
}

export function percent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}
