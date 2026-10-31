import type { LeaveDay } from "@attendance/core";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LEAVE_LABELS } from "@/lib/format";

export function LeaveEditor({
  leave,
  onChange,
  min,
  max,
}: {
  leave: LeaveDay[];
  onChange: (leave: LeaveDay[]) => void;
  min?: string;
  max?: string;
}) {
  const update = (index: number, patch: Partial<LeaveDay>) =>
    onChange(leave.map((day, i) => (i === index ? { ...day, ...patch } : day)));

  return (
    <div className="grid gap-2">
      <datalist id="leave-labels">
        {Object.entries(LEAVE_LABELS).map(([value, english]) => (
          <option key={value} value={value} label={english} />
        ))}
      </datalist>
      {leave.length === 0 && <p className="text-sm text-muted-foreground">No leave days.</p>}
      {leave.map((day, index) => (
        <div key={index} className="flex gap-2">
          <Input
            type="date"
            aria-label="Date"
            value={day.date}
            min={min}
            max={max}
            onChange={(e) => update(index, { date: e.target.value })}
            className="w-40 shrink-0"
          />
          <Input
            aria-label="Label (printed on the sheet)"
            list="leave-labels"
            value={day.label}
            onChange={(e) => update(index, { label: e.target.value })}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove leave day"
            onClick={() => onChange(leave.filter((_, i) => i !== index))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...leave, { date: "", label: "Szabadság" }])}>
        <Plus /> Add leave day
      </Button>
    </div>
  );
}
