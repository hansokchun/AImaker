import path from "node:path";
import process from "node:process";

import { runPreflight } from "./schema-preflight-lib.mjs";
import { cleanupDeadSuiteRoots } from "./schema-preflight-temp-cleanup.mjs";

const usage = "Usage: node scripts/schema-preflight.mjs [--manifest supabase/baseline.manifest.json]";
await cleanupDeadSuiteRoots();

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write(`${usage}\nStatic validation only; this command never connects to a database.\n`);
  process.exit(0);
}

const args = process.argv.slice(2);
if (args.length > 2 || (args.length > 0 && args[0] !== "--manifest") || (args[0] === "--manifest" && !args[1])) {
  process.stderr.write(`${usage}\n`);
  process.exit(2);
}

const rootDir = process.cwd();
const manifestPath = path.resolve(rootDir, args[1] ?? "supabase/baseline.manifest.json");
const report = await runPreflight({ manifestPath, rootDir });
if (!report.ok) {
  process.stderr.write(`SCHEMA_PREFLIGHT_FAILED\n${JSON.stringify(report.errors, null, 2)}\n`);
  process.exit(1);
}

process.stdout.write(`SCHEMA_PREFLIGHT_OK mode=${report.mode} worktree=${report.worktree}\n${JSON.stringify(report.hashes, null, 2)}\n`);
