// Copies the game (../dist) into desktop/game, where the packaged app finds it, and stamps the build so a crash report names it.
//   node scripts/prepare-game.mjs [--tester]
// With --tester (or POOLPANIC_TESTER=1) the copy is a tester build: a tester.json beside the game turns playtest mode on and lets the app post the
// game's log to the report service (desktop/lib.cjs `readTester`), and the build says so in its reports. The Steam build is made without it.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "..", "dist");
const target = join(here, "..", "game");
if (!existsSync(join(source, "index.html"))) throw new Error("The game is not at " + source);

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true, filter: (file) => !file.endsWith(".DS_Store") });

// The same file Netlify stamps (stamp-version.mjs): `context: "steam"` tells a report it came from the desktop build.
const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: join(here, "..", ".."), encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};
const tester = process.argv.includes("--tester") || process.env.POOLPANIC_TESTER === "1";
const build = {
  commit: git("rev-parse", "--short", "HEAD") || "dev",
  context: tester ? "desktop-test" : "steam",
  branch: git("rev-parse", "--abbrev-ref", "HEAD"),
  built: new Date().toISOString().slice(0, 16).replace("T", " ") + "Z",
};
writeFileSync(
  join(target, "version.mjs"),
  "// Written by desktop/scripts/prepare-game.mjs.\nexport const BUILD = " + JSON.stringify(build) + ";\n",
);

if (tester)
  writeFileSync(
    join(target, "tester.json"),
    JSON.stringify({ reports: "https://poolpanic.netlify.app/api/report", query: "playtest" }, null, 2) +
      "\n",
  );

const size = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce(
    (sum, entry) =>
      sum + (entry.isDirectory() ? size(join(dir, entry.name)) : statSync(join(dir, entry.name)).size),
    0,
  );
mkdirSync(target, { recursive: true });
console.log(
  `Game copied to desktop/game (${(size(target) / 1048576).toFixed(1)} MB), build ${JSON.stringify(build)}${tester ? ", a tester build" : ""}`,
);
