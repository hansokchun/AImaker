import { createHash } from "node:crypto";
import { rmSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

import { cleanupDeadSuiteRoots, suiteTempPrefix } from "./schema-preflight-temp-cleanup.mjs";

await cleanupDeadSuiteRoots();
export const suiteTempRoot = await mkdtemp(path.join(tmpdir(), `${suiteTempPrefix}${process.pid}-`));
await writeFile(path.join(suiteTempRoot, "owner.pid"), `${process.pid}\n`);
let tempSequence = 0;

export const cleanupSuiteTemp = () => rmSync(suiteTempRoot, { recursive: true, force: true });
process.once("exit", cleanupSuiteTemp);

export async function createTempDirectory(label) {
  const directory = path.join(suiteTempRoot, `${String(tempSequence).padStart(3, "0")}-${label}`);
  tempSequence += 1;
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  return directory;
}

export async function createFixture() {
  const fixtureRoot = await createTempDirectory("fixture");
  const baselineSql =
    "create table public.profiles (id uuid, account_status text not null default 'active');\n" +
    "create table public.admin_users (user_id uuid);\n" +
    "create table public.admin_actions (id uuid);\n" +
    "create function public.is_admin() returns boolean language sql as $$ select true $$;\n";
  await writeFile(path.join(fixtureRoot, "baseline.sql"), baselineSql);
  await writeFile(path.join(fixtureRoot, "database.sql"), baselineSql);
  await mkdir(path.join(fixtureRoot, "migrations"));
  await mkdir(path.join(fixtureRoot, "migration-history"));
  await writeFile(path.join(fixtureRoot, "migrations", "000_baseline.sql"), baselineSql);
  const migrationSql = "select 1;\n";
  await writeFile(path.join(fixtureRoot, "migrations", "001_test.sql"), migrationSql);
  await writeFile(path.join(fixtureRoot, "migration-history", "001_test.sql"), migrationSql);
  const fixtureJson = '{"synthetic":true,"localOnly":true,"credentialsIncluded":false,"fixtures":[]}\n';
  await writeFile(path.join(fixtureRoot, "roles.json"), fixtureJson);
  const seedSql = "select 1;\n";
  await writeFile(path.join(fixtureRoot, "roles.sql"), seedSql);

  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const sha256 = hash(baselineSql);
  const manifest = {
    version: 1,
    mode: "static-preflight-only",
    databaseSnapshot: { path: "database.sql", sha256 },
    baseline: {
      strategy: "baseline-plus-preserved-history",
      runtimeReplayStatus: "not-verified-until-task-06",
      migration: { path: "migrations/000_baseline.sql", file: "000_baseline.sql", sha256 },
      sources: [{ path: "baseline.sql", sha256 }],
      requirements: {
        objects: [
          {
            name: "public.profiles.account_status",
            pattern: "create\\\\s+table\\\\s+public\\\\.profiles[\\\\s\\\\S]*?account_status\\\\s+text\\\\s+not\\\\s+null\\\\s+default",
          },
          {
            name: "public.admin_actions",
            pattern: "create\\\\s+table\\\\s+public\\\\.admin_actions",
          },
        ],
        dependencies: [],
      },
    },
    migrationDirectory: "migrations",
    archivedMigrationDirectory: "migration-history",
    migrations: [{ version: "001", file: "001_test.sql", sha256: hash(migrationSql) }],
    fixtures: {
      manifest: "roles.json",
      manifestSha256: hash(fixtureJson),
      seed: "roles.sql",
      seedSha256: hash(seedSql),
      requiredRoles: [],
    },
    requirements: {
      objects: [
        { name: "public.profiles", pattern: "create\\s+table\\s+public\\.profiles" },
        { name: "public.admin_users", pattern: "create\\s+table\\s+public\\.admin_users" },
      ],
      dependencies: [{
        prerequisite: "create\\s+table\\s+public\\.admin_users",
        dependent: "create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.is_admin",
      }],
    },
  };
  const manifestPath = path.join(fixtureRoot, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifestPath, rootDir: fixtureRoot };
}
