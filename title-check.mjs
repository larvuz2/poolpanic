// The main menu (20 October 2026): the title screen's settings, tips and loading label (dist/title.mjs), the menu's recorded
// music and the two mixes under the master (dist/audio.mjs), the 3D stage's numbers and pictures (dist/scene/menu-stage.mjs),
// and how the page and the app are wired to them. The stage itself is drawn by a browser: this checks what can be checked
// without one.
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
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

// 5) The stage: its painting, where the doors are on it, the doors' light, and how it is drawn.
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
  assert.deepEqual(
    size("dist/assets/menu/door-light.webp"),
    [474, 520],
    "the doors' light is the size of the doors",
  );
  globalThis.document ??= { createElement: () => ({ getContext: () => null }) };
  const { STAGE } = await import("./dist/scene/menu-stage.mjs");
  const { IMG, LEAVES, PX, wy, HALL, PACE, DOOR_SPOT } = STAGE;
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
    "entry",
    "entry-go",
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
  ])
    assert.ok(html.includes(`id="${id}"`), id + " is on the page");
  assert.match(html, /CLICK TO ENTER/);
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

console.log("title-check: ok");
