import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { HABIT_COLOR_CLASS, type HabitColor } from "@/lib/habits/model";

type CheckCellProps = {
  checked: boolean;
  color: HabitColor;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
  size?: "md" | "lg";
};

export function CheckCell({
  checked,
  color,
  disabled,
  label,
  onToggle,
  size = "md",
}: CheckCellProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative flex items-center justify-center rounded-md transition-[transform,background-color,box-shadow,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:not-disabled:scale-[0.96]",
        size === "lg" ? "size-12" : "size-10 sm:size-11",
        checked
          ? cn(HABIT_COLOR_CLASS[color], "text-on-habit shadow-(--shadow-border)")
          : "bg-card text-transparent shadow-(--shadow-border) hover:shadow-(--shadow-border-hover)",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <Check
        key={checked ? "on" : "off"}
        strokeWidth={2.5}
        className={cn(
          "size-4",
          checked ? "grove-check-icon text-on-habit" : "opacity-0",
        )}
      />
    </button>
  );
}
