import { readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

export const suiteTempPrefix = "aiconnect-schema-preflight-node-tests-";

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function claimAndRemove(candidate) {
  const claim = path.join(tmpdir(), `.aiconnect-schema-preflight-cleanup-${process.pid}-${path.basename(candidate)}`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rename(candidate, claim);
      await rm(claim, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
      return;
    } catch (error) {
      if (error?.code === "ENOENT") return;
      if (error?.code !== "EPERM" || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}

export async function cleanupDeadSuiteRoots() {
  const staleBefore = Date.now() - 60 * 60 * 1000;
  for (const entry of await readdir(tmpdir(), { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(suiteTempPrefix)) continue;
    const candidate = path.join(tmpdir(), entry.name);
    const pidFromName = Number(entry.name.slice(suiteTempPrefix.length).split("-", 1)[0]);
    const marker = await readFile(path.join(candidate, "owner.pid"), "utf8").catch(() => "");
    const ownerPid = Number(marker.trim()) || pidFromName;
    if (Number.isSafeInteger(ownerPid) && ownerPid > 0) {
      if (!processIsAlive(ownerPid)) await claimAndRemove(candidate);
      continue;
    }
    const metadata = await stat(candidate).catch(() => null);
    if (metadata && metadata.mtimeMs < staleBefore) await claimAndRemove(candidate);
  }
}
