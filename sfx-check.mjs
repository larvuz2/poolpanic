// The recorded sound effects (dist/audio-files.mjs SFX, tools/sfx/; README "Recorded sound effects"): every take listed is a file
// in dist/assets/sfx/ (an MP3, small), the list is the one tools/sfx/sounds.mjs makes, each sound has a level, and the game plays
// every one of them from `recorded()` with the synthesised sound kept for when a recording is not in.
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { SFX, sfxUrl } from "./dist/audio-files.mjs";
import { SOUNDS } from "./tools/sfx/sounds.mjs";
import { VENUES, VOCAL_KINDS, VOICES } from "./dist/sound-mix.mjs";

const audio = readFileSync("dist/audio.mjs", "utf8");
// (the footsteps, the coaches' voices and the ambience beds are named from the mix's tables: sound-mix.mjs)
const played = new Set([
  ...Object.values(VENUES).flatMap((v) => ["step-" + v.floor, "amb-" + v.bed]),
  "step-water",
  "step-skate",
  "amb-swimmers",
  ...VOCAL_KINDS.flatMap((kind) =>
    [...new Set(Object.values(VOICES).map((v) => v.set))].map((set) => `vo-${set}-${kind}`),
  ),
]);
let bytes = 0,
  takes = 0;
assert.deepEqual(
  Object.keys(SFX).sort(),
  SOUNDS.map((s) => s.key).sort(),
  "the game's list is the made list",
);
for (const s of SOUNDS) {
  const sfx = SFX[s.key];
  assert.equal(sfx.takes, s.takes, s.key + ": every take made is listed");
  assert.ok(sfx.gain > 0 && sfx.gain <= 1.5, s.key + ": a level");
  for (let n = 1; n <= sfx.takes; n++) {
    const file = new URL(sfxUrl(s.key, n), new URL("./dist/audio-files.mjs", import.meta.url)).pathname;
    assert.ok(existsSync(file), file);
    const data = readFileSync(file);
    // (a footstep can be a single step of a few kilobytes; a loop, the ambience beds, up to 20 s at 48 kbps)
    assert.ok(data.length > 1000 && data.length < (s.loop ? 160 : 64) * 1024, file + ": a short clip");
    // (an MP3: an ID3 tag or a frame sync)
    assert.ok(
      data.slice(0, 3).toString() === "ID3" || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0),
      file + ": an MP3",
    );
    bytes += statSync(file).size;
    takes++;
  }
  assert.ok(audio.includes(`"${s.key}"`) || played.has(s.key), s.key + ": played by the game");
}
assert.equal(readdirSync("dist/assets/sfx").length, takes, "no stray files in dist/assets/sfx/");
assert.ok(bytes < 4 * 1024 * 1024, "the recordings stay small: " + bytes);
// (the creator, 4 November 2026: the power coming back and the lights' flicker stay synthesised)
assert.ok(!SFX["power-up"] && !SFX.flicker, "the flicker and the power back are the original sounds");
for (const key of played) assert.ok(SFX[key], key + ": made");
// Wired in: the recordings load with the sound, played before the synthesised effect, never the same take twice running.
assert.match(audio, /this\.loadSfx\(\);/);
assert.match(audio, /if \(this\.recorded\(type, e, t\)\) return;/);
assert.match(audio, /if \(takes\.length > 1 && i === this\.sfxLast\[key\]\) i = \(i \+ 1\) % takes\.length;/);
assert.match(
  audio,
  /if \(!this\.ctx \|\| !this\.enabled \|\| !takes\?\.length\) return false;/,
  "no recording: the synth plays",
);
assert.match(audio, /this\.sfx\(big \? "roar" : "cheer", t\)/, "the crowd's cheer recorded");

console.log(
  `Recorded sound checks passed: ${SOUNDS.length} sounds in ${takes} takes (${Math.round(bytes / 1024)} KB), each listed with its level, an MP3 on disk, and played by the game ahead of its synthesised stand-in.`,
);
