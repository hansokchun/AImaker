import { createTempDirectory, suiteTempRoot } from "./schema-preflight-test-support.mjs";

await createTempDirectory("owned-by-child-suite");
process.stdout.write(`READY ${suiteTempRoot}\n`);
await new Promise(() => {});
