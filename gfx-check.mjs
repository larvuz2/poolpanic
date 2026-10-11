// The graphics plan (dist/gfx.mjs): how hard the game drives the graphics on a device. An iPad's Safari died 23 to 64 s into almost every
// shift with the graphics working flat out, so a touch device with WebKit draws fewer pixels and at most 60 frames a second, a governor
// lowers the resolution while the frames are slow, and a page that dies in the middle of a shift makes the next launch draw lighter.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GFX_KEY,
  MAX_TIER,
  TIERS,
  isTouchWebKit,
  readGfx,
  bootGfx,
  markDrawing,
  resetGfx,
  graphicsPlan,
  Governor,
} from "./dist/gfx.mjs";

const IPAD =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Safari/605.1.15";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130 Mobile/15E148 Safari/604.1";
const ELECTRON_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) PoolPanic/0.1.0 Chrome/152.0 Electron/44.0 Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141 Safari/537.36";

// 1) Which devices are touch devices with WebKit: an iPad (it says it is a Mac, with touch points), an iPhone in any browser. A Mac's
// Safari, the desktop app and Windows are not.
assert.ok(isTouchWebKit({ userAgent: IPAD, maxTouchPoints: 5 }), "an iPad");
assert.ok(isTouchWebKit({ userAgent: IPHONE, maxTouchPoints: 5 }), "an iPhone's Chrome is WebKit too");
assert.ok(!isTouchWebKit({ userAgent: IPAD, maxTouchPoints: 0 }), "a Mac's Safari");
assert.ok(!isTouchWebKit({ userAgent: ELECTRON_MAC, maxTouchPoints: 5 }), "the desktop app is Chromium");
assert.ok(!isTouchWebKit({ userAgent: WINDOWS, maxTouchPoints: 10 }), "a Windows touch screen");
assert.ok(!isTouchWebKit(), "nothing known");

// 2) The plan. The iPad of the crashes (1366×892 points, 2 pixels a point) drew 2322×1516 at 1.7; now about 2 million pixels.
{
  const ipad = graphicsPlan({ touch: true, deviceRatio: 2 });
  const r = ipad.ratio(1366, 892);
  assert.ok(r > 1.2 && r < 1.35, "the iPad's ratio is " + r);
  assert.ok(1366 * 892 * r * r <= 2.0e6 + 1, "at most 2 million pixels");
  assert.equal(ipad.fpsCap, 60, "never more than 60 frames a second there");
  assert.ok(ipad.govern, "and the governor watches its frames");
  assert.deepEqual(ipad.flags, [], "tier 0 turns nothing off");
  assert.equal(ipad.ratio(1366, 892, 0.85), +(r * 0.85).toFixed(3), "the governor's scale multiplies it");
  assert.equal(
    graphicsPlan({ touch: true, deviceRatio: 3 }).ratio(390, 844),
    1.7,
    "a phone's small screen fits the budget at 1.7",
  );
  // A desktop is as it was: the screen's ratio, at most 1.7, no cap, no governor.
  const desk = graphicsPlan({ deviceRatio: 2 });
  assert.equal(desk.ratio(1920, 1080), 1.7);
  assert.equal(graphicsPlan({ deviceRatio: 1 }).ratio(1920, 1080), 1);
  assert.equal(desk.fpsCap, 0);
  assert.ok(!desk.govern);
  // ?dpr wins and nothing changes it (the crash hunt's pixel-ratio test).
  const fixed = graphicsPlan({ touch: true, deviceRatio: 2, dprCap: 1 });
  assert.equal(fixed.ratio(1366, 892), 1);
  assert.equal(fixed.ratio(1366, 892, 0.5), 1, "not even the governor");
  assert.ok(!fixed.govern);
  assert.ok(!graphicsPlan({ touch: true, testing: true }).govern, "a hunt or a trial is never governed");
  assert.equal(
    graphicsPlan({ deviceRatio: 2, dprCap: 0.2 }).ratio(100, 100),
    0.5,
    "never under half a pixel",
  );
  // The tiers: each turns off more, and draws fewer pixels.
  assert.equal(TIERS.length, MAX_TIER + 1);
  for (let t = 1; t <= MAX_TIER; t++) {
    for (const f of TIERS[t - 1].flags)
      assert.ok(TIERS[t].flags.includes(f), "tier " + t + " keeps " + f + " off");
    assert.ok(TIERS[t].flags.length > TIERS[t - 1].flags.length, "tier " + t + " turns off more");
    assert.ok(TIERS[t].pixels < TIERS[t - 1].pixels);
    assert.ok(
      graphicsPlan({ tier: t, touch: true, deviceRatio: 2 }).ratio(1366, 892) <
        graphicsPlan({ tier: t - 1, touch: true, deviceRatio: 2 }).ratio(1366, 892),
    );
  }
  assert.deepEqual(TIERS[1].flags, ["noaa"]);
  assert.ok(TIERS[2].flags.includes("noshadow") && TIERS[3].flags.includes("nomodels"));
  const tuningWords = readFileSync("dist/tuning.mjs", "utf8");
  for (const f of TIERS[MAX_TIER].flags)
    assert.ok(tuningWords.includes('"' + f + '"'), f + " is a switch tuning.mjs knows");
  // A desktop that crashed draws lighter too, and is governed.
  assert.equal(graphicsPlan({ tier: 1, deviceRatio: 2 }).ratio(1920, 1080), 1.25);
  assert.equal(graphicsPlan({ tier: 2, deviceRatio: 2 }).ratio(1920, 1080), 1);
  assert.ok(graphicsPlan({ tier: 1 }).govern);
  assert.equal(graphicsPlan({ tier: 9 }).tier, MAX_TIER, "a tier out of range is clamped");
}

