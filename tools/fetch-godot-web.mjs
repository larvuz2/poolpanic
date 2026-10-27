// The Netlify build's last step (netlify.toml, after the checks): puts the Godot test's web build (godot/README.md, "The web
// build") at dist/godot/, so the site can offer it next to the game (dist/engine-pick.mjs), and writes dist/godot-web.mjs to
// say which build it is. GitHub Actions exports it (.github/workflows/godot-test-build.yml) onto the rolling `godot-latest`
// release; this waits a few minutes for the one made from this commit's godot/ folder (the same git tree), then takes what is
// there. It never fails a build: with no web build the site is the game alone, as before.
//   node tools/fetch-godot-web.mjs              (in the Netlify build)
//   GODOT_WEB_WAIT=0 node tools/fetch-godot-web.mjs   (take what is there now)
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync, statSync } from "node:fs";

const RELEASE =
  process.env.GODOT_WEB_RELEASE || "https://github.com/larvuz2/poolpanic/releases/download/godot-latest/";
const DIST = new URL("../dist/", import.meta.url);
const OUT = new URL("./godot/", DIST);
const MARK = new URL("./godot-web.mjs", DIST);
const WAIT_MS = Number(process.env.GODOT_WEB_WAIT ?? 8 * 60) * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tree() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD:godot"], { encoding: "utf8" }).trim();
  } catch {
    return ""; // no git here: take whichever build the release has
  }
}

async function info() {
  try {
    const res = await fetch(RELEASE + "godot-web.json?t=" + Date.now(), { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function mark(build) {
  writeFileSync(
    MARK,
    "// Written by tools/fetch-godot-web.mjs in the Netlify build: the Godot test's web build at ./godot/, or null.\n" +
      "export const GODOT_WEB = " +
      JSON.stringify(build) +
      ";\n",
  );
}

try {
  const want = tree();
  const until = Date.now() + WAIT_MS;
  let got = await info();
  while (want && Date.now() < until && got?.tree !== want) {
    console.log(
      `fetch-godot-web: waiting for the web build of godot/ ${want.slice(0, 7)} (the release has ${got?.tree?.slice(0, 7) ?? "none"})`,
    );
    await sleep(20000);
    got = (await info()) ?? got;
  }
  if (!got?.file) {
    console.log("fetch-godot-web: no web build on the release; the site stays the game alone.");
  } else {
    const res = await fetch(RELEASE + got.file + "?t=" + Date.now());
    if (!res.ok) throw new Error(`download ${got.file}: ${res.status}`);
    const archive = new URL("../godot-web.tar.gz", DIST);
    writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(OUT, { recursive: true });
    execFileSync("tar", ["-xzf", archive.pathname, "-C", OUT.pathname]);
    rmSync(archive, { force: true });
    for (const f of ["index.html", "index.wasm", "index.pck", "index.js"])
      if (!existsSync(new URL(f, OUT))) throw new Error(`the web build has no ${f}`);
    const mb = (statSync(new URL("index.wasm", OUT)).size + statSync(new URL("index.pck", OUT)).size) / 1e6;
    const build = {
      commit: got.commit,
      tree: got.tree,
      built: got.built,
      fresh: !want || got.tree === want,
      mb: Math.round(mb),
    };
    mark(build);
    console.log("fetch-godot-web: dist/godot/ is", JSON.stringify(build));
  }
} catch (e) {
  rmSync(OUT, { recursive: true, force: true });
  mark(null);
  console.warn("fetch-godot-web: skipped (" + e.message + "); the site stays the game alone.");
}
