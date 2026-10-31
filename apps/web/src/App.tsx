import { WEEKEND_POLICIES, buildAttendanceSheet, parseTogglCsv, type AttendanceSheet, type LeaveDay, type TimeEntry, type WeekendPolicy } from "@attendance/core";
import { daysInMonth, parseYearMonth } from "@attendance/calendar-hu";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CsvDrop, type CsvFile } from "@/components/csv-drop";
import { EmployerForm } from "@/components/employer-form";
import { Field } from "@/components/field";
import { LeaveEditor } from "@/components/leave-editor";
import { SheetPreview, type DayChoice } from "@/components/sheet-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { loadSettings, saveSettings, toNumber, type Settings } from "@/lib/settings";

const POLICY_LABELS: Record<WeekendPolicy, string> = {
  redistribute: "Spread over the worked weekdays",
  keep: "Keep them on the weekend / holiday",
  reject: "Stop with an error",
};

type Result = { sheet: AttendanceSheet } | { error: string } | null;

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [csv, setCsv] = useState<CsvFile | null>(null);
  const [month, setMonth] = useState("");
  const [leave, setLeave] = useState<LeaveDay[]>([]);
  const [zeroDays, setZeroDays] = useState<string[]>([]);
  const [startEnabled, setStartEnabled] = useState(false);
  const [startDate, setStartDate] = useState("");

  useEffect(() => saveSettings(settings), [settings]);

  const parsed = useMemo((): { entries: TimeEntry[] } | { error: string } | null => {
    if (!csv) return null;
    try {
      return { entries: parseTogglCsv(csv.text) };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }, [csv]);

  const entries = parsed && "entries" in parsed ? parsed.entries : null;
  const csvMonths = useMemo(() => [...new Set((entries ?? []).map((e) => e.startDate.slice(0, 7)))].sort(), [entries]);
  const activeMonth = month || (csvMonths.length === 1 ? csvMonths[0]! : "");
  const monthRange = monthBounds(activeMonth);

  const result = useMemo((): Result => {
    if (!parsed) return null;
    if ("error" in parsed) return parsed;
    const baseHours = toNumber(settings.baseHours);
    if (baseHours === undefined) return { error: "Enter the base hours." };
    if (!settings.employee.trim()) return { error: "Enter the employee name." };
    if (startEnabled && !startDate) return { error: "Pick the employment start date." };
    try {
      const sheet = buildAttendanceSheet({
        entries: parsed.entries,
        employee: settings.employee,
        employer: settings.employer,
        baseHours,
        month: month || undefined,
        leave: leave.filter((day) => day.date),
        zeroDays,
        arrival: settings.arrival,
        weekendPolicy: settings.weekendPolicy,
        place: settings.place,
        ...(startEnabled ? { startDate, maxDailyHours: toNumber(settings.maxDailyHours) ?? Number.NaN } : {}),
      });
      return { sheet };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }, [parsed, settings, month, leave, zeroDays, startEnabled, startDate]);

  /** Decides what a workday without tracked hours is: a leave day, a 0-hour day, or (null) undecided again. */
  function resolveDay(date: string, choice: DayChoice | null) {
    setLeave((current) => [
      ...current.filter((day) => day.date !== date),
      ...(choice && choice !== "zero" ? [{ date, label: choice }] : []),
    ]);
    setZeroDays((current) => [...current.filter((d) => d !== date), ...(choice === "zero" ? [date] : [])]);
  }

  const missingEmployer = Object.values(settings.employer).some((value) => !value.trim());
  const csvSummary = entries
    ? `${entries.length} entries${entries[0]?.member ? ` · ${entries[0].member}` : ""}${csvMonths.length ? ` · ${csvMonths.join(", ")}` : ""}`
    : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance sheet</h1>
          <p className="text-sm text-muted-foreground">Monthly Hungarian attendance sheet (jelenléti ív) PDF from a Toggl Track CSV export.</p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" /> Everything runs in your browser; the CSV is never uploaded.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <CsvDrop file={csv} summary={csvSummary} onFile={setCsv} />
              <Field id="employee" label="Employee name" hint="Printed on the sheet as typed (the CSV may lose accents).">
                <Input id="employee" value={settings.employee} onChange={(e) => setSettings({ ...settings, employee: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field id="base-hours" label="Monthly base hours">
                  <Input
                    id="base-hours"
                    inputMode="decimal"
                    value={settings.baseHours}
                    onChange={(e) => setSettings({ ...settings, baseHours: e.target.value })}
                  />
                </Field>
                <Field id="arrival" label="Arrival time">
                  <Input id="arrival" type="time" value={settings.arrival} onChange={(e) => setSettings({ ...settings, arrival: e.target.value })} />
                </Field>
              </div>
              <Field id="month" label="Month" hint={month ? undefined : activeMonth ? `From the CSV: ${activeMonth}` : "Leave empty to take it from the CSV."}>
                <Input id="month" type="month" value={month} placeholder="YYYY-MM" onChange={(e) => setMonth(e.target.value)} />
              </Field>
              <Field
                id="weekend-policy"
                label="Hours on weekends and holidays"
                hint={startEnabled ? "Not used with a mid-month start: all hours are divided anyway." : undefined}
              >
                <Select
                  value={settings.weekendPolicy}
                  disabled={startEnabled}
                  onValueChange={(value) => setSettings({ ...settings, weekendPolicy: value as WeekendPolicy })}
                >
                  <SelectTrigger id="weekend-policy" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKEND_POLICIES.map((policy) => (
                      <SelectItem key={policy} value={policy}>
                        {POLICY_LABELS[policy]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mid-month start</CardTitle>
              <CardDescription>
                All hours of the month are divided over the workdays from the start date to the last workday of the month, following the daily pattern tracked in Toggl, up to the daily maximum. Hours that do not fit are reported here and left off the sheet.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <div className="flex items-center gap-3">
                <Switch id="start-enabled" checked={startEnabled} onCheckedChange={setStartEnabled} />
                <Label htmlFor="start-enabled">Employment started during the month</Label>
              </div>
              {startEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <Field id="start-date" label="Start date">
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      min={monthRange?.min}
                      max={monthRange?.max}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </Field>
                  <Field id="max-daily" label="Daily maximum (hours)">
                    <Input
                      id="max-daily"
                      inputMode="decimal"
                      value={settings.maxDailyHours}
                      onChange={(e) => setSettings({ ...settings, maxDailyHours: e.target.value })}
                    />
                  </Field>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leave days</CardTitle>
              <CardDescription>Paid leave, sick leave, sick pay. Counted as 0 hours; the label is printed on the sheet in Hungarian.</CardDescription>
            </CardHeader>
            <CardContent>
              <LeaveEditor leave={leave} onChange={setLeave} min={monthRange?.min} max={monthRange?.max} />
            </CardContent>
          </Card>

          <EmployerForm settings={settings} onChange={setSettings} />
        </div>

        <div className="lg:sticky lg:top-6">
          {!result && (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Choose a Toggl CSV export to see the preview.
              </CardContent>
            </Card>
          )}
          {result && "error" in result && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>The sheet cannot be made</AlertTitle>
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          )}
          {result && "sheet" in result && (
            <SheetPreview
              sheet={result.sheet}
              onResolve={resolveDay}
              blocker={missingEmployer ? "Fill in the employer details to download." : null}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function monthBounds(yearMonth: string): { min: string; max: string } | undefined {
  const ym = parseYearMonth(yearMonth);
  if (!ym) return undefined;
  return { min: `${yearMonth}-01`, max: `${yearMonth}-${String(daysInMonth(ym.year, ym.month)).padStart(2, "0")}` };
}
