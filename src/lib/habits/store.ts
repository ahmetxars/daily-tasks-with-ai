import { useEffect } from "react";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";

import {
  isFutureDay,
  parseDateKey,
  type GroveSnapshot,
  type Habit,
  type HabitColor,
} from "./model";

type HabitStore = GroveSnapshot & {
  hydrated: boolean;

  hydrate: () => Promise<void>;

  addHabit: (input: {
    name: string;
    color: HabitColor;
  }) => void;

  updateHabit: (
    id: string,
    patch: {
      name?: string;
      color?: HabitColor;
    },
  ) => void;

  deleteHabit: (id: string) => void;

  toggleCheck: (
    habitId: string,
    key: string,
  ) => void;
};

const STORAGE_KEY = "grove-habits-v1";

const empty: HabitStore = {
  initialized: false,
  hydrated: false,
  habits: [],
  checks: {},

  hydrate: async () => {},
  addHabit: () => {},
  updateHabit: () => {},
  deleteHabit: () => {},
  toggleCheck: () => {},
};

function readLocalSnapshot(): GroveSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<GroveSnapshot>;

    return {
      initialized: true,
      habits: Array.isArray(parsed.habits)
        ? parsed.habits
        : [],
      checks:
        parsed.checks &&
        typeof parsed.checks === "object"
          ? parsed.checks
          : {},
    };
  } catch {
    return null;
  }
}

function writeLocalSnapshot(state: GroveSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

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
    // Local cache failure should not break the app.
  }
}

async function getUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user.id ?? null;
}

async function uploadLocalSnapshot(
  userId: string,
  snapshot: GroveSnapshot,
) {
  if (snapshot.habits.length === 0) {
    return;
  }

  const habitRows = snapshot.habits.map((habit) => ({
    user_id: userId,
    id: habit.id,
    name: habit.name,
    color: habit.color,
    created_at: habit.createdAt,
  }));

  const { error: habitError } = await supabase
    .from("habits")
    .upsert(habitRows, {
      onConflict: "user_id,id",
    });

  if (habitError) {
    throw habitError;
  }

  const checkRows = Object.entries(snapshot.checks)
    .flatMap(([habitId, days]) =>
      days.map((day) => ({
        user_id: userId,
        habit_id: habitId,
        day,
      })),
    );

  if (checkRows.length > 0) {
    const { error: checkError } = await supabase
      .from("habit_checks")
      .upsert(checkRows, {
        onConflict: "user_id,habit_id,day",
      });

    if (checkError) {
      throw checkError;
    }
  }
}

async function loadRemoteSnapshot(
  userId: string,
): Promise<GroveSnapshot> {
  const { data: habitsData, error: habitsError } =
    await supabase
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: true,
      });

  if (habitsError) {
    throw habitsError;
  }

  const { data: checksData, error: checksError } =
    await supabase
      .from("habit_checks")
      .select("habit_id, day")
      .eq("user_id", userId);

  if (checksError) {
    throw checksError;
  }

  const habits: Habit[] = (habitsData ?? []).map(
    (row) => ({
      id: row.id,
      name: row.name,
      color: row.color as HabitColor,
      createdAt: row.created_at,
    }),
  );

  const checks: Record<string, string[]> = {};

  for (const habit of habits) {
    checks[habit.id] = [];
  }

  for (const row of checksData ?? []) {
    if (!checks[row.habit_id]) {
      checks[row.habit_id] = [];
    }

    checks[row.habit_id].push(row.day);
  }

  return {
    initialized: true,
    habits,
    checks,
  };
}

async function persistHabit(
  habit: Habit,
) {
  const userId = await getUserId();

  if (!userId) {
    return;
  }

  const { error } = await supabase
    .from("habits")
    .upsert(
      {
        user_id: userId,
        id: habit.id,
        name: habit.name,
        color: habit.color,
        created_at: habit.createdAt,
      },
      {
        onConflict: "user_id,id",
      },
    );

  if (error) {
    console.error(
      "Failed to save habit:",
      error,
    );
  }
}

async function persistHabitUpdate(
  habit: Habit,
) {
  const userId = await getUserId();

  if (!userId) {
    return;
  }

  const { error } = await supabase
    .from("habits")
    .update({
      name: habit.name,
      color: habit.color,
    })
    .eq("user_id", userId)
    .eq("id", habit.id);

  if (error) {
    console.error(
      "Failed to update habit:",
      error,
    );
  }
}

async function persistHabitDelete(
  id: string,
) {
  const userId = await getUserId();

  if (!userId) {
    return;
  }

  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  if (error) {
    console.error(
      "Failed to delete habit:",
      error,
    );
  }
}

