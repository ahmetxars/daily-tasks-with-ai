import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCell } from "@/components/grove/check-cell";
import { cn } from "@/lib/utils";
import {
  dateKey,
  dayCompletion,
  formatDayHeading,
  formatDaySub,
  habitStats,
  isFutureDay,
  isToday,
  percent,
  type Habit,
} from "@/lib/habits/model";
import { useChecks, useHabitStore, useHabits } from "@/lib/habits/store";

type TodayPanelProps = {
  date: Date;
  onAdd: () => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
  onJumpToday: () => void;
};

export function TodayPanel({ date, onAdd, onEdit, onDelete, onJumpToday }: TodayPanelProps) {
  const habits = useHabits();
  const checks = useChecks();
  const toggleCheck = useHabitStore((s) => s.toggleCheck);
  const key = dateKey(date);
  const viewingToday = isToday(date);
  const locked = isFutureDay(date);
  const { done, total } = dayCompletion(habits, checks, key);
  const remaining = Math.max(total - done, 0);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{formatDaySub(date)}</p>
          <h2 className="font-display text-3xl font-medium tracking-tight text-foreground">
            {formatDayHeading(date)}
          </h2>
        </div>
        <ProgressMark done={done} total={total} />
      </div>

      {!viewingToday ? (
        <button
          type="button"
          onClick={onJumpToday}
          className="rounded-lg bg-secondary px-3 py-2 text-left text-sm text-secondary-foreground transition-colors hover:bg-muted"
        >
          Viewing {formatDaySub(date)}. Jump back to today.
        </button>
      ) : null}

      <div className="rounded-xl bg-card p-2 shadow-(--shadow-border)">
        {habits.length === 0 ? (
          <EmptyHabits onAdd={onAdd} />
        ) : (
          <ul className="flex flex-col">
            {habits.map((habit) => {
              const checked = (checks[habit.id] ?? []).includes(key);
              const stats = habitStats(checks[habit.id]);
              return (
                <li key={habit.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                  <CheckCell
                    checked={checked}
                    color={habit.color}
                    disabled={locked}
                    size="lg"
                    label={`${checked ? "Uncheck" : "Check"} ${habit.name} for ${formatDaySub(date)}`}
                    onToggle={() => toggleCheck(habit.id, key)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate font-medium", checked && "text-muted-foreground")}>
                      {habit.name}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {stats.currentStreak > 0
                        ? `${stats.currentStreak}-day streak · ${percent(stats.last30.done, stats.last30.total)}% of last 30`
                        : `${percent(stats.last30.done, stats.last30.total)}% of last 30 days`}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${habit.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(habit)}>
                        <Pencil />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(habit)}>
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {habits.length > 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          {locked
            ? "That day has not arrived yet."
            : remaining === 0
              ? "Grove is tended. Nothing left for this day."
              : remaining === 1
                ? "One habit left."
                : `${remaining} left to check.`}
        </p>
      ) : null}
    </section>
  );
}

function ProgressMark({ done, total }: { done: number; total: number }) {
  const radius = 15.5;
  const circumference = 2 * Math.PI * radius;
  const ratio = total === 0 ? 0 : done / total;
  return (
    <div className="relative size-14" aria-hidden="true">
      <svg viewBox="0 0 40 40" className="size-14 -rotate-90">
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth="3.5"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-200 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium tabular-nums">
        {done}/{total || 0}
      </span>
    </div>
  );
}

function EmptyHabits({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-8">
      <p className="font-display text-lg font-medium tracking-tight">Start a grove</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Add a handful of things you want to return to. Check them off each day; streaks take care of themselves.
      </p>
      <Button onClick={onAdd}>Add a habit</Button>
    </div>
  );
}
