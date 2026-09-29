import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  dateKey,
  dayCompletion,
  formatDaySub,
  HABIT_COLOR_CLASS,
  inSameMonth,
  isFutureDay,
  isToday,
  monthGrid,
  monthLabel,
  percent,
  today,
} from "@/lib/habits/model";
import { addMonths, isSameMonth, startOfMonth } from "date-fns";
import { useChecks, useHabits } from "@/lib/habits/store";

type MonthCalendarProps = {
  date: Date;
  month: Date;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: Date) => void;
};

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function MonthCalendar({ date, month, onMonthChange, onSelectDate }: MonthCalendarProps) {
  const habits = useHabits();
  const checks = useChecks();
  const days = monthGrid(month);
  const selectedKey = dateKey(date);
  const showDots = habits.length > 0 && habits.length <= 6;

  return (
    <div className="rounded-xl bg-card p-3 shadow-(--shadow-border) sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <h3 className="font-display text-xl font-medium tracking-tight">{monthLabel(month)}</h3>
        <div className="flex items-center gap-1">
          {!isSameMonth(month, today()) ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const now = today();
                onMonthChange(startOfMonth(now));
                onSelectDate(now);
              }}
            >
              Today
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => onMonthChange(startOfMonth(addMonths(month, -1)))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => onMonthChange(startOfMonth(addMonths(month, 1)))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="pb-1 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
          >
            {label}
          </div>
        ))}
        {days.map((day) => {
          const key = dateKey(day);
          const inMonth = inSameMonth(day, month);
          const locked = isFutureDay(day);
          const selected = key === selectedKey;
          const todayMark = isToday(day);
          const { done, total } = dayCompletion(habits, checks, key);
          const ratio = total === 0 ? 0 : done / total;
          const title = `${formatDaySub(day)} · ${total === 0 ? "no habits" : `${done} of ${total} · ${percent(done, total)}%`}`;

          return (
            <button
              key={key}
              type="button"
              disabled={locked}
              title={title}
              aria-label={title}
              aria-pressed={selected}
              onClick={() => onSelectDate(day)}
              className={cn(
                "flex min-h-14 flex-col items-center gap-1 rounded-md px-0.5 py-1.5 transition-[background-color,box-shadow,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-16",
                !inMonth && "opacity-40",
                locked && "cursor-not-allowed opacity-30",
                selected && "bg-accent text-accent-foreground",
                !selected && !locked && "hover:bg-muted/80",
                todayMark && !selected && "shadow-(--shadow-border)",
              )}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
                  todayMark && !selected && "bg-primary text-primary-foreground",
                  selected && "bg-primary text-primary-foreground",
                )}
              >
                {day.getDate()}
              </span>
              {showDots ? (
                <span className="flex max-w-full flex-wrap items-center justify-center gap-0.5">
                  {habits.map((habit) => {
                    const on = (checks[habit.id] ?? []).includes(key);
                    return (
                      <span
                        key={habit.id}
                        className={cn(
                          "size-1.5 rounded-full",
                          on ? HABIT_COLOR_CLASS[habit.color] : "bg-border",
                        )}
                      />
                    );
                  })}
                </span>
              ) : (
                <span className="flex h-1.5 w-8 overflow-hidden rounded-full bg-muted">
                  <span
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
