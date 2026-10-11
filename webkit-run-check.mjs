// tools/webkit-run.py runs the game in a real WebKit (WebKitGTK) where it is installed, which no machine that runs the suite has, so this
// only keeps the tool from rotting: it must parse (Python's own parser, nothing written to disk), say how to install and run itself, and be
// the one the README and CLAUDE.md point to. Where there is no python3 the parse is skipped and said so.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const tool = readFileSync("tools/webkit-run.py", "utf8");

// 1. It is a Python 3 script that can be run on its own, and says what it is for and how to use it.
assert.ok(tool.startsWith("#!/usr/bin/env python3\n"), "a script that runs on its own");
for (const word of [
  "WebKitGTK",
  "xvfb",
  "libwebkit2gtk-4.1-0",
  "gir1.2-webkit2-4.1",
  "python3-gi",
  "pulseaudio",
  "--audio",
  "--size",
  "--js",
  "norender",
  "jetsam",
])
  assert.ok(tool.includes(word), "the tool's own notes mention " + word);

// 2. It says why a run ended and keeps to its exit codes (0 alive at the end, 3 the web process ended, 2 bad usage).
assert.ok(tool.includes("web-process-terminated"), "it listens for the web process dying");
assert.ok(
  tool.includes("sys.exit(2)") && tool.includes("return 0 if") && tool.includes("else 3"),
  "exit codes 0, 2 and 3",
);
// The page can be asked for what the game says about itself, which needs ?debug: the game still offers it.
const app = readFileSync("dist/app.mjs", "utf8");
assert.ok(
  app.includes("window.__pool = {") && /has\("debug"\)/.test(app),
  "?debug still exposes window.__pool",
);
for (const part of ["mode", "sim"])
  assert.ok(new RegExp("get " + part + "\\(").test(app), "__pool still has " + part);

// 3. It parses.
const python = spawnSync(
  "python3",
  ["-c", "import ast, sys; ast.parse(open(sys.argv[1]).read())", "tools/webkit-run.py"],
  {
    encoding: "utf8",
  },
);
let parsed = "skipped (no python3)";
if (python.error?.code !== "ENOENT") {
  assert.equal(python.status, 0, "tools/webkit-run.py parses as Python 3:\n" + python.stderr);
  parsed = "parses";
}

// 4. The notes that send a reader to it are still there.
const readme = readFileSync("README.md", "utf8"),
  claude = readFileSync("CLAUDE.md", "utf8");
assert.ok(
  readme.includes("`tools/webkit-run.py`") && readme.includes("Running the game in a real WebKit"),
  "the README describes it",
);
assert.ok(claude.includes("tools/webkit-run.py"), "CLAUDE.md points to it");

console.log(
  `webkit-run-check: the WebKit runner's notes, exit codes and hooks are in place; the script ${parsed}.`,
);
