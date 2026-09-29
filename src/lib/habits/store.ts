import { create } from "zustand";
import { useSyncExternalStore } from "react";
import {
  createSeed,
  isFutureDay,
  parseDateKey,
  type GroveSnapshot,
  type Habit,
  type HabitColor,
} from "./model";

type HabitStore = GroveSnapshot & {
  addHabit: (input: { name: string; color: HabitColor }) => void;
  updateHabit: (id: string, patch: { name?: string; color?: HabitColor }) => void;
  deleteHabit: (id: string) => void;
  toggleCheck: (habitId: string, key: string) => void;
};

const STORAGE_KEY = "grove-habits-v1";

const empty: GroveSnapshot = {
  initialized: false,
  habits: [],
  checks: {},
};

function readSnapshot(): GroveSnapshot {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeed();
    const parsed = JSON.parse(raw) as Partial<GroveSnapshot>;
    if (!parsed.initialized && (!parsed.habits || parsed.habits.length === 0)) {
      return createSeed();
    }
    return {
      initialized: true,
      habits: Array.isArray(parsed.habits) ? parsed.habits : [],
      checks: parsed.checks && typeof parsed.checks === "object" ? parsed.checks : {},
    };
  } catch {
    return createSeed();
  }
}

function writeSnapshot(state: GroveSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        initialized: state.initialized,
        habits: state.habits,
        checks: state.checks,
      }),
    );
  } catch {
    // Private mode or full quota — keep the session in memory.
  }
}

export const useHabitStore = create<HabitStore>((set, get) => ({
  ...empty,
  addHabit: ({ name, color }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const habit: Habit = {
      id: crypto.randomUUID(),
      name: trimmed.slice(0, 40),
      color,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      initialized: true,
      habits: [...state.habits, habit],
    }));
  },
  updateHabit: (id, patch) => {
    set((state) => ({
      habits: state.habits.map((habit) => {
        if (habit.id !== id) return habit;
        const name = patch.name?.trim().slice(0, 40);
        return {
          ...habit,
          name: name || habit.name,
          color: patch.color ?? habit.color,
        };
      }),
    }));
  },
  deleteHabit: (id) => {
    set((state) => {
      const { [id]: _removed, ...rest } = state.checks;
      return {
        initialized: true,
        habits: state.habits.filter((habit) => habit.id !== id),
        checks: rest,
      };
    });
  },
  toggleCheck: (habitId, key) => {
    if (isFutureDay(parseDateKey(key))) return;
    if (!get().habits.some((habit) => habit.id === habitId)) return;
    set((state) => {
      const current = state.checks[habitId] ?? [];
      const has = current.includes(key);
      return {
        checks: {
          ...state.checks,
          [habitId]: has ? current.filter((item) => item !== key) : [...current, key],
        },
      };
    });
  },
}));

if (typeof window !== "undefined") {
  useHabitStore.setState(readSnapshot());
  useHabitStore.subscribe((state) => {
    writeSnapshot(state);
  });
}

export function useHabitHydration(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useHabits(): Habit[] {
  return useHabitStore((state) => state.habits);
}

export function useChecks(): Record<string, string[]> {
  return useHabitStore((state) => state.checks);
}
