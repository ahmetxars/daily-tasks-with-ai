import { useMemo, useState } from "react";
import { isSameMonth, startOfMonth } from "date-fns";
import { Plus } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AssistantPanel } from "@/components/ai/assistant-panel";
import { HabitDialog } from "@/components/grove/habit-dialog";
import { MonthCalendar } from "@/components/grove/month-calendar";
import { TodayPanel } from "@/components/grove/today-panel";
import { WeekGrid } from "@/components/grove/week-grid";
import { cn } from "@/lib/utils";
import {
  dateKey,
  dayCompletion,
  habitStats,
  percent,
  today,
  weekDays,
  type Habit,
} from "@/lib/habits/model";
import { useChecks, useHabitHydration, useHabitStore, useHabits } from "@/lib/habits/store";

type CalendarView = "week" | "month";

export function GroveApp() {
  const ready = useHabitHydration();

  if (!ready) {
    return <GroveSkeleton />;
  }

  return (
    <TooltipProvider delayDuration={250}>
      <GroveReady />
      <Toaster
        position="bottom-center"
        toastOptions={{
          className:
            "font-sans bg-foreground text-background border-none shadow-(--shadow-border)",
        }}
      />
    </TooltipProvider>
  );
}

function GroveReady() {
  const habits = useHabits();
  const checks = useChecks();
  const deleteHabit = useHabitStore((s) => s.deleteHabit);
  const [selected, setSelected] = useState(() => today());
  const [month, setMonth] = useState(() => startOfMonth(today()));
  const [view, setView] = useState<CalendarView>("week");
  const [editor, setEditor] = useState<Habit | null | "new">(null);
  const [pendingDelete, setPendingDelete] = useState<Habit | null>(null);

  function selectDate(next: Date) {
    setSelected(next);
    if (!isSameMonth(next, month)) {
      setMonth(startOfMonth(next));
    }
  }

  const overview = useMemo(() => computeOverview(habits, checks), [habits, checks]);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-display text-2xl font-medium tracking-tight">Grove</p>
            <p className="hidden text-sm text-muted-foreground sm:block">Daily habits, kept.</p>
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle view={view} onChange={setView} />
            <Button onClick={() => setEditor("new")} className="pl-3.5 pr-4" aria-label="Add habit">
              <Plus />
              <span className="hidden sm:inline">Add habit</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 pb-16">
        <OverviewStrip overview={overview} />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <TodayPanel
            date={selected}
            onAdd={() => setEditor("new")}
            onEdit={(habit) => setEditor(habit)}
            onDelete={setPendingDelete}
            onJumpToday={() => selectDate(today())}
          />
          <div className="min-w-0">
            {view === "week" ? (
              <WeekGrid
                date={selected}
                onSelectDate={selectDate}
                onEdit={(habit) => setEditor(habit)}
              />
            ) : (
              <MonthCalendar
                date={selected}
                month={month}
                onMonthChange={setMonth}
                onSelectDate={selectDate}
              />
            )}
          </div>
        </div>
      </main>

      <AssistantPanel />

      <HabitDialog
        open={editor !== null}
        habit={editor && editor !== "new" ? editor : null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        onRequestDelete={(habit) => {
          setEditor(null);
          setPendingDelete(habit);
        }}
      />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the habit and its check history from this device. You cannot undo it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:opacity-90"
              onClick={() => {
                if (!pendingDelete) return;
                deleteHabit(pendingDelete.id);
                toast(`${pendingDelete.name} deleted`);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type Overview = {
  todayDone: number;
  todayTotal: number;
  weekDone: number;
  weekTotal: number;
  bestStreak: number;
  bestName: string | null;
  last30: number;
};

function computeOverview(habits: Habit[], checks: Record<string, string[]>): Overview {
  const now = today();
  const { done, total } = dayCompletion(habits, checks, dateKey(now));
  const days = weekDays(now);
  let weekDone = 0;
  let weekTotal = 0;
  for (const day of days) {
    if (day > now) continue;
    const cell = dayCompletion(habits, checks, dateKey(day));
    weekDone += cell.done;
    weekTotal += cell.total;
  }

  let bestStreak = 0;
  let bestName: string | null = null;
  let last30Done = 0;
  let last30Total = 0;
  for (const habit of habits) {
    const stats = habitStats(checks[habit.id], now);
    if (stats.currentStreak > bestStreak) {
      bestStreak = stats.currentStreak;
      bestName = habit.name;
    }
    last30Done += stats.last30.done;
    last30Total += stats.last30.total;
  }

  return {
    todayDone: done,
    todayTotal: total,
    weekDone,
    weekTotal,
    bestStreak,
    bestName,
    last30: percent(last30Done, last30Total),
  };
}

function OverviewStrip({ overview }: { overview: Overview }) {
  const items = [
    {
      label: "Today",
      value: overview.todayTotal === 0 ? "—" : `${overview.todayDone}/${overview.todayTotal}`,
      hint: overview.todayTotal === 0 ? "Add a habit" : "checked",
    },
    {
      label: "This week",
      value: `${percent(overview.weekDone, overview.weekTotal)}%`,
      hint: `${overview.weekDone} of ${overview.weekTotal}`,
    },
    {
      label: "Best streak",
      value: overview.bestStreak === 0 ? "—" : `${overview.bestStreak}`,
      hint: overview.bestName ?? "No streak yet",
    },
    {
      label: "Last 30 days",
      value: `${overview.last30}%`,
      hint: "across every habit",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "rounded-xl bg-card px-4 py-3 shadow-(--shadow-border) grove-rise",
            index === 1 && "grove-rise-delay-1",
            index === 2 && "grove-rise-delay-2",
            index === 3 && "grove-rise-delay-3",
          )}
        >
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{item.label}</p>
          <p className="mt-1 font-display text-2xl font-medium tracking-tight tabular-nums">{item.value}</p>
          <p className="truncate text-xs text-muted-foreground">{item.hint}</p>
        </div>
      ))}
    </section>
  );
}

function ViewToggle({ view, onChange }: { view: CalendarView; onChange: (view: CalendarView) => void }) {
  return (
    <div className="flex rounded-md bg-secondary p-1">
      {(["week", "month"] as const).map((option) => {
        const active = view === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              "h-9 min-w-16 rounded-sm px-3 text-sm font-medium capitalize transition-colors duration-150",
              active ? "bg-card text-foreground shadow-(--shadow-border)" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function GroveSkeleton() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <p className="font-display text-2xl font-medium tracking-tight">Grove</p>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-card shadow-(--shadow-border)" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-card shadow-(--shadow-border)" />
      </main>
    </div>
  );
}
