import assert from "node:assert/strict";
import { readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

import { analyzeSqlBundle, runPreflight } from "./schema-preflight-lib.mjs";
import { cleanupSuiteTemp, createFixture, createTempDirectory, suiteTempRoot } from "./schema-preflight-test-support.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
test.after(cleanupSuiteTemp);

test("Given historical migrations only, when bootstrap is inspected, then profiles is reported missing", async () => {
  // Given
  const manifest = JSON.parse(
    await readFile(path.join(rootDir, "supabase", "baseline.manifest.json"), "utf8"),
  );
  const migrationSql = await Promise.all(
    manifest.migrations.map(async (migration) =>
      readFile(path.join(rootDir, manifest.archivedMigrationDirectory, migration.file), "utf8"),
    ),
  );

  // When
  const result = analyzeSqlBundle(migrationSql.join("\n"), manifest.requirements);

  // Then
  assert.ok(result.errors.some((error) => error.code === "REQUIRED_OBJECT_MISSING"));
});

test("Given fake DDL inside SQL literals, when bootstrap is inspected, then objects remain missing", () => {
  // Given
  const sql = "select $$create table public.profiles (id uuid)$$, 'create table public.admin_users (id uuid)';";
  const requirements = {
    objects: [
      { name: "public.profiles", pattern: "create\\s+table\\s+public\\.profiles" },
      { name: "public.admin_users", pattern: "create\\s+table\\s+public\\.admin_users" },
    ],
    dependencies: [],
  };

  // When
  const result = analyzeSqlBundle(sql, requirements);

  // Then
  assert.equal(result.errors.filter((error) => error.code === "REQUIRED_OBJECT_MISSING").length, 2);
});

test("Given an artifact path through a junction, when preflight runs, then realpath escape fails", async (t) => {
  // Given
  const fixture = await createFixture();
  const outside = await createTempDirectory("outside");
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, "database.sql"), "select 1;\n");
  await symlink(outside, path.join(fixture.rootDir, "outside-link"), "junction");
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  manifest.databaseSnapshot.path = "outside-link/database.sql";
  const { createHash } = await import("node:crypto");
  manifest.databaseSnapshot.sha256 = createHash("sha256").update("select 1;\n").digest("hex");
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // When
  const report = await runPreflight(fixture);

  // Then
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "MANIFEST_INVALID"));
});

test("Given an unknown baseline strategy or runtime status, when preflight runs, then manifest fails", async (t) => {
  // Given
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  manifest.baseline.strategy = "assume-idempotent";
  manifest.baseline.runtimeReplayStatus = "verified";
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // When
  const report = await runPreflight(fixture);

  // Then
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "MANIFEST_INVALID"));
});

test("Given baseline and preserved history plus an undeclared active effect, when preflight runs, then replay is incoherent", async (t) => {
  // Given
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  manifest.baseline.strategy = "baseline-plus-preserved-history";
  manifest.baseline.runtimeReplayStatus = "not-verified-until-task-06";
  await writeFile(path.join(fixture.rootDir, "migrations", "002_undeclared.sql"), "select 2;\n");
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // When
  const report = await runPreflight(fixture);

  // Then
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "REPLAY_ORDER_INCOHERENT"));
});

