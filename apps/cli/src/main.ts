#!/usr/bin/env -S npx tsx
import { run } from "./run.ts";

// `pnpm attendance ...` runs from the workspace root; INIT_CWD is where the user typed the command.
const cwd = process.env.INIT_CWD ?? process.cwd();

process.exitCode = await run(process.argv.slice(2), {
  cwd,
  out: (line) => console.log(line),
  err: (line) => console.error(line),
});
