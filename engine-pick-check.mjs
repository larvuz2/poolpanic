// The engine choice on the web site (dist/engine-pick.mjs) and the build step that puts the Godot test there
// (tools/fetch-godot-web.mjs): the choice is asked only on the web with a Godot build, never in the desktop app, never with a
// query (?playtest, ?dev=1…) and never on a reload after choosing the game; a checkout has no Godot build; the game waits for
// the choice, and the boot watchdog does not call a waiting choice a failed start.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shouldAsk } from "./dist/engine-pick.mjs";
import { GODOT_WEB } from "./dist/godot-web.mjs";

const godot = { commit: "abc1234", tree: "t", built: "", fresh: true };

assert.equal(
  GODOT_WEB,
  null,
  "a checkout (and so the desktop app) has no Godot web build: the game starts as before",
);
assert.equal(shouldAsk({ godot: null }), false, "no Godot build, no question");
assert.equal(shouldAsk({ godot }), true, "the web site with a Godot build asks");
assert.equal(shouldAsk({ godot, search: "?" }), true);
assert.equal(shouldAsk({ godot, desktop: {} }), false, "never in the desktop app");
for (const search of ["?playtest", "?dev=1", "?bisect=play&playtest", "?debug", "?engine=three"])
  assert.equal(shouldAsk({ godot, search }), false, `${search} goes straight into the game`);
assert.equal(
  shouldAsk({ godot, reloaded: true, chosen: "three" }),
  false,
  "a reload after choosing the game stays in it",
);
assert.equal(shouldAsk({ godot, reloaded: true, chosen: "" }), true);
assert.equal(
  shouldAsk({ godot, reloaded: false, chosen: "three" }),
  true,
  "coming back to the address asks again",
);

const app = readFileSync("dist/app.mjs", "utf8");
assert.match(
  app.split("\n").find((l) => l.startsWith("import")),
  /^import "\.\/engine-pick\.mjs";$/,
  "app.mjs waits for it first",
);
const html = readFileSync("dist/index.html", "utf8");
assert.match(
  html,
  /if \(window\.__boot\.picking\) return watch\(\);/,
  "the boot watchdog waits while the choice is open",
);
const pick = readFileSync("dist/engine-pick.mjs", "utf8");
assert.match(pick, /location\.href = "godot\/"/);
assert.match(pick, /pick-three\.webp/);
assert.match(pick, /pick-godot\.webp/);
for (const art of ["pick-three.webp", "pick-godot.webp"]) readFileSync(`dist/assets/brand/${art}`);

const fetcher = readFileSync("tools/fetch-godot-web.mjs", "utf8");
assert.match(fetcher, /mark\(null\)/, "a failed fetch leaves the site the game alone");
assert.doesNotMatch(fetcher, /process\.exit\(1\)|throw e;/, "it never fails the Netlify build");
const toml = readFileSync("netlify.toml", "utf8");
assert.match(
  toml,
  /npm test && node tools\/fetch-godot-web\.mjs/,
  "the Godot build comes after the checks, which never see it",
);
assert.match(readFileSync(".gitignore", "utf8"), /^dist\/godot\/$/m);

console.log(
  "Engine choice checks passed: asked only on the web site with a Godot build (not in the app, not with a query, not on a reload after the game), the game waits for it, the build step never fails the deploy.",
);
