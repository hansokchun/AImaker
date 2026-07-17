import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

const shaPattern = /^[a-f0-9]{64}$/;

export function analyzeSqlBundle(sql, requirements) {
  const searchableSql = maskSqlLiterals(sql);
  const errors = [];
  for (const object of requirements.objects) {
    if (!new RegExp(object.pattern, "i").test(searchableSql)) {
      errors.push(issue("REQUIRED_OBJECT_MISSING", `${object.name} is not defined`));
    }
  }
  for (const dependency of requirements.dependencies) {
    const prerequisite = searchableSql.search(new RegExp(dependency.prerequisite, "i"));
    const dependent = searchableSql.search(new RegExp(dependency.dependent, "i"));
    if (prerequisite < 0 || dependent < 0 || prerequisite > dependent) {
      errors.push(issue("DEPENDENCY_ORDER_INVALID", dependency.name ?? "SQL dependency is out of order"));
    }
  }
  return { errors };
}

export async function runPreflight({ manifestPath, rootDir }) {
  const errors = [];
  const hashes = {};
  try {
    const manifestFile = await safePath(rootDir, path.relative(rootDir, manifestPath));
    const manifestBytes = await readFile(manifestFile);
    hashes.manifest = sha256(manifestBytes);
    const manifest = parseManifest(manifestBytes.toString("utf8"));

    const snapshotBytes = await checkedFile(rootDir, manifest.databaseSnapshot, errors);
    if (snapshotBytes) {
      hashes.snapshot = sha256(snapshotBytes);
      if (hashes.snapshot !== manifest.databaseSnapshot.sha256) {
        errors.push(issue("SNAPSHOT_DRIFT", "database snapshot hash does not match the manifest"));
      }
    }

    const baselineParts = [];
    for (const source of manifest.baseline.sources) {
      const entry = typeof source === "string" ? { path: source } : source;
      const bytes = await checkedFile(rootDir, entry, errors);
      if (bytes) baselineParts.push(bytes);
    }
    const baselineBytes = Buffer.concat(baselineParts);
    hashes.baseline = sha256(baselineBytes);
    errors.push(...analyzeSqlBundle(baselineBytes.toString("utf8"), manifest.baseline.requirements).errors);
    const cliBaselineBytes = await checkedFile(rootDir, manifest.baseline.migration, errors);
    hashes.cliBaseline = sha256(cliBaselineBytes);
    const declaredSql = baselineBytes.toString("utf8").replace(/\r\n/g, "\n").trimEnd();
    const materializedSql = cliBaselineBytes.toString("utf8").replace(/\r\n/g, "\n").trimEnd();
    if (declaredSql !== materializedSql) {
      errors.push(issue("BASELINE_MATERIALIZATION_DRIFT", "CLI baseline does not match its declared sources"));
    }

    const migrationDir = await safePath(rootDir, manifest.migrationDirectory);
    const discovered = (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort();
    const declared = manifest.migrations.map((migration) => migration.file);
    const expectedActive = [manifest.baseline.migration.file, ...declared];
    if (JSON.stringify(discovered) !== JSON.stringify(expectedActive)) {
      errors.push(issue("REPLAY_ORDER_INCOHERENT", "active migrations must contain the baseline followed by all preserved history"));
    }
    const archiveDir = await safePath(rootDir, manifest.archivedMigrationDirectory);
    const archived = (await readdir(archiveDir)).filter((file) => file.endsWith(".sql")).sort();
    if (JSON.stringify(archived) !== JSON.stringify([...declared].sort())) {
      errors.push(issue("MIGRATION_SET_DRIFT", "declared history does not match the migration archive"));
    }
    if (declared.length === 0 || new Set(declared).size !== declared.length) {
      errors.push(issue("MIGRATION_MANIFEST_INVALID", "migration files must be non-empty and unique"));
    }
    const versions = manifest.migrations.map((migration) => migration.version);
    if (new Set(versions).size !== versions.length || JSON.stringify(versions) !== JSON.stringify([...versions].sort())) {
      errors.push(issue("MIGRATION_ORDER_INVALID", "migration versions must be unique and ascending"));
    }
    const migrationHashes = [];
    const replayParts = [baselineBytes];
    for (const migration of manifest.migrations) {
      if (!migration.file.startsWith(`${migration.version}_`)) {
        errors.push(issue("MIGRATION_VERSION_MISMATCH", migration.file));
      }
      const bytes = await checkedFile(rootDir, {
        path: path.posix.join(manifest.archivedMigrationDirectory, migration.file),
        sha256: migration.sha256,
      }, errors);
      await checkedFile(rootDir, {
        path: path.posix.join(manifest.migrationDirectory, migration.file),
        sha256: migration.sha256,
      }, errors);
      if (bytes) {
        migrationHashes.push(sha256(bytes));
        replayParts.push(bytes);
      }
    }
    errors.push(...analyzeSqlBundle(Buffer.concat(replayParts).toString("utf8"), manifest.requirements).errors);
    hashes.migrations = sha256(migrationHashes.join("\n"));

    const fixtureBytes = await checkedFile(rootDir, {
      path: manifest.fixtures.manifest,
      sha256: manifest.fixtures.manifestSha256,
    }, errors);
    const seedBytes = await checkedFile(rootDir, {
      path: manifest.fixtures.seed,
      sha256: manifest.fixtures.seedSha256,
    }, errors);
    if (fixtureBytes) {
      hashes.fixtures = sha256(fixtureBytes);
      errors.push(...inspectFixtures(fixtureBytes.toString("utf8"), manifest.fixtures.requiredRoles));
    }
    if (seedBytes) {
      hashes.seed = sha256(seedBytes);
      errors.push(...inspectSeed(seedBytes.toString("utf8"), fixtureBytes?.toString("utf8")));
    }
    hashes.order = sha256(JSON.stringify({
      baseline: manifest.baseline.sources.map((source) => typeof source === "string" ? source : source.path),
      migrations: declared,
      fixture: manifest.fixtures.manifest,
      seed: manifest.fixtures.seed,
    }));
  } catch (error) {
    errors.push(issue("MANIFEST_INVALID", error instanceof Error ? error.message : "unknown manifest error"));
  }
  const gitStatus = spawnSync("git", ["status", "--porcelain"], { cwd: rootDir, encoding: "utf8" });
  const worktree = gitStatus.status === 0 ? (gitStatus.stdout.trim() ? "dirty" : "clean") : "unknown";
  return { ok: errors.length === 0, mode: "static-preflight-only", worktree, hashes, errors };
}

function parseManifest(text) {
  const value = JSON.parse(text);
  if (!value || value.version !== 1 || value.mode !== "static-preflight-only") throw new Error("unsupported manifest version or mode");
  if (!value.databaseSnapshot || !value.baseline || !Array.isArray(value.baseline.sources)) throw new Error("missing baseline fields");
  if (!value.baseline.migration) throw new Error("missing CLI baseline migration");
  if (!value.baseline.requirements) throw new Error("missing baseline requirements");
  if (value.baseline.strategy !== "baseline-plus-preserved-history") throw new Error("unsupported baseline strategy");
  if (value.baseline.runtimeReplayStatus !== "not-verified-until-task-06") throw new Error("unsupported runtime replay status");
  if (typeof value.migrationDirectory !== "string" || typeof value.archivedMigrationDirectory !== "string") throw new Error("missing migration directories");
  if (!Array.isArray(value.migrations) || !value.fixtures || !value.requirements) throw new Error("missing manifest collections");
  return value;
}

async function checkedFile(rootDir, entry, errors) {
  if (!entry || typeof entry.path !== "string") throw new Error("artifact path is missing");
  if (!shaPattern.test(entry.sha256)) throw new Error(`${entry.path} hash is missing or malformed`);
  const bytes = await readFile(await safePath(rootDir, entry.path));
  if (entry.sha256 && sha256(bytes) !== entry.sha256) {
    errors.push(issue("ARTIFACT_DRIFT", `${entry.path} hash does not match the manifest`));
  }
  return bytes;
}

function inspectFixtures(text, requiredRoles) {
  const fixtureManifest = JSON.parse(text);
  const errors = [];
  if (fixtureManifest.synthetic !== true || fixtureManifest.localOnly !== true || fixtureManifest.credentialsIncluded !== false) {
    errors.push(issue("FIXTURE_SAFETY_INVALID", "fixtures must be synthetic and credential-free"));
  }
  const roles = fixtureManifest.fixtures?.map((fixture) => fixture.role) ?? [];
  if (JSON.stringify([...roles].sort()) !== JSON.stringify([...requiredRoles].sort()) || new Set(roles).size !== roles.length) {
    errors.push(issue("FIXTURE_ROLE_SET_INVALID", "fixture roles do not match the required set"));
  }
  const ids = fixtureManifest.fixtures?.map((fixture) => fixture.userId).filter(Boolean) ?? [];
  if (new Set(ids).size !== ids.length || fixtureManifest.fixtures?.find((fixture) => fixture.role === "anon")?.userId !== null) {
    errors.push(issue("FIXTURE_IDENTITY_INVALID", "fixture identities must be unique and anon must have no user id"));
  }
  if (/password|token|api[_-]?key|service[_-]?role|secret/i.test(text)) {
    errors.push(issue("FIXTURE_SECRET_FIELD", "fixture manifest contains a credential-like field"));
  }
  return errors;
}

function inspectSeed(seedSql, fixtureText) {
  const errors = [];
  if (/encrypted_password|password|refresh_token|access_token|service_role|api[_-]?key|secret/i.test(seedSql)) {
    errors.push(issue("FIXTURE_CREDENTIAL_DETECTED", "fixture seed contains a credential-like field"));
  }
  if (fixtureText) {
    const fixtureManifest = JSON.parse(fixtureText);
    const expectedIds = fixtureManifest.fixtures.map((fixture) => fixture.userId).filter(Boolean).sort();
    const seededIds = [...new Set(seedSql.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}/gi) ?? [])].sort();
    if (JSON.stringify(expectedIds) !== JSON.stringify(seededIds)) {
      errors.push(issue("FIXTURE_SEED_DRIFT", "fixture seed identities do not match the fixture manifest"));
    }
    const authBindings = new Map([...seedSql.matchAll(/^\s*\('([0-9a-f-]{36})'.*"fixtureRole":"([a-z]+)".*$/gmi)]
      .map((match) => [match[1], match[2]]));
    const profileBindings = new Map([...seedSql.matchAll(/^\s*\('([0-9a-f-]{36})',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*(true|false),\s*'(active|restricted)'/gmi)]
      .map((match) => [match[1], { isExpert: match[2] === "true", accountStatus: match[3] }]));
    const adminSection = seedSql.match(/insert\s+into\s+public\.admin_users[\s\S]*?(?=insert\s+into|$)/i)?.[0] ?? "";
    const expertSection = seedSql.match(/insert\s+into\s+public\.expert_profiles[\s\S]*?(?=insert\s+into|$)/i)?.[0] ?? "";
    const adminIds = new Set(adminSection.match(/[0-9a-f-]{36}/gi) ?? []);
    const expertIds = new Set(expertSection.match(/[0-9a-f-]{36}/gi) ?? []);
    for (const fixture of fixtureManifest.fixtures.filter((entry) => entry.role !== "anon")) {
      const profile = profileBindings.get(fixture.userId);
      const matches = authBindings.get(fixture.userId) === fixture.role
        && profile?.accountStatus === fixture.accountStatus
        && profile?.isExpert === fixture.isExpert
        && adminIds.has(fixture.userId) === fixture.isAdmin
        && expertIds.has(fixture.userId) === fixture.isExpert;
      if (!matches) errors.push(issue("FIXTURE_SEED_DRIFT", `${fixture.role} does not match its seeded identity`));
    }
  }
  return errors;
}

function maskSqlLiterals(sql) {
  let result = "";
  for (let index = 0; index < sql.length;) {
    if (sql.startsWith("--", index)) {
      const end = sql.indexOf("\n", index);
      index = end < 0 ? sql.length : end;
      result += " ";
      continue;
    }
    if (sql.startsWith("/*", index)) {
      const end = sql.indexOf("*/", index + 2);
      index = end < 0 ? sql.length : end + 2;
      result += " ";
      continue;
    }
    const dollar = sql.slice(index).match(/^\$[A-Za-z_0-9]*\$/)?.[0];
    if (dollar) {
      const end = sql.indexOf(dollar, index + dollar.length);
      index = end < 0 ? sql.length : end + dollar.length;
      result += " ";
      continue;
    }
    if (sql[index] === "'") {
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") index += 2;
        else if (sql[index] === "'") { index += 1; break; }
        else index += 1;
      }
      result += " ";
      continue;
    }
    result += sql[index];
    index += 1;
  }
  return result;
}

async function safePath(rootDir, relativePath) {
  if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) throw new Error("paths must stay inside the project root");
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("path escapes project root");
  const realRoot = await realpath(root);
  const realResolved = await realpath(resolved);
  if (realResolved !== realRoot && !realResolved.startsWith(`${realRoot}${path.sep}`)) throw new Error("real path escapes project root");
  return realResolved;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function issue(code, message) {
  return { code, message };
}
