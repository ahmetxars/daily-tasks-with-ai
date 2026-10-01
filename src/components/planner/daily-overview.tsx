import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListTodo,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import {
  useChecks,
  useHabits,
  useHabitStore,
} from "@/lib/habits/store";

type Task = {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  estimated_minutes: number | null;
  priority: string | null;
  status: string;
  project_id: string | null;
};

type ScheduleEvent = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  status: string;
};

const TZ = "Europe/Istanbul";

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(key: string, amount: number) {
  const [year, month, day] = key.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day + amount, 12),
  );

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function displayDate(key: string) {
  const date = new Date(`${key}T12:00:00+03:00`);

  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function eventTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function taskTime(value: string | null) {
  if (!value) return null;
  return value.slice(0, 5);
}

export function DailyOverview() {
  const today = dateKey();

  const [selectedDate, setSelectedDate] =
    useState(today);

  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [events, setEvents] =
    useState<ScheduleEvent[]>([]);

  const [loading, setLoading] =
    useState(false);

  const habits = useHabits();
  const checks = useChecks();

  const toggleCheck = useHabitStore(
    (state) => state.toggleCheck,
  );

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const dayStart =
        `${selectedDate}T00:00:00+03:00`;

      const dayEnd =
        `${selectedDate}T23:59:59+03:00`;

      const [
        tasksResult,
        scheduleResult,
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq(
            "scheduled_date",
            selectedDate,
          )
          .neq(
            "status",
            "completed",
          )
          .order("start_time", {
            ascending: true,
            nullsFirst: false,
          }),

        supabase
          .from("schedule_events")
          .select("*")
          .eq("status", "active")
          .gte("start_at", dayStart)
          .lte("start_at", dayEnd)
          .order("start_at", {
            ascending: true,
          }),
      ]);

      if (tasksResult.error) {
        throw tasksResult.error;
      }

      if (scheduleResult.error) {
        throw scheduleResult.error;
      }

      setTasks(
        tasksResult.data ?? [],
      );

      setEvents(
        scheduleResult.data ?? [],
      );
    } catch (error) {
      console.error(
        "Daily planner load failed:",
        error,
      );
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      void load();
    };

    window.addEventListener(
      "planner-data-changed",
      refresh,
    );

    return () => {
      window.removeEventListener(
        "planner-data-changed",
        refresh,
      );
    };
  }, [load]);

  const checkedHabitIds =
    useMemo(() => {
      return new Set(
        Object.entries(checks)
          .filter(([, days]) =>
            days.includes(selectedDate),
          )
          .map(([habitId]) => habitId),
      );
    }, [checks, selectedDate]);

  const completedHabits =
    checkedHabitIds.size;

  const isFuture =
    selectedDate > today;

  async function completeTask(
    taskId: string,
  ) {
    const { error } =
      await supabase
        .from("tasks")
        .update({
          status: "completed",
        })
        .eq("id", taskId);

    if (error) {
      console.error(error);
      return;
    }

    await load();

    window.dispatchEvent(
      new Event(
        "planner-data-changed",
      ),
    );
  }

  const planItems = [
    ...events.map((event) => ({
      kind:
        "event" as const,
      id: event.id,
      title: event.title,
      time: eventTime(
        event.start_at,
      ),
      endTime: eventTime(
        event.end_at,
      ),
      minutes: null,
      task: null,
    })),

    ...tasks
      .filter(
        (task) =>
          task.start_time,
      )
      .map((task) => ({
        kind:
          "task" as const,
        id: task.id,
        title: task.title,
        time:
          taskTime(
            task.start_time,
          ) ?? "",
        endTime: null,
        minutes:
          task.estimated_minutes,
        task,
      })),
  ].sort((a, b) =>
    a.time.localeCompare(b.time),
  );

  const unscheduledTasks =
    tasks.filter(
      (task) =>
        !task.start_time,
    );

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {selectedDate === today
              ? "Today"
              : selectedDate}
          </p>

          <h2 className="mt-1 font-display text-3xl font-medium capitalize tracking-tight">
            {displayDate(
              selectedDate,
            )}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          {selectedDate !==
          today ? (
            <button
              type="button"
              onClick={() =>
                setSelectedDate(
                  today,
                )
              }
              className="rounded-xl border border-border p-2 hover:bg-secondary"
              title="Bugüne dön"
            >
              <RotateCcw className="size-4" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={() =>
              setSelectedDate(
                addDays(
                  selectedDate,
                  -1,
                ),
              )
            }
            className="rounded-xl border border-border p-2 hover:bg-secondary"
          >
            <ChevronLeft className="size-4" />
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedDate(
                addDays(
                  selectedDate,
                  1,
                ),
              )
            }
            className="rounded-xl border border-border p-2 hover:bg-secondary"
          >
            <ChevronRight className="size-4" />
          </button>

          <button
            type="button"
            onClick={() =>
              void load()
            }
            className="rounded-xl border border-border p-2 hover:bg-secondary"
          >
            <RefreshCw
              className={
                loading
                  ? "size-4 animate-spin"
                  : "size-4"
              }
            />
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <CalendarDays className="size-4 text-muted-foreground" />

          <p className="text-sm font-medium">
            Plan
          </p>

          <span className="ml-auto text-xs text-muted-foreground">
            {planItems.length} item
          </span>
        </div>

        {planItems.length === 0 ? (
          <div className="px-4 py-7 text-sm text-muted-foreground">
            Bu güne planlanmış saatli
            task veya etkinlik yok.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {planItems.map(
              (item) => (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="flex gap-3 px-4 py-3.5"
                >
                  <div className="w-14 shrink-0 pt-0.5 text-sm font-medium tabular-nums">
                    {item.time}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      {item.kind ===
                      "task" ? (
                        <button
                          type="button"
                          onClick={() =>
                            void completeTask(
                              item.id,
                            )
                          }
                          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-border hover:bg-secondary"
                        >
                          <Check className="size-3" />
                        </button>
                      ) : (
                        <div className="mt-1 size-2 shrink-0 rounded-full bg-foreground" />
                      )}

                      <div className="min-w-0">
                        <p className="font-medium leading-snug">
                          {
                            item.title
                          }
                        </p>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.kind ===
                          "event"
                            ? `${item.time} – ${item.endTime}`
                            : [
                                item.minutes
                                  ? `${item.minutes} dk`
                                  : null,
                                "Task",
                              ]
                                .filter(
                                  Boolean,
                                )
                                .join(
                                  " · ",
                                )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ListTodo className="size-4 text-muted-foreground" />

          <p className="text-sm font-medium">
            Tasks
          </p>

          <span className="ml-auto text-xs text-muted-foreground">
            {unscheduledTasks.length}
          </span>
        </div>

        {unscheduledTasks.length ===
        0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            Saat verilmemiş task yok.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {unscheduledTasks.map(
              (task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() =>
                      void completeTask(
                        task.id,
                      )
                    }
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-secondary"
                  >
                    <Check className="size-4" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {task.title}
                    </p>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[
                        task.estimated_minutes
                          ? `${task.estimated_minutes} dk`
                          : null,
                        task.priority,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Clock3 className="size-4 text-muted-foreground" />

          <p className="text-sm font-medium">
            Habits
          </p>

          <span className="ml-auto text-xs text-muted-foreground">
            {completedHabits}/
            {habits.length}
          </span>
        </div>

        <div className="divide-y divide-border">
          {habits.map(
            (habit) => {
              const checked =
                checkedHabitIds.has(
                  habit.id,
                );

              return (
                <button
                  key={habit.id}
                  type="button"
                  disabled={isFuture}
                  onClick={() =>
                    toggleCheck(
                      habit.id,
                      selectedDate,
                    )
                  }
                  className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed"
                >
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg border ${
                      checked
                        ? "bg-foreground text-background"
                        : "border-border"
                    }`}
                  >
                    {checked ? (
                      <Check className="size-4" />
                    ) : null}
                  </div>

                  <span
                    className={
                      checked
                        ? "text-muted-foreground"
                        : ""
                    }
                  >
                    {habit.name}
                  </span>
                </button>
              );
            },
          )}
        </div>
      </div>
    </section>
  );
}
