// The desktop shell for Steam (desktop/): which file a game address may mean (nothing outside the game's folder), what it is served as,
// which of the player's saved keys are mirrored to the file Steam Cloud syncs and what that file may hold, which links may leave the
// game, where a saved window may reappear, the Steam wrapper against a fake steamworks.js (it can never stop the game), and the
// settings that keep the window locked down and the uploads from going live by accident. Electron itself is not needed to run this.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lib = require("./desktop/lib.cjs");
const { NAME, TEST_APP_ID, createSteam, readConfig } = require("./desktop/steam.cjs");
const read = (file) => readFileSync(file, "utf8");

// ---- which file an address means -------------------------------------------------------------------------------------------
{
  const root = "/srv/game";
  const at = (url) => lib.resolveGameFile(root, url);
  assert.equal(at("app://game/index.html"), "/srv/game/index.html");
  assert.equal(at("app://game/"), "/srv/game/index.html", "the front door");
  assert.equal(at("app://game"), "/srv/game/index.html");
  assert.equal(
    at("app://game/assets/fish.glb?v=2#x"),
    "/srv/game/assets/fish.glb",
    "a query or a fragment is not part of the file",
  );
  assert.equal(
    at("app://game/assets/fonts/dm-sans-variable.woff2"),
    "/srv/game/assets/fonts/dm-sans-variable.woff2",
  );
  assert.equal(
    at("app://game//etc/passwd"),
    "/srv/game/etc/passwd",
    "a second slash is still inside the game",
  );
  // The address parser itself folds `..` (also written %2e%2e) into the path before the file is looked for, so a climb stays inside the folder:
  for (const climbing of [
    "app://game/../secret",
    "app://game/assets/../../secret",
    "app://game/%2e%2e/secret",
    "app://game/assets/%2E%2E/%2E%2E/secret",
  ])
    assert.equal(at(climbing), "/srv/game/secret", `a climb stays in the folder: ${climbing}`);
  // What it does not fold is turned down here: an encoded slash that decodes into a climb, a backslash, a NUL, or another address.
  for (const evil of [
    "app://game/%2e%2e%2fsecret",
    "app://game/assets/%2e%2e%2f%2e%2e%2fsecret",
    "app://game/..%5Csecret",
    "app://game/a%00b",
    "app://game/%",
    "app://other/index.html",
    "app://game.evil.com/index.html",
    "file:///etc/passwd",
    "https://game/index.html",
    "not an address",
    "",
  ])
    assert.equal(at(evil), null, `not served: ${evil}`);
  assert.equal(lib.GAME_ORIGIN, "app://game");
}