// 3) The mark of a shift being drawn, and the launch after a page died with it.
{
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  assert.deepEqual(readGfx(storage), { tier: 0, live: null, crashes: 0 }, "nothing stored: full graphics");
  assert.deepEqual(bootGfx(storage), { tier: 0, raised: false, died: false, crashes: 0 });
  markDrawing(storage, true, 1000);
  assert.deepEqual(readGfx(storage).live, { at: 1000 });
  markDrawing(storage, true, 2000);
  assert.deepEqual(readGfx(storage).live, { at: 1000 }, "marked once, not rewritten every frame");
  markDrawing(storage, false);
  assert.equal(readGfx(storage).live, null, "a shift put away (ended, hidden, closed) leaves no mark");
  assert.deepEqual(
    bootGfx(storage),
    { tier: 0, raised: false, died: false, crashes: 0 },
    "a clean page is not a crash",
  );
  // A page that died in a shift: down a tier, and the mark is gone.
  markDrawing(storage, true);
  assert.deepEqual(bootGfx(storage), { tier: 1, raised: true, died: true, crashes: 1 });
  assert.equal(readGfx(storage).live, null);
  assert.deepEqual(bootGfx(storage), { tier: 1, raised: false, died: false, crashes: 1 }, "the tier stays");
  // A crash hunt or a trial only clears the mark (its crashes are the point of it).
  markDrawing(storage, true);
  assert.deepEqual(bootGfx(storage, { count: false }), { tier: 1, raised: false, died: true, crashes: 1 });
  // Never past the last tier.
  for (let i = 0; i < 5; i++) {
    markDrawing(storage, true);
    bootGfx(storage);
  }
  assert.equal(readGfx(storage).tier, MAX_TIER);
  markDrawing(storage, true);
  assert.equal(bootGfx(storage).raised, false, "at the last tier there is nothing lighter");
  resetGfx(storage);
  assert.deepEqual(readGfx(storage), { tier: 0, live: null, crashes: 0 }, "?gfx=reset: full graphics again");
  // Damaged or unreadable storage is full graphics, and nothing throws.
  store.set(GFX_KEY, "{not json");
  assert.equal(readGfx(storage).tier, 0);
  const broken = {
    getItem() {
      throw new Error("private mode");
    },
    setItem() {
      throw new Error("quota");
    },
  };
  assert.deepEqual(bootGfx(broken), { tier: 0, raised: false, died: false, crashes: 0 });
  markDrawing(broken, true);
  markDrawing(null, true);
  assert.equal(bootGfx(null).tier, 0);
}

