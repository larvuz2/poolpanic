// The main menu (20 October 2026): the title screen's settings, tips and loading label (dist/title.mjs), the menu's recorded
// music and the two mixes under the master (dist/audio.mjs), the 3D stage's numbers and pictures (dist/scene/menu-stage.mjs),
// and how the page and the app are wired to them. The stage itself is drawn by a browser: this checks what can be checked
// without one.
import assert from "node:assert/strict";
import { readFileSync, statSync, existsSync } from "node:fs";
import {
  SETTING_DEFAULTS,
  normalizeSettings,
  volumesOf,
  grainOpacity,
  motionReduced,
  TIPS,
  tipAt,
  loadingLabel,
} from "./dist/title.mjs";
import { PoolAudio, MENU_AUDIO, loopPoints } from "./dist/audio.mjs";

const html = readFileSync("dist/index.html", "utf8"),
  app = readFileSync("dist/app.mjs", "utf8"),
  css = readFileSync("dist/style.css", "utf8"),
  stageSrc = readFileSync("dist/scene/menu-stage.mjs", "utf8"),
  lib = readFileSync("desktop/lib.cjs", "utf8");

// 1) Settings: defaults for anything missing, numbers kept inside their range, nonsense replaced.
{
  assert.deepEqual(normalizeSettings({}), { ...SETTING_DEFAULTS });
  const s = normalizeSettings({
    master: 140,
    music: -5,
    effects: "50",
    brightness: 10,
    grain: null,
    sensitivity: 999,
    invertY: "yes",
    motion: "sometimes",
    coachCam: false,
    quality: "high",
  });
  assert.equal(s.master, 100);
  assert.equal(s.music, 0);
  assert.equal(s.effects, 50);
  assert.equal(s.brightness, 70);
  assert.equal(s.grain, SETTING_DEFAULTS.grain, "a missing value takes the default");
  assert.equal(s.sensitivity, 250);
  assert.equal(s.invertY, false, "only true inverts");
  assert.equal(s.motion, "auto");
  assert.equal(s.quality, "high", "the other preferences are kept");
  assert.deepEqual(volumesOf({ master: 80, music: 50, effects: 100 }), {
    master: 0.8,
    music: 0.5,
    effects: 1,
  });
  assert.equal(grainOpacity({ grain: 0 }), 0);
  assert.ok(grainOpacity({ grain: 100 }) <= 0.15, "full grain is still a veil");
  assert.equal(motionReduced({ motion: "auto" }, true), true);
  assert.equal(motionReduced({ motion: "auto" }, false), false);
  assert.equal(motionReduced({ motion: "off" }, true), false);
  assert.equal(motionReduced({ motion: "on" }, false), true);
  assert.ok(lib.includes('"pool-panic.settings.v1"'), "the settings are a save the desktop app keeps");
}

// 2) The tip line and START's loading label.
{
  assert.ok(TIPS.length >= 8);
  assert.equal(tipAt(0), tipAt(TIPS.length), "the tips go round");
  assert.equal(tipAt(-1), tipAt(TIPS.length - 1));
  assert.match(tipAt(3), /^TIP · /);
  assert.equal(loadingLabel(0.425), "LOADING 42%");
  assert.equal(loadingLabel(0), "LOADING 0%");
  assert.equal(loadingLabel(1), null);
}

