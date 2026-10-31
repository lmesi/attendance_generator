import type { AttendanceSheet, SheetDay } from "@attendance/core";
import { CircleAlert, Download, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadPdf } from "@/lib/files";
import { formatDate, formatHours, formatPeriod, hoursFromSeconds, leaveLabel, weekdayName } from "@/lib/format";
import { cn } from "@/lib/utils";

/** What a workday without tracked hours becomes; leave values are the Hungarian labels printed on the sheet. */
export type DayChoice = "Szabadság" | "Betegszabadság" | "zero";

const CHOICES: Array<{ value: DayChoice; label: string }> = [
  { value: "Szabadság", label: "Paid leave" },
  { value: "Betegszabadság", label: "Sick leave" },
  { value: "zero", label: "0 hours" },
];

// Row colours: missing days must stand out; decided days stay visible but calmer.
const ROW_TONE = {
  missing: "bg-red-500/15 hover:bg-red-500/20",
  leave: "bg-sky-500/10 hover:bg-sky-500/15",
  zero: "bg-violet-500/10 hover:bg-violet-500/15",
  grey: "bg-muted/40 text-muted-foreground hover:bg-muted/50",
};

export function SheetPreview({
  sheet,
  blocker,
  onResolve,
}: {
  sheet: AttendanceSheet;
  blocker: string | null;
  onResolve: (date: string, choice: DayChoice | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leftover = sheet.startDateDistribution?.leftoverSeconds ? sheet.startDateDistribution : null;
  // The leftover has its own alert; the remaining warnings come from core as plain text.
  const warnings = leftover ? sheet.warnings.filter((w) => !w.includes("did not fit")) : sheet.warnings;
  const missing = sheet.days.filter((d) => d.missing);
  const reason =
    missing.length > 0 ? `Fill in the ${missing.length} empty workday${missing.length === 1 ? "" : "s"} before downloading.` : blocker;

  async function download() {
    setBusy(true);
    setError(null);
    try {
      await downloadPdf(sheet);
    } catch (e) {
      setError(`Could not create the PDF: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>
          {sheet.employee} · {formatPeriod(sheet.year, sheet.month)}
        </CardDescription>
        <CardAction>
          <Button onClick={download} disabled={busy || reason !== null}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Download />} Download PDF
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4">
        {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {missing.length > 0 && <MissingDaysAlert days={missing} onResolve={onResolve} />}

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total hours worked" value={formatHours(sheet.totals.totalHundredths)} />
          <Stat
            label={`Base (min. ${formatHours(sheet.totals.configuredBaseHundredths)})`}
            value={formatHours(sheet.totals.baseHundredths)}
          />
          <Stat label="Extra hours" value={formatHours(sheet.totals.extraHundredths)} />
        </div>

        {leftover && (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-200">
            <TriangleAlert />
            <AlertTitle>{hoursFromSeconds(leftover.leftoverSeconds)} hours did not fit and are not on the sheet</AlertTitle>
            <AlertDescription className="text-amber-200/80">
              Of the month’s {hoursFromSeconds(leftover.pooledSeconds)} hours, {hoursFromSeconds(leftover.placedSeconds)} were placed
              on {leftover.toDates.length} workdays (from {formatDate(leftover.startDate)}, at most{" "}
              {hoursFromSeconds(leftover.maxDailySeconds)} hours a day).
            </AlertDescription>
          </Alert>
        )}
        {sheet.notes.map((note) => (
          <Alert key={note}>
            <Info />
            <AlertTitle>Note printed under the table</AlertTitle>
            <AlertDescription>
              <p>
                Hours tracked on weekends and holidays ({hoursFromSeconds(sheet.redistribution?.pooledSeconds ?? 0)}) were spread
                evenly over the worked weekdays.
              </p>
              <p className="text-xs">On the sheet: “{note}”</p>
            </AlertDescription>
          </Alert>
        ))}
        {warnings.length > 0 && (
          <Alert>
            <TriangleAlert />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              {warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead className="text-center">Arrival</TableHead>
                <TableHead className="text-center">Leaving</TableHead>
                <TableHead className="text-right">Hours worked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet.days.map((day) => (
                <DayRow key={day.date} day={day} onUndo={() => onResolve(day.date, null)} />
              ))}
            </TableBody>
          </Table>
        </div>
        <Legend />
      </CardContent>
    </Card>
  );
}

function MissingDaysAlert({ days, onResolve }: { days: SheetDay[]; onResolve: (date: string, choice: DayChoice) => void }) {
  return (
    <Alert className="border-red-500/40 bg-red-500/10">
      <CircleAlert className="text-red-300" />
      <AlertTitle className="text-red-200">
        {days.length} workday{days.length === 1 ? " has" : "s have"} no tracked time
      </AlertTitle>
      <AlertDescription className="grid w-full gap-3">
        <p>A workday cannot stay empty. Mark each one as paid leave, sick leave or a 0-hour day.</p>
        {days.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs">All of them:</span>
            {CHOICES.map(({ value, label }) => (
              <Button
                key={value}
                variant="outline"
                size="xs"
                onClick={() => days.forEach((day) => onResolve(day.date, value))}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
        <ul className="grid gap-2">
          {days.map((day) => (
            <li key={day.date} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background/40 px-3 py-2">
              <span className="text-sm text-foreground tabular-nums">{formatDate(day.date)}</span>
              <span className="flex flex-wrap gap-1.5">
                {CHOICES.map(({ value, label }) => (
                  <Button key={value} variant="secondary" size="xs" onClick={() => onResolve(day.date, value)}>
                    {label}
                  </Button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">
        {value} <span className="text-sm font-normal text-muted-foreground">h</span>
      </p>
    </div>
  );
}

function DayRow({ day, onUndo }: { day: SheetDay; onUndo: () => void }) {
  const moved = day.seconds !== day.trackedSeconds;
  const tone = day.missing ? ROW_TONE.missing : day.type === "leave" ? ROW_TONE.leave : day.type === "zero" ? ROW_TONE.zero : day.grey ? ROW_TONE.grey : undefined;
  const undoable = day.type === "leave" || day.type === "zero";

  return (
    <TableRow className={tone}>
      <TableCell className="tabular-nums">{day.date}</TableCell>
      <TableCell>{weekdayName(day.date)}</TableCell>
      <TableCell className="text-center tabular-nums">{day.cells.arrival}</TableCell>
      <TableCell className="text-center tabular-nums">{day.cells.leaving}</TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="inline-flex items-center justify-end gap-1.5">
          {day.missing ? (
            <Badge className="bg-red-500/20 text-red-200">To fill in</Badge>
          ) : day.type === "leave" ? (
            <Badge className="bg-sky-500/20 text-sky-200" title={`Printed as “${day.cells.hours}”`}>
              {leaveLabel(day.cells.hours)}
            </Badge>
          ) : day.type === "zero" ? (
            <Badge className="bg-violet-500/20 text-violet-200">0.00 h</Badge>
          ) : day.seconds > 0 ? (
            hoursFromSeconds(day.seconds)
          ) : day.type === "holiday" ? (
            <span className="italic" title={day.holidayName}>
              Public holiday
            </span>
          ) : null}
          {moved && (
            <span className="text-xs text-muted-foreground" title="Time tracked in Toggl on this day">
              (Toggl: {hoursFromSeconds(day.trackedSeconds)})
            </span>
          )}
          {undoable && (
            <Button variant="ghost" size="icon-xs" aria-label="Undo" title="Undo" onClick={onUndo}>
              <X />
            </Button>
          )}
        </span>
      </TableCell>
    </TableRow>
  );
}

function Legend() {
  const items = [
    ["bg-red-500/40", "Workday to fill in"],
    ["bg-sky-500/40", "Leave"],
    ["bg-violet-500/40", "0-hour day"],
    ["bg-muted", "Weekend, public holiday, rest day"],
  ] as const;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map(([color, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", color)} /> {label}
        </li>
      ))}
    </ul>
  );
}
