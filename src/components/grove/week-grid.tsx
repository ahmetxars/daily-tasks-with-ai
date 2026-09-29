import { CheckCell } from "@/components/grove/check-cell";
import { cn } from "@/lib/utils";
import {
  dateKey,
  formatDaySub,
  habitStats,
  isFutureDay,
  isToday,
  weekdayMed,
  weekDays,
  type Habit,
} from "@/lib/habits/model";
import { useChecks, useHabitStore, useHabits } from "@/lib/habits/store";

type WeekGridProps = {
  date: Date;
  onSelectDate: (date: Date) => void;
  onEdit: (habit: Habit) => void;
};

export function WeekGrid({ date, onSelectDate, onEdit }: WeekGridProps) {
  const habits = useHabits();
  const checks = useChecks();
  const toggleCheck = useHabitStore((s) => s.toggleCheck);
  const days = weekDays(date);
  const selectedKey = dateKey(date);

  if (habits.length === 0) {
    return (
      <div className="rounded-xl bg-card px-5 py-10 text-center shadow-(--shadow-border)">
        <p className="font-display text-lg font-medium tracking-tight">No habits to scan yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Add one and this week will fill in.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-card shadow-(--shadow-border)">
      <div className="overflow-x-auto">
        <div className="min-w-[36rem]">
          <div
            className="grid border-b border-border"
            style={{ gridTemplateColumns: "minmax(9rem,1.4fr) repeat(7, minmax(2.75rem,1fr))" }}
          >
            <div className="px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Habit
            </div>
            {days.map((day) => {
              const key = dateKey(day);
              const selected = key === selectedKey;
              const todayMark = isToday(day);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2.5 text-center transition-colors duration-150",
                    selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/80",
                  )}
                >
                  <span className="text-[11px] font-medium tracking-wide uppercase">
                    {weekdayMed(day)}
                  </span>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-sm tabular-nums",
                      todayMark && !selected && "bg-primary text-primary-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          {habits.map((habit) => {
            const stats = habitStats(checks[habit.id]);
            return (
              <div
                key={habit.id}
                className="grid border-b border-border last:border-b-0"
                style={{ gridTemplateColumns: "minmax(9rem,1.4fr) repeat(7, minmax(2.75rem,1fr))" }}
              >
                <button
                  type="button"
                  onClick={() => onEdit(habit)}
                  className="flex min-w-0 flex-col items-start justify-center gap-0.5 px-4 py-3 text-left hover:bg-muted/60"
                >
                  <span className="w-full truncate text-sm font-medium">{habit.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {stats.currentStreak > 0 ? `${stats.currentStreak} day streak` : "No current streak"}
                  </span>
                </button>
                {days.map((day) => {
                  const key = dateKey(day);
                  const locked = isFutureDay(day);
                  const checked = (checks[habit.id] ?? []).includes(key);
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center justify-center py-2",
                        isToday(day) && "bg-accent/40",
                      )}
                    >
                      <CheckCell
                        checked={checked}
                        color={habit.color}
                        disabled={locked}
                        label={`${checked ? "Uncheck" : "Check"} ${habit.name} on ${formatDaySub(day)}`}
                        onToggle={() => {
                          toggleCheck(habit.id, key);
                          onSelectDate(day);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