// 4) The governor: frames at 60 change nothing; two seconds of frames at 30 lower the scale; it only goes down, never under its floor;
// a hitch (a hidden page, a shader compiling) is not the frame rate.
{
  const g = new Governor();
  const run = (ms, seconds) => {
    const out = [];
    for (let i = 0; i < (seconds * 1000) / ms; i++) {
      const s = g.frame(ms);
      if (s !== null) out.push(s);
    }
    return out;
  };
  assert.deepEqual(run(1000 / 60, 10), [], "60 fps: nothing");
  assert.deepEqual(run(1000 / 50, 10), [], "50 fps: nothing");
  assert.deepEqual(run(1000 / 30, 2.1), [0.85], "30 fps for two seconds: down to 0.85");
  assert.equal(g.fps, 30);
  assert.deepEqual(run(1000 / 60, 10), [], "fast again: it stays down");
  assert.equal(g.scale, 0.85);
  const more = run(1000 / 25, 30);
  assert.ok(more.length >= 2 && more.every((s, i) => i === 0 || s < more[i - 1]), "goes down step by step");
  assert.equal(g.scale, 0.7, "never under its floor");
  assert.deepEqual(run(1000 / 25, 10), [], "at the floor: nothing more");
  const h = new Governor();
  for (let i = 0; i < 40; i++) assert.equal(h.frame(400), null, "a 400 ms hitch is not a frame");
  assert.equal(h.frame(0), null);
  assert.equal(h.frame(NaN), null);
  assert.equal(h.scale, 1);
}

// 5) The game uses it: the plan's flags reach the switches, the scene takes its pixel ratio from the plan, the frame loop caps, governs
// and marks the shift being drawn, a hidden or closed page puts the mark away, the log says the tier, and a test never counts.
{
  const app = readFileSync("dist/app.mjs", "utf8"),
    scene = readFileSync("dist/scene.mjs", "utf8");
  assert.match(app, /from "\.\/gfx\.mjs"/);
  assert.match(app, /bootGfx\(crashStorage, \{ count: !testing \}\)/, "a hunt's crash is not counted");
  assert.match(app, /const gfxTier = testing \? 0 : gfxBoot\.tier/, "a hunt plays at tier 0");
  assert.match(
    app,
    /\.\.\.graphicsPlan\(\{ tier: gfxTier \}\)\.flags/,
    "the tier's switches go into the tuning",
  );
  assert.match(app, /dprCap: tuning\.number\("dpr", null\)/, "?dpr still wins");
  assert.match(app, /globalThis\.__poolGfx/);
  assert.match(app, /function governFrame/);
  assert.match(app, /markDrawing\(crashStorage, drawing\)/);
  assert.match(app, /addEventListener\("pagehide", putAway\)/);
  assert.match(app, /addEventListener\("visibilitychange", \(\) => document\.hidden && putAway\(\)\)/);
  assert.match(app, /gfx\.plan\.fpsCap && lastDrawn && t - lastDrawn < 1000 \/ gfx\.plan\.fpsCap/);
  assert.match(app, /crashlog\.crumb\(\s*"gfx"/, "the log says the plan and every step of the governor");
  assert.match(app, /params\.get\("gfx"\) === "reset"\) resetGfx/);
  assert.match(app, /gfxBoot\.raised/, "the player is told when the graphics went lighter");
  assert.match(scene, /pixelRatio\(w, h\) \{/);
  assert.match(scene, /gfx\.plan\.ratio\(w, h, gfx\.scale\)/);
  assert.match(scene, /setPixelRatio\(this\.pixelRatio\(container\.clientWidth, container\.clientHeight\)\)/);
  // A device setting, not progress: it must not travel to another machine with the saves.
  assert.ok(!readFileSync("desktop/lib.cjs", "utf8").includes(GFX_KEY), "not mirrored to the saves file");
  assert.ok(GFX_KEY.startsWith("pool-panic."));
}

console.log(
  "Graphics plan checks passed: an iPad and an iPhone told from a Mac, the desktop app and Windows; an iPad drawing about 2 million pixels (not 3.5) at most 60 times a second, a desktop as it was, ?dpr winning; four tiers each lighter than the last; a page that died in a shift making the next launch a tier lighter (once, never past the last, a hunt not counted, ?gfx=reset back to full, broken storage harmless); the governor lowering the resolution only on slow frames, step by step to its floor, never on a hitch; and the game wired to all of it.",
);