async function persistCheck(
  habitId: string,
  key: string,
  checked: boolean,
) {
  const userId = await getUserId();

  if (!userId) {
    return;
  }

  if (checked) {
    const { error } = await supabase
      .from("habit_checks")
      .upsert(
        {
          user_id: userId,
          habit_id: habitId,
          day: key,
        },
        {
          onConflict:
            "user_id,habit_id,day",
        },
      );

    if (error) {
      console.error(
        "Failed to save habit check:",
        error,
      );
    }

    return;
  }

  const { error } = await supabase
    .from("habit_checks")
    .delete()
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .eq("day", key);

  if (error) {
    console.error(
      "Failed to remove habit check:",
      error,
    );
  }
}

export const useHabitStore =
  create<HabitStore>((set, get) => ({
    ...empty,

    hydrate: async () => {
      if (get().hydrated) {
        return;
      }

      const local = readLocalSnapshot();

      try {
        const userId = await getUserId();

        if (!userId) {
          set({
            ...(local ?? {
              initialized: true,
              habits: [],
              checks: {},
            }),
            hydrated: true,
          });

          return;
        }

        let remote =
          await loadRemoteSnapshot(userId);

        // First migration:
        // If Supabase is empty but this device already
        // has Grove data, upload it once.
        if (
          remote.habits.length === 0 &&
          local &&
          local.habits.length > 0
        ) {
          await uploadLocalSnapshot(
            userId,
            local,
          );

          remote =
            await loadRemoteSnapshot(
              userId,
            );
        }

        set({
          ...remote,
          hydrated: true,
        });
      } catch (error) {
        console.error(
          "Supabase habit hydration failed:",
          error,
        );

        // Offline / temporary failure:
        // fall back to this device's cached copy.
        set({
          ...(local ?? {
            initialized: true,
            habits: [],
            checks: {},
          }),
          hydrated: true,
        });
      }
    },

    addHabit: ({
      name,
      color,
    }) => {
      const trimmed = name.trim();

      if (!trimmed) {
        return;
      }

      const habit: Habit = {
        id: crypto.randomUUID(),
        name: trimmed.slice(0, 40),
        color,
        createdAt:
          new Date().toISOString(),
      };

      set((state) => ({
        initialized: true,
        habits: [
          ...state.habits,
          habit,
        ],
      }));

      void persistHabit(habit);
    },

    updateHabit: (
      id,
      patch,
    ) => {
      let updatedHabit:
        | Habit
        | undefined;

      set((state) => ({
        habits: state.habits.map(
          (habit) => {
            if (habit.id !== id) {
              return habit;
            }

            const name =
              patch.name
                ?.trim()
                .slice(0, 40);

            updatedHabit = {
              ...habit,
              name:
                name ||
                habit.name,
              color:
                patch.color ??
                habit.color,
            };

            return updatedHabit;
          },
        ),
      }));

      if (updatedHabit) {
        void persistHabitUpdate(
          updatedHabit,
        );
      }
    },

    deleteHabit: (id) => {
      set((state) => {
        const {
          [id]: _removed,
          ...rest
        } = state.checks;

        return {
          initialized: true,
          habits:
            state.habits.filter(
              (habit) =>
                habit.id !== id,
            ),
          checks: rest,
        };
      });

      void persistHabitDelete(id);
    },

    toggleCheck: (
      habitId,
      key,
    ) => {
      if (
        isFutureDay(
          parseDateKey(key),
        )
      ) {
        return;
      }

      if (
        !get().habits.some(
          (habit) =>
            habit.id === habitId,
        )
      ) {
        return;
      }

      const current =
        get().checks[habitId] ??
        [];

      const alreadyChecked =
        current.includes(key);

      set((state) => ({
        checks: {
          ...state.checks,
          [habitId]:
            alreadyChecked
              ? current.filter(
                  (item) =>
                    item !== key,
                )
              : [
                  ...current,
                  key,
                ],
        },
      }));

      void persistCheck(
        habitId,
        key,
        !alreadyChecked,
      );
    },
  }));

if (typeof window !== "undefined") {
  useHabitStore.subscribe(
    (state) => {
      if (!state.hydrated) {
        return;
      }

      writeLocalSnapshot({
        initialized:
          state.initialized,
        habits: state.habits,
        checks: state.checks,
      });
    },
  );
}

export function useHabitHydration(): boolean {
  const hydrated =
    useHabitStore(
      (state) =>
        state.hydrated,
    );

  const hydrate =
    useHabitStore(
      (state) =>
        state.hydrate,
    );

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrated, hydrate]);

  return hydrated;
}

export function useHabits(): Habit[] {
  return useHabitStore(
    (state) => state.habits,
  );
}

export function useChecks(): Record<
  string,
  string[]
> {
  return useHabitStore(
    (state) => state.checks,
  );
}