test("Given a killed child suite, when the next suite starts, then dead-owner roots are recovered", async () => {
  // Given
  const probe = path.join(rootDir, "scripts", "schema-preflight-suite-probe.mjs");

  // When
  for (let index = 0; index < 3; index += 1) {
    const child = spawn(process.execPath, [probe], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    const ready = String((await once(child.stdout, "data"))[0]).trim();
    const childRoot = ready.slice("READY ".length);
    child.kill("SIGKILL");
    const [code, signal] = await once(child, "exit");
    assert.equal(code, null);
    assert.equal(signal, "SIGKILL");
    const recovery = spawnSync(process.execPath, [path.join(rootDir, "scripts", "schema-preflight.mjs"), "--help"], { cwd: rootDir, encoding: "utf8" });
    assert.equal(recovery.status, 0, recovery.stderr);
    await assert.rejects(stat(childRoot));
    assert.ok(await stat(suiteTempRoot));
  }
});

test("Given the project manifest, when preflight runs twice, then hashes are identical", async () => {
  // Given
  const manifestPath = path.join(rootDir, "supabase", "baseline.manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  for (const migration of manifest.migrations) {
    const active = await readFile(path.join(rootDir, manifest.migrationDirectory, migration.file));
    const archived = await readFile(path.join(rootDir, manifest.archivedMigrationDirectory, migration.file));
    assert.deepEqual(active, archived);
  }

  // When
  const first = await runPreflight({ manifestPath, rootDir });
  const second = await runPreflight({ manifestPath, rootDir });

  // Then
  assert.equal(first.ok, true);
  assert.deepEqual(first.hashes, second.hashes);
});

test("Given the settlement-paid notification migration, when it is inspected, then one settlement can queue the notification once", async () => {
  // Given
  const manifestPath = path.join(rootDir, "supabase", "baseline.manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const migration = manifest.migrations.find((entry) =>
    entry.file.endsWith("_ensure_settlement_paid_notification_idempotency.sql"),
  );

  // When
  const sql = migration
    ? await readFile(path.join(rootDir, manifest.migrationDirectory, migration.file), "utf8")
    : "";

  // Then
  assert.ok(migration);
  assert.match(
    sql,
    /create unique index if not exists notification_events_settlement_paid_unique_idx\s+on public\.notification_events \(event_type, related_type, related_id\)\s+where event_type = 'settlement_paid' and related_type = 'settlement';/i,
  );
});

test("Given a missing profiles definition, when preflight runs, then it fails closed", async (t) => {
  // Given
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  await writeFile(path.join(fixture.rootDir, "baseline.sql"), "create table public.admin_users (user_id uuid);\n");

  // When
  const report = await runPreflight(fixture);

  // Then
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "REQUIRED_OBJECT_MISSING"));
});

test("Given a baseline without profiles.account_status, when preflight runs, then it fails before preserved hardening migrations", async (t) => {
  // Given
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  const baselinePath = path.join(fixture.rootDir, "baseline.sql");
  const cliBaselinePath = path.join(fixture.rootDir, "migrations", "000_baseline.sql");
  const baselineSql = (await readFile(baselinePath, "utf8")).replace(
    ", account_status text not null default 'active'",
    "",
  );
  const { createHash } = await import("node:crypto");
  const baselineSha256 = createHash("sha256").update(baselineSql).digest("hex");
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  manifest.baseline.sources[0].sha256 = baselineSha256;
  manifest.baseline.migration.sha256 = baselineSha256;
  await writeFile(baselinePath, baselineSql);
  await writeFile(cliBaselinePath, baselineSql);
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // When
  const report = await runPreflight(fixture);

  // Then
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "REQUIRED_OBJECT_MISSING" && error.message.includes("profiles.account_status")));
});

test("Given a baseline without admin_actions, when preflight runs, then it fails before preserved hardening migrations", async (t) => {
  // Given
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  const baselinePath = path.join(fixture.rootDir, "baseline.sql");
  const cliBaselinePath = path.join(fixture.rootDir, "migrations", "000_baseline.sql");
  const baselineSql = (await readFile(baselinePath, "utf8")).replace(
    "create table public.admin_actions (id uuid);\n",
    "",
  );
  const { createHash } = await import("node:crypto");
  const baselineSha256 = createHash("sha256").update(baselineSql).digest("hex");
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  manifest.baseline.sources[0].sha256 = baselineSha256;
  manifest.baseline.migration.sha256 = baselineSha256;
  await writeFile(baselinePath, baselineSql);
  await writeFile(cliBaselinePath, baselineSql);
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // When
  const report = await runPreflight(fixture);

  // Then
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "REQUIRED_OBJECT_MISSING" && error.message.includes("public.admin_actions")));
});

test("Given is_admin before admin_users, when preflight runs, then dependency order fails", async (t) => {
  // Given
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  await writeFile(
    path.join(fixture.rootDir, "baseline.sql"),
    "create function public.is_admin() returns boolean language sql as $$ select true $$;\n" +
      "create table public.profiles (id uuid);\n" +
      "create table public.admin_users (user_id uuid);\n",
  );

  // When
  const report = await runPreflight(fixture);

  // Then
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "DEPENDENCY_ORDER_INVALID"));
});