// 3) The mixes: an effect goes through the effects mix, the song's notes through the music mix, Settings' sliders move them.
function fakeContext() {
  const nodes = [];
  const param = (value = 0) => ({
    value,
    calls: [],
    setValueAtTime(v, t) {
      this.calls.push(["set", v, t]);
    },
    linearRampToValueAtTime(v, t) {
      this.calls.push(["linear", v, t]);
    },
    exponentialRampToValueAtTime(v, t) {
      this.calls.push(["exp", v, t]);
    },
    setTargetAtTime(v, t) {
      this.calls.push(["target", v, t]);
    },
    cancelScheduledValues() {},
  });
  const make = (kind, extra = {}) => {
    const n = {
      kind,
      outputs: [],
      connect(to) {
        n.outputs.push(to);
        return to;
      },
      disconnect() {},
      start(...args) {
        n.started = args;
      },
      stop() {
        n.stopped = true;
      },
      ...extra,
    };
    nodes.push(n);
    return n;
  };
  return {
    nodes,
    currentTime: 1,
    sampleRate: 1000,
    createOscillator: () => make("oscillator", { frequency: param(), type: "sine" }),
    createGain: () => make("gain", { gain: param(1) }),
    createBufferSource: () => make("source", { buffer: null, playbackRate: param(1) }),
    createBiquadFilter: () => make("filter", { type: "", frequency: param(), Q: param() }),
    createBuffer: (channels, length, rate) => ({
      length,
      duration: length / rate,
      getChannelData: () => new Float32Array(length),
    }),
  };
}
const mixed = () => {
  const a = new PoolAudio();
  a.ctx = fakeContext();
  a.master = a.ctx.createGain();
  a.musicBus = a.ctx.createGain();
  a.fxBus = a.ctx.createGain();
  return a;
};
{
  const a = mixed();
  a.tone(440, 1, 0.2);
  const gain = a.ctx.nodes.filter((n) => n.kind === "gain").at(-1);
  assert.equal(gain.outputs[0], a.fxBus, "an effect is in the effects mix");
  a.playing = true;
  a.next = 1;
  a.schedule();
  const songGains = a.ctx.nodes.filter((n) => n.kind === "gain" && n.outputs[0] === a.musicBus);
  assert.ok(songGains.length > 3, "the song's notes are in the music mix");
  assert.equal(a.dest, null, "and the scheduler leaves the effects alone afterwards");
  a.setVolumes({ master: 0.5, music: 0.2, effects: 0.9 });
  assert.deepEqual(a.master.gain.calls.at(-1).slice(0, 2), ["target", 0.36 * 0.5]);
  assert.deepEqual(a.musicBus.gain.calls.at(-1).slice(0, 2), ["target", 0.2]);
  assert.deepEqual(a.fxBus.gain.calls.at(-1).slice(0, 2), ["target", 0.9]);
  a.enabled = false;
  assert.equal(a.masterLevel(), 0, "sound off is silence whatever the slider");
}

// 4) The menu's music: a loop between the first and the last sound in the file, faded up in the music mix; stopped by a fade, and a
// track still loading when the shift starts never plays.
{
  const rate = 1000,
    data = new Float32Array(5000);
  for (let i = 40; i < 4950; i++) data[i] = Math.sin(i / 7) * 0.5 + 0.01;
  const buffer = { sampleRate: rate, duration: 5, getChannelData: () => data };
  const [from, to] = loopPoints(buffer);
  assert.equal(from, 0.04);
  assert.equal(to, 4.95);
  const silent = { sampleRate: rate, duration: 5, getChannelData: () => new Float32Array(5000) };
  assert.deepEqual(loopPoints(silent), [0, 5], "a file with no sound loops whole");

  const a = mixed();
  a.buffer = async () => buffer;
  await a.startMenu("theme", { fade: 3 });
  assert.equal(a.menu.track, "theme");
  assert.equal(a.menu.gain.outputs[0], a.musicBus, "the menu's music is in the music mix");
  assert.deepEqual(a.menu.gain.gain.calls.at(-1), ["linear", 1, 1.05 + 3], "faded up over 3 s");
  const sources = a.menu.nodes.filter((n) => n.kind === "source");
  assert.equal(sources.length, 2, "the track and the hall's ambience");
  assert.ok(sources.every((s) => s.loop && s.loopStart === 0.04 && s.loopEnd === 4.95));
  const gain = a.menu.gain;
  a.stopMenu(1);
  assert.equal(a.menu, null);
  assert.deepEqual(gain.gain.calls.at(-1), ["linear", 0, 2], "faded out over 1 s");

  // The shift starts while the track is still loading: it never starts.
  let release;
  const later = new Promise((r) => (release = r));
  a.buffer = () => later;
  const pending = a.startMenu("return", { fade: 6, level: 0.7 });
  a.stopMenu(1);
  release(buffer);
  await pending;
  assert.equal(a.menu, null, "a stop cancels a track still on its way");
  for (const url of Object.values(MENU_AUDIO)) {
    const file = "dist/" + url.slice(url.indexOf("assets/"));
    assert.ok(statSync(file).size > 1000, file);
  }
}

