import type { Employer } from "@attendance/core";
import { Download, Pencil, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveFile } from "@/lib/files";
import { DEFAULT_SETTINGS, fromConfigJson, toConfigJson, type Settings } from "@/lib/settings";

const FIELDS: Array<{ key: keyof Employer; label: string }> = [
  { key: "name", label: "Employer name" },
  { key: "seat", label: "Registered seat" },
  { key: "taxNumber", label: "Tax number" },
  { key: "registrationNumber", label: "Registration number" },
  { key: "city", label: "City" },
];

export function EmployerForm({ settings, onChange }: { settings: Settings; onChange: (settings: Settings) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  // Without saved employer data (e.g. a public build), open the form straight away.
  const [editing, setEditing] = useState(() => Object.values(settings.employer).some((value) => !value.trim()));
  const [importError, setImportError] = useState<string | null>(null);
  const { employer } = settings;

  async function importConfig(file: File | undefined) {
    if (!file) return;
    try {
      onChange(fromConfigJson(await file.text(), settings));
      setImportError(null);
    } catch (error) {
      setImportError((error as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employer</CardTitle>
        <CardDescription>Remembered in this browser. Import your employer.json once, or fill it in here.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
            <Pencil /> {editing ? "Done" : "Edit"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4">
        {!editing && (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
            {FIELDS.map(({ key, label }) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate">{employer[key]}</dd>
              </div>
            ))}
          </dl>
        )}
        {editing && (
          <>
            {FIELDS.map(({ key, label }) => (
              <Field key={key} id={`employer-${key}`} label={label}>
                <Input
                  id={`employer-${key}`}
                  value={employer[key]}
                  onChange={(e) => onChange({ ...settings, employer: { ...employer, [key]: e.target.value } })}
                />
              </Field>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange({ ...settings, employer: DEFAULT_SETTINGS.employer })}
              >
                <RotateCcw /> Reset to default
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                <Upload /> Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveFile(new Blob([toConfigJson(settings)], { type: "application/json" }), "employer.json")}
              >
                <Download /> Export
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(e) => {
                  void importConfig(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            {importError && <p className="text-sm text-destructive">{importError}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