test("Given a stale snapshot hash, when preflight runs, then parity fails", async (t) => {
  // Given
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  const manifestPath = fixture.manifestPath;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.databaseSnapshot.sha256 = "0".repeat(64);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // When
  const report = await runPreflight(fixture);

  // Then
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "SNAPSHOT_DRIFT"));
});

test("Given migration order drift, when preflight runs, then ordering fails", async (t) => {
  // Given
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  await writeFile(path.join(fixture.rootDir, "migration-history", "002_test.sql"), "select 2;\n");
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  manifest.migrations = [
    { version: "002", file: "002_test.sql" },
    { version: "001", file: "001_test.sql" },
  ];
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // When
  const report = await runPreflight(fixture);

  // Then
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "MIGRATION_ORDER_INVALID"));
});

test("Given an undeclared migration, when preflight runs, then set drift fails", async (t) => {
  // Given
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  await writeFile(path.join(fixture.rootDir, "migration-history", "002_extra.sql"), "select 2;\n");

  // When
  const report = await runPreflight(fixture);

  // Then
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "MIGRATION_SET_DRIFT"));
});

test("Given a credential column in the seed, when preflight runs, then fixture safety fails", async (t) => {
  // Given
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  await writeFile(path.join(fixture.rootDir, "roles.sql"), "insert into auth.users (encrypted_password) values ('hash');\n");

  // When
  const report = await runPreflight(fixture);

  // Then
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "FIXTURE_CREDENTIAL_DETECTED"));
});

test("Given swapped role-to-user bindings, when preflight runs, then fixture semantics fail", async (t) => {
  // Given
  const fixture = await createFixture();
  t.after(() => rm(fixture.rootDir, { recursive: true, force: true }));
  const fixtureJson = JSON.stringify({
    synthetic: true,
    localOnly: true,
    credentialsIncluded: false,
    fixtures: [
      { role: "client", userId: "10000000-0000-4000-8000-000000000001", accountStatus: "active", isExpert: false, isAdmin: false },
      { role: "expert", userId: "10000000-0000-4000-8000-000000000002", accountStatus: "active", isExpert: true, isAdmin: false },
    ],
  });
  const seedSql =
    "('10000000-0000-4000-8000-000000000001', '{\"fixtureRole\":\"expert\"}'),\n" +
    "('10000000-0000-4000-8000-000000000002', '{\"fixtureRole\":\"client\"}');\n" +
    "('10000000-0000-4000-8000-000000000001', 'mail', 'name', 'name', false, 'active'),\n" +
    "('10000000-0000-4000-8000-000000000002', 'mail', 'name', 'name', true, 'active');\n" +
    "insert into public.expert_profiles values ('10000000-0000-4000-8000-000000000002');\n";
  const { createHash } = await import("node:crypto");
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  await writeFile(path.join(fixture.rootDir, "roles.json"), fixtureJson);
  await writeFile(path.join(fixture.rootDir, "roles.sql"), seedSql);
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  manifest.fixtures.manifestSha256 = hash(fixtureJson);
  manifest.fixtures.seedSha256 = hash(seedSql);
  manifest.fixtures.requiredRoles = ["client", "expert"];
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // When
  const report = await runPreflight(fixture);

  // Then
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "FIXTURE_SEED_DRIFT"));
});

test("Given malformed JSON, when the CLI runs, then it exits without a success marker", async (t) => {
  // Given
  const fixtureRoot = await createTempDirectory("cli");
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const manifestPath = path.join(fixtureRoot, "manifest.json");
  await writeFile(manifestPath, "{not-json\n");

  // When
  const result = spawnSync(process.execPath, [
    path.join(rootDir, "scripts", "schema-preflight.mjs"),
    "--manifest",
    manifestPath,
  ], { cwd: fixtureRoot, encoding: "utf8" });

  // Then
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SCHEMA_PREFLIGHT_FAILED/);
  assert.doesNotMatch(result.stdout, /SCHEMA_PREFLIGHT_OK/);
});

test("Given the help flag, when the CLI runs, then usage is observable", () => {
  // Given
  const cliPath = path.join(rootDir, "scripts", "schema-preflight.mjs");

  // When
  const result = spawnSync(process.execPath, [cliPath, "--help"], { cwd: rootDir, encoding: "utf8" });

  // Then
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /never connects to a database/);
});