// 5) The stage: its painting, where the doors are on it, the guests behind them (21 October 2026), and how it is drawn.
{
  const size = (file) => {
    const b = readFileSync(file);
    assert.equal(b.toString("ascii", 0, 4), "RIFF");
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (kind === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    const bits = b.readUInt32LE(21);
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
  };
  assert.deepEqual(size("dist/assets/menu/hall-wall.webp"), [2048, 1152]);
  assert.ok(
    !existsSync("dist/assets/menu/door-light.webp"),
    "the painted guests in the light are gone: real ones stand there",
  );
  globalThis.document ??= { createElement: () => ({ getContext: () => null }) };
  const { STAGE, GUESTS } = await import("./dist/scene/menu-stage.mjs");
  const { IMG, LEAVES, GLASS, PX, wx, wy, HALL, PACE, DOOR_SPOT, OPEN } = STAGE;
  for (const [x0, y0, x1, y1] of GLASS)
    assert.ok(
      x0 > LEAVES.left && x1 < LEAVES.right && y0 > LEAVES.top && y1 < LEAVES.bottom,
      "the glass is in the doors",
    );
  assert.ok(GLASS[0][2] < LEAVES.split && GLASS[1][0] > LEAVES.split, "a pane in each leaf");
  // The guests: in the doorway's width, behind the doors, each with its waiting clips in its own file.
  const clipsOf = (file) => {
    const b = readFileSync(file),
      json = JSON.parse(b.toString("utf8", 20, 20 + b.readUInt32LE(12)));
    return new Set((json.animations || []).map((a) => a.name));
  };
  const FILES = {
    woman: "swimmer-woman.glb",
    "heavy-man": "swimmer-heavy-man.glb",
    boy: "swimmer-boy.glb",
    "tall-woman": "swimmer-tall-woman.glb",
    kid: "fish-kid.glb",
    marco: "models/marco.glb",
    karen: "models/karen.glb",
  };
  assert.equal(GUESTS.length, 7);
  for (const g of GUESTS) {
    const clips = clipsOf("dist/assets/" + FILES[g.id]);
    for (const name of [g.idle, g.walk, ...g.extras]) assert.ok(clips.has(name), `${g.id} has ${name}`);
    assert.ok(g.z < -0.2 && g.z > -2, g.id + " waits behind the doors");
    assert.ok(
      g.x > wx(LEAVES.left) + 0.15 && g.x < wx(LEAVES.right) - 0.15,
      g.id + " stands in the doorway's width",
    );
  }
  assert.ok(
    GUESTS.some((g) => g.id === "kid" && g.idle === "CarryIdle"),
    "the boy with the bucket, as in the painting",
  );
  assert.ok(
    GUESTS.some((g) => g.extras.includes("WaitWatch")) && GUESTS.some((g) => g.extras.includes("Complain")),
    "impatient",
  );
  assert.ok(
    OPEN.flash[0] > OPEN.swing && OPEN.then >= OPEN.flash[1],
    "the doors stand open before the light fills the screen",
  );
  assert.match(
    stageSrc,
    /px\.x > 786\.0 && px\.x < 1260\.0 && px\.y > 560\.0 && px\.y < 1080\.0\) discard/,
    "the doorway is cut out",
  );
  assert.match(
    stageSrc,
    /this\.maskScene\.overrideMaterial = this\.maskMaterial/,
    "the guests drawn alone, in black, for the glass",
  );
  assert.match(
    stageSrc,
    /o\.isMesh && \(o\.castShadow = true\)/,
    "and casting shadows into the hall once the doors open",
  );
  assert.ok(LEAVES.left < LEAVES.split && LEAVES.split < LEAVES.right && LEAVES.right < IMG.w);
  assert.equal(LEAVES.right - LEAVES.left, 474);
  assert.equal(LEAVES.bottom - LEAVES.top, 520);
  assert.equal(LEAVES.bottom, IMG.floor, "the doors stand on the deck");
  assert.ok(Math.abs(wy(LEAVES.top) - 2.62) < 0.02, "the doors are about 2.6 m tall");
  assert.ok(Math.abs(IMG.h * PX - 5.8) < 1e-9);
  assert.ok(PACE.z > DOOR_SPOT.z && PACE.z < HALL.deck, "the coach paces on the deck, in front of the doors");
  assert.ok(PACE.left < 0 && PACE.right > 0);
  assert.match(stageSrc, /renderer\.clippingPlanes = this\.clip/, "the water mirrors only what is above it");
  assert.match(stageSrc, /this\.water\.visible = false/, "and not itself");
  assert.match(stageSrc, /COACH_SCALE = 1\.08/);
}