// ---- what it is served as ---------------------------------------------------------------------------------------------------
{
  assert.match(
    lib.mimeFor("a/b/app.mjs"),
    /^text\/javascript/,
    "modules are scripts, or the browser refuses them",
  );
  assert.match(lib.mimeFor("GLTFLoader.js"), /^text\/javascript/);
  assert.match(lib.mimeFor("index.html"), /^text\/html/);
  assert.match(lib.mimeFor("style.css"), /^text\/css/);
  assert.equal(lib.mimeFor("fish.glb"), "model/gltf-binary");
  assert.equal(lib.mimeFor("dm-sans-variable.woff2"), "font/woff2");
  assert.equal(lib.mimeFor("KAREN.GLB"), "model/gltf-binary", "whatever the case");
  assert.equal(lib.mimeFor("mystery.bin"), "application/octet-stream");
  // Every kind of file the game ships has a type. What the game ships is what the repository tracks under dist/: a build machine can
  // put files of its own in that folder (Netlify's build left a .toml there, which broke this check once), and they are not the
  // game's. With no git (a source archive) there is nothing reliable to list, so only the fixed assertions above apply.
  const files = trackedGameFiles();
  if (files) {
    const shipped = new Map();
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      shipped.set(ext, [...(shipped.get(ext) || []), file]);
    }
    assert.ok(shipped.has(".mjs") && shipped.has(".glb"), "the game's own files were found");
    for (const [ext, of] of shipped)
      if (ext && ![".md", ".txt"].includes(ext))
        assert.notEqual(
          lib.mimeFor("x" + ext),
          "application/octet-stream",
          `${ext} files are served as something (${of[0]})`,
        );
  }
}
function trackedGameFiles() {
  try {
    const listed = execFileSync("git", ["ls-files", "dist"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .filter(Boolean);
    return listed.length ? listed : null;
  } catch {
    return null;
  }
}

// ---- the save mirror ----------------------------------------------------------------------------------------------------------
{
  const values = {
    "pool-panic.records.v1": '{"unlocked":5}',
    "pool-panic.story.v1": '{"fund":120}',
    "pool-panic.achievements.v1": '["RESCUE"]',
    "pool-panic.crashlog.v1": "a device's black box: not a player's progress",
    "pool-panic.hunt.v1": "a crash hunt's state",
    "pool-panic.reports.v1": '{"device":"K7Q2M5XA","auto":true}', // the device code and whether reports go by themselves
    "pool-panic.playtest.v1": '{"on":true}', // whether this device is playtesting
    "pool-panic.playtest.seen.v1": '{"v":1,"levels":{}}', // what the playtest has covered
    "something.else": "x",
    "pool-panic.map.v1": 7, // not a string
    "pool-panic.seen.v1": "x".repeat(300 * 1024), // too big to be the game's
  };
  const text = lib.buildSaveFile(values, 1234);
  const file = JSON.parse(text);
  assert.equal(file.version, 1);
  assert.equal(file.savedAt, 1234);
  assert.deepEqual(
    Object.keys(file.keys).sort(),
    ["pool-panic.achievements.v1", "pool-panic.records.v1", "pool-panic.story.v1"],
    "progress and nothing about the device, nothing that is not a string, nothing absurd",
  );
  const back = lib.readSaveFile(text);
  assert.equal(back.savedAt, 1234);
  assert.equal(back.keys["pool-panic.records.v1"], '{"unlocked":5}', "what was written is what comes back");
  for (const key of lib.SAVE_KEYS) assert.match(key, /^pool-panic\.[a-z]+\.v1$/, key);
  assert.ok(
    !lib.SAVE_KEYS.some((k) => /crashlog|hunt|reports|playtest/.test(k)),
    "no device state in the mirror",
  );
  // The game's own keys are the ones mirrored: each is in the game's source.
  const sources = [
    "dist/app.mjs",
    "dist/scene/coach-model.mjs",
    "dist/scene/swimmer-models.mjs",
    "dist/story.mjs",
  ]
    .map(read)
    .join("\n");
  for (const key of lib.SAVE_KEYS) assert.ok(sources.includes(key), `${key} is a key the game uses`);

  // A file is read with suspicion: damaged, from another program, or with extra keys.
  assert.equal(lib.readSaveFile("{not json"), null);
  assert.equal(lib.readSaveFile("null"), null);
  assert.equal(
    lib.readSaveFile(JSON.stringify({ version: 2, keys: {} })),
    null,
    "a version this one does not know",
  );
  assert.equal(lib.readSaveFile(JSON.stringify({ version: 1 })), null);
  const odd = lib.readSaveFile(
    JSON.stringify({
      version: 1,
      keys: { "pool-panic.records.v1": "ok", "pool-panic.crashlog.v1": "no", "pool-panic.map.v1": { a: 1 } },
    }),
  );
  assert.deepEqual(odd.keys, { "pool-panic.records.v1": "ok" }, "only the player's keys, only strings");
  assert.equal(odd.savedAt, 0);
  assert.ok(
    lib.sameValues({ "pool-panic.records.v1": "a" }, { "pool-panic.records.v1": "a", other: "b" }),
    "only saved keys count",
  );
  assert.ok(!lib.sameValues({ "pool-panic.records.v1": "a" }, {}), "a key that appeared");
  assert.ok(lib.sameValues({}, {}));
}

// ---- links and windows --------------------------------------------------------------------------------------------------------
{
  for (const ok of [
    "https://github.com/larvuz2/poolpanic/issues/new",
    "https://store.steampowered.com/app/480",
    "https://steamcommunity.com/app/480",
    "https://gist.github.com/x",
  ])
    assert.ok(lib.isSafeExternalUrl(ok), ok);
  for (const bad of [
    "http://github.com/x",
    "https://github.com.evil.example/x",
    "https://evilgithub.com/x",
    "https://example.com",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "app://game/index.html",
    "github.com",
    "",
  ])
    assert.ok(!lib.isSafeExternalUrl(bad), bad);

  const screens = [
    { x: 0, y: 0, width: 1920, height: 1040 },
    { x: 1920, y: 0, width: 1280, height: 720 },
  ];
  const fit = (saved) => lib.fitWindow(saved, screens);
  assert.deepEqual(
    fit(null),
    { width: 1280, height: 720, maximized: false, fullscreen: false },
    "the first launch: 1280 x 720, wherever the system puts it",
  );
  assert.deepEqual(fit({ x: 100, y: 80, width: 1400, height: 900 }), {
    x: 100,
    y: 80,
    width: 1400,
    height: 900,
    maximized: false,
    fullscreen: false,
  });
  assert.equal(fit({ x: 2100, y: 50, width: 1000, height: 600 }).x, 2100, "on the second screen");
  assert.equal(
    fit({ x: 5000, y: 50, width: 1000, height: 600 }).x,
    undefined,
    "on a screen that has been unplugged: the system picks the place",
  );
  assert.equal(fit({ x: 100, y: 5000, width: 1000, height: 600 }).y, undefined, "or far below");
  assert.deepEqual(
    [fit({ width: 100, height: 50 }).width, fit({ width: 100, height: 50 }).height],
    [1280, 720],
    "a window too small to play in gets the default",
  );
  assert.equal(
    fit({ x: 0, y: 0, width: 9000, height: 9000 }).width,
    1920,
    "and one too big is cut to the first screen",
  );
  assert.ok(
    fit({ maximized: true, fullscreen: true }).maximized && fit({ fullscreen: true }).fullscreen,
    "the state of the window is kept",
  );
  assert.equal(lib.fitWindow(undefined, undefined).width, 1280, "no screens known at all");
}

// ---- Steam, against a fake steamworks.js --------------------------------------------------------------------------------------------
{
  const calls = [];
  const fake = (overrides = {}) => ({
    init: (id) => {
      calls.push(["init", id]);
      return {
        localplayer: { getName: () => "Coach", setRichPresence: (k, v) => calls.push(["presence", k, v]) },
        utils: { isSteamRunningOnSteamDeck: () => true },
        apps: { currentGameLanguage: () => "english" },
        achievement: {
          activate: (n) => (calls.push(["activate", n]), true),
          isActivated: (n) => n === "DONE",
        },
        stats: {
          setInt: (n, v) => (calls.push(["setInt", n, v]), true),
          store: () => (calls.push(["store"]), true),
        },
        overlay: { activateToStore: (id, flag) => calls.push(["store page", id, flag]) },
      };
    },
    restartAppIfNecessary: () => false,
    electronEnableSteamOverlay: () => calls.push(["overlay"]),
    ...overrides,
  });
  const make = (lib2, config = { enabled: true, appId: 480, restartIfNeeded: false }) => {
    const logs = [];
    return { steam: createSteam({ load: () => lib2, config, log: (m) => logs.push(m) }), logs };
  };

  {
    const { steam } = make(fake());
    assert.equal(steam.status().available, false, "not started yet");
    const status = steam.start();
    assert.deepEqual(status, {
      available: true,
      appId: 480,
      name: "Coach",
      deck: true,
      language: "english",
      reason: "",
    });
    assert.equal(steam.enableOverlay(), true);
    assert.equal(steam.unlock("RESCUE"), true);
    assert.equal(steam.unlock("bad name!"), false, "a name Steamworks cannot have is not sent");
    assert.equal(steam.unlock("A".repeat(80)), false);
    assert.equal(steam.isUnlocked("DONE"), true);
    assert.equal(steam.isUnlocked("OTHER"), false);
    assert.equal(steam.setStat("SHIFTS", 3.6), true);
    assert.equal(steam.setStat("SHIFTS", "lots"), false, "a stat is a number");
    assert.equal(steam.richPresence("Level 4 · The relay"), true);
    assert.equal(steam.openStore(), true);
    assert.deepEqual(
      calls,
      [
        ["init", 480],
        ["overlay"],
        ["activate", "RESCUE"],
        ["setInt", "SHIFTS", 4],
        ["store"],
        ["presence", "status", "Level 4 · The relay"],
        ["store page", 480, 0],
      ],
      "what Steam is asked, in order",
    );
    assert.ok(NAME.test("FISH_STOPPED") && NAME.test("ACH.1-b") && !NAME.test("a b") && !NAME.test(""));
  }
  {
    // No Steam client: playing on is the whole behaviour.
    const { steam, logs } = make(
      fake({
        init() {
          throw new Error("Steam is not running");
        },
      }),
    );
    const status = steam.start();
    assert.equal(status.available, false);
    assert.equal(status.reason, "Steam is not running");
    assert.equal(logs.length, 1, "it says so once");
    assert.equal(
      steam.unlock("RESCUE") ||
        steam.setStat("A", 1) ||
        steam.richPresence("x") ||
        steam.openStore() ||
        steam.enableOverlay(),
      false,
      "every call says no",
    );
  }
  {
    const { steam, logs } = make(null);
    steam.start();
    const missing = createSteam({
      load: () => {
        throw new Error("Cannot find module");
      },
      config: { enabled: true, appId: 480 },
      log: (m) => logs.push(m),
    });
    assert.equal(missing.start().reason, "steamworks.js is not installed", "a build without the module");
    assert.equal(missing.unlock("RESCUE"), false);
    const off = make(fake(), { enabled: false, appId: 480 });
    assert.equal(off.steam.start().reason, "turned off");
    assert.equal(off.steam.unlock("RESCUE"), false);
  }
  {
    // Steam relaunches a game that was started outside it.
    const { steam } = make(fake({ restartAppIfNecessary: (id) => id === 1234 }), {
      enabled: true,
      appId: 1234,
      restartIfNeeded: true,
    });
    assert.deepEqual(steam.start(), { restart: true });
    const normal = make(fake({ restartAppIfNecessary: () => true }), {
      enabled: true,
      appId: 480,
      restartIfNeeded: false,
    });
    assert.equal(normal.steam.start().available, true, "not asked while the id is Valve's test one");
  }
  {
    // A call that throws is a call that says no.
    const { steam } = make(
      fake({
        init: () => ({
          localplayer: {
            getName: () => "x",
            setRichPresence: () => {
              throw new Error("no");
            },
          },
          achievement: {
            activate: () => {
              throw new Error("unknown achievement");
            },
          },
          stats: {
            setInt: () => {
              throw new Error("no");
            },
            store: () => true,
          },
          overlay: {
            activateToStore: () => {
              throw new Error("no");
            },
          },
        }),
        electronEnableSteamOverlay: () => {
          throw new Error("no electron");
        },
      }),
    );
    assert.equal(steam.start().available, true, "a client with little of the API still starts");
    assert.equal(steam.unlock("ANYTHING"), false);
    assert.equal(steam.setStat("A", 1), false);
    assert.equal(steam.richPresence("x"), false);
    assert.equal(steam.openStore(), false);
    assert.equal(steam.enableOverlay(), false);
  }

  // The configuration file, and the environment over it.
  const dir = mkdtempSync(join(tmpdir(), "pp-steam-"));
  const file = join(dir, "steam.config.json");
  assert.deepEqual(
    readConfig(file, {}),
    { enabled: true, appId: TEST_APP_ID, restartIfNeeded: false },
    "no file: Valve's test app",
  );
  writeFileSync(file, JSON.stringify({ appId: 4242, restartIfNeeded: true }));
  assert.deepEqual(readConfig(file, {}), { enabled: true, appId: 4242, restartIfNeeded: true });
  assert.equal(readConfig(file, { POOLPANIC_STEAM_APPID: "777" }).appId, 777, "the environment wins");
  assert.equal(readConfig(file, { POOLPANIC_STEAM: "0" }).enabled, false, "and can turn Steam off");
  writeFileSync(file, JSON.stringify({ appId: "soon", enabled: false }));
  assert.deepEqual(
    readConfig(file, {}),
    { enabled: false, appId: TEST_APP_ID, restartIfNeeded: false },
    "a bad id is the test app",
  );
  writeFileSync(file, "{ broken");
  assert.equal(readConfig(file, {}).appId, TEST_APP_ID, "a broken file too");
  const shipped = JSON.parse(read("desktop/steam.config.json"));
  assert.ok(Number.isInteger(shipped.appId) && shipped.appId > 0, "the shipped config has an app id");
}

// ---- tester builds: the only build that posts anything --------------------------------------------------------------------------
{
  const ok = "https://poolpanic.netlify.app/api/report";
  // The addresses a report may go to: https and the report path, nothing else in it; this machine's own fake service only when asked.
  assert.equal(lib.isReportUrl(ok), true);
  assert.equal(lib.isReportUrl("https://deploy-preview-21--poolpanic.netlify.app/api/report"), true);
  for (const bad of [
    "http://poolpanic.netlify.app/api/report",
    "https://poolpanic.netlify.app/api/report?x=1",
    "https://poolpanic.netlify.app/api/report#x",
    "https://poolpanic.netlify.app/other",
    "https://user:pass@poolpanic.netlify.app/api/report",
    "ftp://poolpanic.netlify.app/api/report",
    "/api/report",
    "",
    null,
  ])
    assert.equal(lib.isReportUrl(bad), false, `${bad} is not a report address`);
  assert.equal(lib.isReportUrl("http://localhost:8123/api/report"), false, "no http by default");
  assert.equal(
    lib.isReportUrl("http://localhost:8123/api/report", { allowLocal: true }),
    true,
    "a developer's own service",
  );
  assert.equal(lib.isReportUrl("http://127.0.0.1:8123/api/report", { allowLocal: true }), true);
  assert.equal(
    lib.isReportUrl("http://example.com/api/report", { allowLocal: true }),
    false,
    "and only this machine",
  );
  assert.equal(lib.MAX_REPORT_BODY, 262144, "the service's own limit");
  assert.ok(
    read("netlify/functions/report.mjs").includes("const MAX_BODY = 262144"),
    "and it is still the service's limit",
  );

  // What a tester.json says: its own address, a query of plain words, nothing it may not say.
  assert.deepEqual(lib.readTester("{}"), { reports: ok, query: "playtest" });
  assert.deepEqual(lib.readTester(JSON.stringify({ reports: ok, query: "playtest&debug" })), {
    reports: ok,
    query: "playtest&debug",
  });
  assert.equal(
    lib.readTester(JSON.stringify({ reports: "https://evil.example/steal" })).reports,
    ok,
    "an address that is not allowed is the project's own",
  );
  assert.equal(
    lib.readTester(JSON.stringify({ reports: "http://localhost:9/api/report" })).reports,
    ok,
    "a packed app never posts to http",
  );
  assert.equal(
    lib.readTester(JSON.stringify({ reports: "http://localhost:9/api/report" }), { allowLocal: true })
      .reports,
    "http://localhost:9/api/report",
    "an unpacked one may, for a fake service",
  );
  assert.equal(
    lib.readTester(JSON.stringify({ query: "a b<script>" })).query,
    "playtest",
    "a query of anything but plain words is the plain one",
  );
  assert.equal(lib.readTester("{ broken"), null, "a damaged file is not a tester build");
  assert.equal(lib.readTester("[]"), null);
  assert.equal(lib.readTester("7"), null);
  assert.equal(lib.readTester(""), null);

  // The main process posts only for a tester build, only for the game's own window, to the fixed address, and the page gets the way to post
  // only from a tester build; the window's own rules (it may talk to itself only) do not change.
  const main = read("desktop/main.cjs"),
    preload = read("desktop/preload.cjs");
  const handler = main.slice(
    main.indexOf('ipcMain.handle("desktop:report"'),
    main.indexOf('on("steam:unlock"'),
  );
  assert.ok(handler.length > 200, "the report handler is there");
  for (const needed of [
    "!TESTER",
    "trusted(event)",
    "lib.MAX_REPORT_BODY",
    "TESTER.reports",
    "net.fetch",
    'method: "POST"',
    "AbortController",
  ])
    assert.ok(handler.includes(needed), `the report handler has ${needed}`);
  assert.ok(
    !/event\.sender|args\[|url\b/.test(handler.replace("TESTER.reports", "")),
    "and the address is not the page's to choose",
  );
  assert.ok(main.includes("tester: !!TESTER"), "the page is told whether it is a tester build");
  {
    const choice = main.slice(main.indexOf("const TESTER = (() => {"), main.indexOf("const QUERY"));
    assert.ok(
      /if \(DEV && \(process\.argv\.includes\("--tester"\)/.test(choice) &&
        choice.includes("POOLPANIC_REPORTS"),
      "the flag and the environment variables only work from the source, never in a packed app",
    );
    assert.ok(choice.includes("allowLocal: DEV"), "and a packed app never posts to a local address");
  }
  assert.ok(main.includes('"tester.json"'), "a tester.json beside the game makes a tester build");
  assert.ok(
    /connect-src 'self' blob: data:/.test(main),
    "the page itself still connects only to its own files",
  );
  assert.ok(
    preload.includes("...(boot.tester &&") && preload.includes('invoke("desktop:report"'),
    "only a tester build's page gets sendReport",
  );
  assert.ok(
    !/invoke\("desktop:report"[^)]*\)[^;]*\n[^;]*sendReport/.test(preload) &&
      preload.split("desktop:report").length === 2,
    "through one channel",
  );

  // The build script writes tester.json only when asked, and the packer takes the whole game folder with it.
  const prepare = read("desktop/scripts/prepare-game.mjs");
  assert.ok(
    prepare.includes('"--tester"') && prepare.includes("tester.json") && prepare.includes('"desktop-test"'),
    "prepare-game makes a tester build when asked",
  );
  assert.ok(
    /if \(tester\)\s*\n?\s*writeFileSync\(\s*join\(target, "tester.json"\)/.test(prepare),
    "and only then",
  );
  const pkg = JSON.parse(read("desktop/package.json"));
  assert.ok(pkg.scripts["start:tester"].includes("--tester"), "npm run start:tester");
  for (const system of ["win", "mac", "linux"]) {
    assert.ok(
      pkg.scripts["pack:tester:" + system].includes("prepare:game -- --tester"),
      `pack:tester:${system} writes tester.json`,
    );
    assert.ok(
      !pkg.scripts["pack:" + system].includes("--tester"),
      `and pack:${system}, the Steam one, does not`,
    );
  }
  assert.ok(
    read("desktop/electron-builder.yml").includes("game/**/*"),
    "tester.json is packed with the game",
  );
  assert.ok(
    read(".gitignore").includes("desktop/game/"),
    "and is never committed (the game folder is made by the build)",
  );
}

// ---- the CI that makes the downloads: tester builds only, and only its release job may write -------------------------------------
{
  const whole = read(".github/workflows/desktop-test-build.yml");
  const flow = whole
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n"); // (the comments may say what the workflow is not)
  assert.match(flow, /^name: Desktop test builds$/m);
  assert.ok(
    /branches: \[main, "claude\/\*\*"\]/.test(flow) &&
      flow.includes('"dist/**"') &&
      flow.includes('"desktop/**"'),
    "on a push to main or a working branch that changes the game or the app",
  );
  assert.ok(flow.includes("workflow_dispatch:"), "and by hand");
  // Only tester builds: the Steam build is made by hand on each system, never by CI, so no CI file ever reaches a depot by accident.
  const scripts = [...flow.matchAll(/script: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(scripts.sort(), ["pack:tester:linux", "pack:tester:mac", "pack:tester:win"]);
  assert.ok(!/npm run pack:(win|mac|linux)\b/.test(flow), "CI never packs the Steam build");
  assert.ok(
    !/steamcmd|SteamPipe|app_build|STEAM_|secrets\./i.test(flow),
    "and has no Steam upload and no secret",
  );
  // Read-only unless it is the release job, which is the only one that may write.
  assert.match(flow, /^permissions:\n  contents: read$/m, "read-only by default");
  assert.equal((flow.match(/contents: write/g) || []).length, 1, "one place that writes");
  const release = flow.slice(flow.indexOf("  release:"));
  assert.ok(release.includes("contents: write") && release.includes("needs: pack"), "the release job");
  assert.ok(
    release.includes("desktop-latest") && release.includes("--prerelease"),
    "one rolling pre-release, never a real release",
  );
  assert.ok(!release.includes("ref_name }}\n"), "(the branch name only goes into the notes)");
  // The files a tester is told to download are the files the build makes.
  for (const file of [
    "PoolPanic-windows-x64.zip",
    "PoolPanic-mac-apple-silicon.zip",
    "PoolPanic-mac-intel.zip",
    "PoolPanic-linux-x64.zip",
  ])
    assert.ok(flow.includes(file), `${file} is made and offered`);
  assert.ok(
    flow.includes("codesign --force --deep --sign -"),
    "the Mac builds are signed ad hoc (Apple Silicon will not run an unsigned program)",
  );
  assert.ok(
    read("desktop/README.md").includes("desktop-latest"),
    "desktop/README.md says where the downloads are",
  );
}

// ---- the settings that keep it safe ---------------------------------------------------------------------------------------------
{
  const main = read("desktop/main.cjs");
  for (const setting of [
    "contextIsolation: true",
    "sandbox: true",
    "nodeIntegration: false",
    "registerSchemesAsPrivileged",
    "will-navigate",
    "setWindowOpenHandler",
    "setPermissionRequestHandler",
    "requestSingleInstanceLock",
  ])
    assert.ok(main.includes(setting), `main.cjs has ${setting}`);
  assert.ok(
    !/webSecurity:\s*false|allowRunningInsecureContent|nodeIntegration:\s*true|contextIsolation:\s*false/.test(
      main,
    ),
    "and nothing that turns the protection off",
  );
  assert.match(main, /app:\/\/|GAME_ORIGIN/, "the game is served from its own address");
  assert.ok(
    main.includes("lib.SAVE_KEYS") && main.includes("steam.status()"),
    "and tells the page what it may know",
  );
  const preload = read("desktop/preload.cjs");
  assert.ok(
    preload.includes("contextBridge.exposeInMainWorld") &&
      !preload.includes('require("fs")') &&
      !preload.includes('require("node:fs")'),
    "the page gets one frozen object, not Node",
  );
  assert.ok(
    !/ipcRenderer\s*[,}]\s*$/m.test(preload.split("exposeInMainWorld")[1] || ""),
    "and not ipcRenderer itself",
  );

  const pkg = JSON.parse(read("desktop/package.json"));
  assert.equal(pkg.main, "main.cjs");
  assert.ok(
    !/[\^~]/.test(
      pkg.devDependencies.electron +
        pkg.devDependencies["electron-builder"] +
        pkg.dependencies["steamworks.js"],
    ),
    "versions are pinned: a Steam build does not change under you",
  );
  const builder = read("desktop/electron-builder.yml");
  assert.match(builder, /^asar: false$/m, "plain files, which Steam can patch by the file");
  assert.equal(
    [...builder.matchAll(/target: (\w+)/g)].every((m) => m[1] === "dir"),
    true,
    "Steam gets folders, not installers",
  );
  assert.match(
    builder,
    /executableName: PoolPanic/,
    "an executable with no space in its name, for the launch options",
  );
  for (const file of ["main.cjs", "preload.cjs", "lib.cjs", "steam.cjs", "steam.config.json"])
    assert.ok(builder.includes("- " + file), `${file} is packed`);

  const vdf = read("desktop/steam/app_build.vdf");
  assert.match(vdf, /"SetLive" ""/, "an upload never goes live by itself");
  assert.ok(
    vdf.includes("YOUR_APP_ID") && vdf.includes("YOUR_DEPOT_ID_WINDOWS"),
    "ids are filled in by whoever has them",
  );
  assert.ok(!/"SetLive" "default"/.test(vdf));
  const ignore = read(".gitignore");
  for (const path of ["desktop/node_modules/", "desktop/game/", "desktop/out/", "desktop/steam/output/"])
    assert.ok(ignore.includes(path), `${path} is not committed`);
  assert.ok(
    read("dist/style.css").startsWith("/* The two typefaces are bundled"),
    "the game's fonts are its own files: it looks right with no network",
  );
  assert.ok(
    !/fonts\.googleapis|fonts\.gstatic/.test(read("dist/style.css") + read("dist/index.html")),
    "and asks nobody for them",
  );
}

// ---- every script parses ---------------------------------------------------------------------------------------------------------
// Electron is not here to start the app, so at least a slipped brace in main.cjs or preload.cjs cannot get through.
{
  const parses = (file) => {
    try {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  };
  const broken = join(mkdtempSync(join(tmpdir(), "pp-parse-")), "broken.cjs");
  writeFileSync(broken, "if (true) {\n  console.log(1);\n");
  assert.equal(parses(broken), false, "the check can tell a script that does not parse");
  for (const file of ["main.cjs", "preload.cjs", "lib.cjs", "steam.cjs", "scripts/prepare-game.mjs"])
    assert.ok(parses("desktop/" + file), `desktop/${file} parses`);
}

console.log(
  "Desktop checks passed: files served only from the game's folder with the right types, the CI that makes the test downloads (tester builds only, one place that writes), tester builds (the only build that posts, to a fixed address, from the game's own window, never from a packed Steam build), the progress mirror (player keys only, damaged files refused), links and windows, the Steam wrapper against a fake steamworks.js (it never stops the game), the locked-down window and upload settings, and every desktop script parsing.",
);
