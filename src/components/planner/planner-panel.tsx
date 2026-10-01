import {
  CalendarDays,
  Check,
  FolderKanban,
  ListTodo,
  LoaderCircle,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type Task = {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  estimated_minutes: number | null;
  priority: string | null;
  status: string;
};

type ProjectStep = {
  id: string;
  project_id: string;
  title: string;
  status: string;
  step_order: number;
};

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: string;
};

type ScheduleEvent = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
};

type Tab =
  | "tasks"
  | "projects"
  | "schedule";

function todayKey() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(new Date());
}

export function PlannerPanel() {
  const [open, setOpen] =
    useState(false);

  const [tab, setTab] =
    useState<Tab>("tasks");

  const [loading, setLoading] =
    useState(false);

  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [projects, setProjects] =
    useState<Project[]>([]);

  const [steps, setSteps] =
    useState<ProjectStep[]>([]);

  const [schedule, setSchedule] =
    useState<ScheduleEvent[]>([]);

  const [newTask, setNewTask] =
    useState("");

  const [taskDate, setTaskDate] =
    useState(todayKey());

  async function load() {
    setLoading(true);

    try {
      const [
        taskResult,
        projectResult,
        stepResult,
        scheduleResult,
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .neq(
            "status",
            "completed",
          )
          .order(
            "scheduled_date",
            {
              ascending: true,
              nullsFirst: false,
            },
          ),

        supabase
          .from("projects")
          .select("*")
          .eq(
            "status",
            "active",
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("project_steps")
          .select("*")
          .order("step_order", {
            ascending: true,
          }),

        supabase
          .from(
            "schedule_events",
          )
          .select("*")
          .eq(
            "status",
            "active",
          )
          .gte(
            "end_at",
            new Date().toISOString(),
          )
          .order("start_at", {
            ascending: true,
          }),
      ]);

      if (taskResult.error)
        throw taskResult.error;

      if (projectResult.error)
        throw projectResult.error;

      if (stepResult.error)
        throw stepResult.error;

      if (scheduleResult.error)
        throw scheduleResult.error;

      setTasks(
        taskResult.data ?? [],
      );

      setProjects(
        projectResult.data ?? [],
      );

      setSteps(
        stepResult.data ?? [],
      );

      setSchedule(
        scheduleResult.data ?? [],
      );
    } catch (error) {
      console.error(
        "Planner load failed:",
        error,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open]);

  async function addTask() {
    const title =
      newTask.trim();

    if (!title) {
      return;
    }

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) return;

    const { error } =
      await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title,
          scheduled_date:
            taskDate || null,
          status: "todo",
          priority: "medium",
          ai_created: false,
        });

    if (error) {
      console.error(error);
      return;
    }

    setNewTask("");

    await load();
  }

  async function completeTask(
    id: string,
  ) {
    const { error } =
      await supabase
        .from("tasks")
        .update({
          status: "completed",
        })
        .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    await load();
  }

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]">
          <section className="absolute inset-x-0 bottom-0 mx-auto flex h-[88svh] max-w-3xl flex-col rounded-t-3xl border border-border bg-background shadow-2xl sm:inset-y-6 sm:right-6 sm:left-auto sm:h-auto sm:w-[600px] sm:rounded-3xl">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold">
                  Planner
                </h2>

                <p className="text-sm text-muted-foreground">
                  Tasks, projects and schedule
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    void load()
                  }
                  className="rounded-xl p-2 hover:bg-secondary"
                >
                  <RefreshCw
                    className={
                      loading
                        ? "size-5 animate-spin"
                        : "size-5"
                    }
                  />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setOpen(false)
                  }
                  className="rounded-xl p-2 hover:bg-secondary"
                >
                  <X className="size-5" />
                </button>
              </div>
            </header>

            <div className="grid grid-cols-3 border-b border-border p-2">
              <button
                type="button"
                onClick={() =>
                  setTab("tasks")
                }
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
                  tab === "tasks"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground"
                }`}
              >
                <ListTodo className="size-4" />
                Tasks
              </button>

              <button
                type="button"
                onClick={() =>
                  setTab(
                    "projects",
                  )
                }
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
                  tab === "projects"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground"
                }`}
              >
                <FolderKanban className="size-4" />
                Projects
              </button>

              <button
                type="button"
                onClick={() =>
                  setTab(
                    "schedule",
                  )
                }
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
                  tab === "schedule"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground"
                }`}
              >
                <CalendarDays className="size-4" />
                Schedule
              </button>
            </div>

            <main className="flex-1 overflow-y-auto p-4 sm:p-5">
              {loading ? (
                <div className="flex h-40 items-center justify-center">
                  <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : null}

              {!loading &&
              tab === "tasks" ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-border p-3">
                    <input
                      value={newTask}
                      onChange={(e) =>
                        setNewTask(
                          e.target
                            .value,
                        )
                      }
                      placeholder="New task..."
                      className="mb-3 w-full bg-transparent text-sm outline-none"
                    />

                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={
                          taskDate
                        }
                        onChange={(
                          e,
                        ) =>
                          setTaskDate(
                            e.target
                              .value,
                          )
                        }
                        className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          void addTask()
                        }
                        className="flex items-center gap-1 rounded-xl bg-foreground px-4 py-2 text-sm text-background"
                      >
                        <Plus className="size-4" />
                        Add
                      </button>
                    </div>
                  </div>

                  {tasks.length ===
                  0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      No active tasks.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map(
                        (task) => (
                          <div
                            key={
                              task.id
                            }
                            className="flex items-start gap-3 rounded-2xl border border-border p-3.5"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                void completeTask(
                                  task.id,
                                )
                              }
                              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-secondary"
                            >
                              <Check className="size-4" />
                            </button>

                            <div className="min-w-0 flex-1">
                              <p className="font-medium">
                                {
                                  task.title
                                }
                              </p>

                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {task.scheduled_date ? (
                                  <span>
                                    {
                                      task.scheduled_date
                                    }
                                  </span>
                                ) : null}

                                {task.start_time ? (
                                  <span>
                                    {task.start_time.slice(
                                      0,
                                      5,
                                    )}
                                  </span>
                                ) : null}

                                {task.estimated_minutes ? (
                                  <span>
                                    {
                                      task.estimated_minutes
                                    }{" "}
                                    min
                                  </span>
                                ) : null}

                                {task.priority ? (
                                  <span>
                                    {
                                      task.priority
                                    }
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {!loading &&
              tab ===
                "projects" ? (
                <div className="space-y-3">
                  {projects.length ===
                  0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      No active projects yet.
                    </p>
                  ) : (
                    projects.map(
                      (project) => {
                        const projectSteps =
                          steps.filter(
                            (step) =>
                              step.project_id ===
                              project.id,
                          );

                        const done =
                          projectSteps.filter(
                            (step) =>
                              step.status ===
                              "done",
                          ).length;

                        return (
                          <article
                            key={
                              project.id
                            }
                            className="rounded-2xl border border-border p-4"
                          >
                            <div className="mb-3">
                              <h3 className="font-semibold">
                                {
                                  project.title
                                }
                              </h3>

                              {project.description ? (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {
                                    project.description
                                  }
                                </p>
                              ) : null}

                              {projectSteps.length >
                              0 ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {
                                    done
                                  }
                                  /
                                  {
                                    projectSteps.length
                                  }{" "}
                                  steps completed
                                </p>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              {projectSteps.map(
                                (
                                  step,
                                ) => (
                                  <div
                                    key={
                                      step.id
                                    }
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <div
                                      className={`flex size-6 items-center justify-center rounded-full border ${
                                        step.status ===
                                        "done"
                                          ? "bg-foreground text-background"
                                          : "border-border"
                                      }`}
                                    >
                                      {step.status ===
                                      "done" ? (
                                        <Check className="size-3.5" />
                                      ) : (
                                        <span className="text-[10px]">
                                          {
                                            step.step_order
                                          }
                                        </span>
                                      )}
                                    </div>

                                    <span
                                      className={
                                        step.status ===
                                        "done"
                                          ? "text-muted-foreground line-through"
                                          : ""
                                      }
                                    >
                                      {
                                        step.title
                                      }
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </article>
                        );
                      },
                    )
                  )}
                </div>
              ) : null}

              {!loading &&
              tab ===
                "schedule" ? (
                <div className="space-y-2">
                  {schedule.length ===
                  0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      No upcoming events.
                    </p>
                  ) : (
                    schedule.map(
                      (event) => {
                        const start =
                          new Date(
                            event.start_at,
                          );

                        const end =
                          new Date(
                            event.end_at,
                          );

                        return (
                          <div
                            key={
                              event.id
                            }
                            className="rounded-2xl border border-border p-4"
                          >
                            <p className="font-medium">
                              {
                                event.title
                              }
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {start.toLocaleDateString(
                                "tr-TR",
                              )}{" "}
                              ·{" "}
                              {start.toLocaleTimeString(
                                "tr-TR",
                                {
                                  hour: "2-digit",
                                  minute:
                                    "2-digit",
                                },
                              )}
                              {" – "}
                              {end.toLocaleTimeString(
                                "tr-TR",
                                {
                                  hour: "2-digit",
                                  minute:
                                    "2-digit",
                                },
                              )}
                            </p>
                          </div>
                        );
                      },
                    )
                  )}
                </div>
              ) : null}
            </main>
          </section>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() =>
          setOpen(true)
        }
        className="fixed bottom-4 left-4 z-30 flex size-14 items-center justify-center rounded-full border border-border bg-background shadow-xl transition-transform active:scale-95"
        aria-label="Open planner"
      >
        <CalendarDays className="size-6" />
      </button>
    </>
  );
}
