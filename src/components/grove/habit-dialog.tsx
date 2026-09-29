import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  HABIT_COLOR_CLASS,
  HABIT_COLOR_LABEL,
  HABIT_COLORS,
  type Habit,
  type HabitColor,
} from "@/lib/habits/model";
import { useHabitStore } from "@/lib/habits/store";

type HabitDialogProps = {
  open: boolean;
  habit: Habit | null;
  onOpenChange: (open: boolean) => void;
  onRequestDelete?: (habit: Habit) => void;
};

export function HabitDialog({ open, habit, onOpenChange, onRequestDelete }: HabitDialogProps) {
  const addHabit = useHabitStore((s) => s.addHabit);
  const updateHabit = useHabitStore((s) => s.updateHabit);
  const [name, setName] = useState("");
  const [color, setColor] = useState<HabitColor>("sage");

  useEffect(() => {
    if (!open) return;
    setName(habit?.name ?? "");
    setColor(habit?.color ?? "sage");
  }, [open, habit]);

  const editing = habit !== null;
  const canSave = name.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    if (editing) {
      updateHabit(habit.id, { name, color });
    } else {
      addHabit({ name, color });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit habit" : "New habit"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Rename it or pick a quieter color. Completions stay put."
              : "Give it a name you will actually keep. Color is how it shows up in the grove."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              autoFocus
              maxLength={40}
              value={name}
              placeholder="Morning walk"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSave();
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-1">
              {HABIT_COLORS.map((value) => {
                const selected = value === color;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={HABIT_COLOR_LABEL[value]}
                    aria-pressed={selected}
                    onClick={() => setColor(value)}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-md transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      selected ? "bg-muted" : "hover:bg-muted/70",
                    )}
                  >
                    <span
                      className={cn(
                        "block size-6 rounded-full",
                        HABIT_COLOR_CLASS[value],
                        selected && "ring-2 ring-foreground/80 ring-offset-2 ring-offset-card",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          {editing && onRequestDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onRequestDelete(habit)}
            >
              Delete
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {editing ? "Save" : "Add habit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