// 6) The page and the app.
{
  for (const id of [
    "wk-go",
    "wk-free",
    "wk-locker",
    "ts-settings",
    "ts-credits",
    "ts-quit",
    "ts-tip",
    "door-flash",
    "grain",
    "settings-dialog",
    "set-master",
    "set-music",
    "set-effects",
    "set-brightness",
    "set-grain",
    "set-sensitivity",
    "set-invert",
    "set-motion",
    "set-fullscreen",
    "quality-buttons",
    "touchpad-buttons",
    "pause-settings",
    "credits-dialog",
    "credits-roll",
    "freeplay-dialog",
    "fp-pools",
    "fp-levels",
    "fp-go",
    "fp-close",
  ])
    assert.ok(html.includes(`id="${id}"`), id + " is on the page");
  // (21 October 2026: no CLICK TO ENTER; the menu and its music come at once; START is START, never CONTINUE.)
  assert.ok(!/CLICK TO ENTER|id="entry"/.test(html), "no first screen");
  assert.match(app, /audio\.startMenu\("theme", \{ fade: 3 \}\);\n  \}/);
  assert.match(
    readFileSync("dist/week-ui.mjs", "utf8"),
    /\$\("wk-go"\)\.innerHTML = `<span class="ts-label">START<\/span>`/,
  );
  assert.match(
    css,
    /\.title-screen \.ts-week,\n\.title-screen \.wk-note \{\n  display: none;/,
    "no week on the menu",
  );
  // A click outside a window is its back button: every window named has that button.
  const title = readFileSync("dist/title.mjs", "utf8"),
    backs = [...title.matchAll(/"([a-z-]+-dialog)": "([^"]+)"/g)];
  assert.ok(backs.length >= 8);
  for (const [, dialog, back] of backs) {
    assert.ok(html.includes(`id="${dialog}"`), dialog);
    const part = html.slice(
      html.indexOf(`id="${dialog}"`),
      html.indexOf("</dialog>", html.indexOf(`id="${dialog}"`)),
    );
    assert.ok(
      back.startsWith("#") ? part.includes(`id="${back.slice(1)}"`) : part.includes("data-close"),
      dialog + " has " + back,
    );
  }
  assert.match(html, /By Phatty Acid Generative Studios/);
  for (const name of [
    "Gus Garza",
    "Phatty Acid Generative Studios",
    "Claude",
    "three.js",
    "Blender",
    "Electron",
  ])
    assert.ok(html.includes(name), "the credits name " + name);
  assert.ok(!/Unity/.test(html), "the credits name only what the game is made with");
  assert.match(html, /as of 20 October 2026, at least/);
  assert.match(css, /\.credits-page\[open\] \{\s*display: grid;/, "a closed dialog stays closed");
  assert.match(css, /body\.stage \.menu-art \{/, "the painted card is the fallback");
  assert.match(app, /new MenuStage\(\)\.load\(coach\)/);
  assert.match(app, /menuStage\.openDoors\(\{/);
  assert.match(
    app,
    /audio\.startMenu\("return", \{ fade: 6, level: 0\.7 \}\)/,
    "after a shift: quieter, slower",
  );
  assert.match(app, /audio\.stopMenu\(1\.2\)/, "the menu's music fades as the doors open");
  assert.match(app, /audio\.playing = false; \/\/ \(the menu plays its own music/);
  assert.match(
    app,
    /const waitForSwimmers = testing \|\| playHunt \|\| !!huntStep;/,
    "a trial or a hunt waits as before",
  );
  assert.match(app, /reducedMotion\.matches && !testing/);
  assert.match(app, /function applySettings\(/);
  assert.match(app, /world\?\.setBrightness\?\.\(s\.brightness \/ 100\)/);
}

// 7) FREE PLAY (21 October 2026): the pools, opened by the ladder; a difficulty opened by a run; a shift without the week.
{
  const week = await import("./dist/week.mjs");
  const { FREE_LEVELS, freePools, freeLevelOpen, freePlayShift, LADDER, LADDER_START, POOLS } = week;
  const first = freePools({ ladder: 3 });
  assert.equal(first.length, LADDER.length + 1, "every pool on the ladder and the arena");
  assert.deepEqual(
    first.filter((p) => p.open).map((p) => p.id),
    LADDER.slice(0, LADDER_START),
  );
  assert.ok(freePools({ ladder: 99, finale: true }).every((p) => p.open));
  assert.ok(freeLevelOpen("easy", 1) && !freeLevelOpen("normal", 5) && freeLevelOpen("normal", 8));
  assert.ok(!freeLevelOpen("expert", 17) && freeLevelOpen("expert", 18));
  for (const pool of [...LADDER, "arena"])
    for (const level of FREE_LEVELS) {
      const s = freePlayShift(pool, level.id, 4242);
      assert.equal(s.tier, level.tier);
      assert.equal(s.config.pool, pool);
      assert.equal(s.config.name, POOLS[pool].name);
      assert.ok(!("week" in s.config), "nothing of the week: no fund, no wishes");
      assert.deepEqual(s.config.free, { pool, level: level.id, name: level.name });
      assert.equal(s.wishes.length, 0);
      assert.ok(s.config.duration > 0 && s.config.total > 0 && s.config.thresholds.length === 3);
    }
  const easy = freePlayShift("club", "easy", 7),
    expert = freePlayShift("club", "expert", 7);
  assert.ok(
    expert.config.thresholds[1] > easy.config.thresholds[1] && expert.config.duration >= easy.config.duration,
  );
  assert.deepEqual(
    freePlayShift("disco", "hard", 99).config,
    freePlayShift("disco", "hard", 99).config,
    "seeded",
  );
  // The bests, kept per pool and difficulty.
  const { readFree, writeFree, recordFree, FREE_KEY } = await import("./dist/free-ui.mjs");
  const store = new Map(),
    storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const state = readFree(storage);
  assert.equal(recordFree(state, "kids", "easy", 1200, 2), true);
  assert.equal(recordFree(state, "kids", "easy", 900, 3), false, "a lower score is no new best");
  assert.deepEqual(state.bests["kids:easy"], { score: 1200, stars: 3 });
  writeFree(state, storage);
  assert.deepEqual(readFree(storage).bests["kids:easy"], { score: 1200, stars: 3 });
  assert.ok(lib.includes(`"${FREE_KEY}"`), "a save the desktop app keeps");
  // The app: FREE PLAY opens the window, a shift of it ends on its own results, Play again plays it again.
  assert.match(app, /\$\("wk-free"\)\.onclick = \(\) => freeUi\.open\(\);/);
  assert.match(app, /if \(sim\.config\.free\) return finishFree\(\);/);
  assert.match(
    app,
    /freeChoice \? startFree\(freeChoice\.pool, freeChoice\.level\) : start\(activeBooking\)/,
  );
  for (const id of [...LADDER, "arena"])
    assert.ok(existsSync(`dist/assets/menu/pools/${id}.webp`), id + "'s card has its picture");
}

console.log("title-check: ok");
