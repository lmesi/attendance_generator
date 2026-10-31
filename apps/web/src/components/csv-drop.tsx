import { FileSpreadsheet, FileUp } from "lucide-react";
import { useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";

export interface CsvFile {
  name: string;
  text: string;
}

export function CsvDrop({ file, summary, onFile }: { file: CsvFile | null; summary?: string; onFile: (file: CsvFile) => void }) {
  const [dragging, setDragging] = useState(false);

  async function read(selected: File | undefined) {
    if (selected) onFile({ name: selected.name, text: await selected.text() });
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void read(event.dataTransfer.files[0]);
  }

  return (
    <label
      htmlFor="csv"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 transition-colors hover:bg-muted/50",
        dragging && "border-primary bg-muted/50",
      )}
    >
      {file ? <FileSpreadsheet className="size-6 shrink-0 text-muted-foreground" /> : <FileUp className="size-6 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium">{file ? file.name : "Choose or drop a Toggl CSV"}</p>
        <p className="text-xs text-muted-foreground">{file ? summary : "Toggl Track “Detailed report” CSV export"}</p>
      </div>
      <input
        id="csv"
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          void read(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}
