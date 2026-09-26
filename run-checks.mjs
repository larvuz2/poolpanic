// Runs every *-check.mjs regression script and reports a compact summary.
// Usage: node run-checks.mjs [name-filter]
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const filter = process.argv[2] || "";
const checks = readdirSync(".")
  .filter((f) => f.endsWith("-check.mjs") && f.includes(filter))
  .sort();
let failed = 0;
for (const file of checks) {
  const started = Date.now();
  const run = spawnSync(process.execPath, [file], { encoding: "utf8", env: process.env });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const ok = run.status === 0;
  if (!ok) failed++;
  const last = (ok ? run.stdout : run.stderr || run.stdout).trim().split("\n").filter(Boolean);
  console.log(`${ok ? "PASS" : "FAIL"}  ${file.padEnd(28)} ${seconds.padStart(5)}s  ${(last.at(-1) || "").slice(0, 110)}`);
  if (!ok) console.log((run.stderr || run.stdout).trim().split("\n").slice(0, 25).join("\n") + "\n");
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
process.exit(failed ? 1 : 0);
