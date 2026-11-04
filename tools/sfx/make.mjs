// Makes the recorded sound effects of tools/sfx/sounds.mjs with ElevenLabs Sound Effects v3 on fal, and readies them for the game:
//
//   FAL_KEY=… node tools/sfx/make.mjs            every take not made yet (tools/sfx/raw/, not committed)
//   node tools/sfx/make.mjs --process-only       only the second step, from what is in raw/
//   … --only=dog-bark,step-tile                   only these sounds (made if missing, then readied)
//
// Each take is then trimmed of its leading silence, made mono, given a short fade at its end, brought to the same loudness
// (peak −1 dBFS) and encoded at 64 kbps into dist/assets/sfx/<key>-<n>.mp3. dist/audio-files.mjs lists them (`SFX`).
// A `loop` (an ambience bed, the cramp's struggle) is asked for as a seamless loop and kept whole: no trim, no fade, 48 kbps.
// A `slice` sound (the footsteps) is made as a few takes of several steps (`slice.raws`), and its takes are the clearest single
// steps cut out of them, each `slice.length` seconds at most.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, existsSync, statSync } from "node:fs";
import { SOUNDS } from "./sounds.mjs";

const run = promisify(execFile);
const ENDPOINT = "elevenlabs/sound-effects/v3";
const RAW = new URL("./raw/", import.meta.url).pathname;
const OUT = new URL("../../dist/assets/sfx/", import.meta.url).pathname;
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

const curl = async (args) =>
  (await run("curl", ["-sS", "--max-time", "120", ...args], { maxBuffer: 1 << 26 })).stdout;
const authed = () => [
  "-H",
  "Authorization: Key " + process.env.FAL_KEY,
  "-H",
  "Content-Type: application/json",
];

const rawName = (sound, n) => `${RAW}${sound.key}-${sound.slice ? "r" : ""}${n}.mp3`;
async function make(sound, n) {
  const raw = rawName(sound, n);
  if (existsSync(raw) && statSync(raw).size > 1000) return raw;
  const body = JSON.stringify({
    text: sound.text,
    duration_seconds: sound.seconds,
    prompt_influence: 0.55,
    output_format: "mp3_44100_128",
    ...(sound.loop ? { loop: true } : {}),
  });
  const queued = JSON.parse(
    await curl(["-X", "POST", ...authed(), "-d", body, `https://queue.fal.run/${ENDPOINT}`]),
  );
  if (!queued.status_url)
    throw new Error(sound.key + ": not queued: " + JSON.stringify(queued).slice(0, 200));
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const s = JSON.parse(await curl([...authed(), queued.status_url]));
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.error) throw new Error(sound.key + ": " + JSON.stringify(s).slice(0, 200));
  }
  const result = JSON.parse(await curl([...authed(), queued.response_url]));
  const url = result.audio?.url;
  if (!url) throw new Error(sound.key + ": no audio: " + JSON.stringify(result).slice(0, 200));
  await curl(["-L", "-o", raw, url]);
  console.log("made", sound.key, n);
  return raw;
}

const peakOf = async (args) => {
  const { stderr } = await run("ffmpeg", ["-hide_banner", ...args, "-af", "volumedetect", "-f", "null", "-"]);
  return Number(/max_volume: (-?[\d.]+) dB/.exec(stderr)?.[1] ?? 0);
};
async function ready(sound, n) {
  const raw = rawName(sound, n),
    out = `${OUT}${sound.key}-${n}.mp3`;
  if (sound.loop) {
    const gain = (-1 - (await peakOf(["-i", raw]))).toFixed(2);
    await run("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      raw,
      "-ac",
      "1",
      "-af",
      `volume=${gain}dB`,
      "-b:a",
      "48k",
      out,
    ]);
    return out;
  }
  // (peak to −1 dBFS; leading silence off; mono; a 60 ms fade at the end; 64 kbps)
  const { stderr } = await run("ffmpeg", [
    "-hide_banner",
    "-i",
    raw,
    "-af",
    "volumedetect",
    "-f",
    "null",
    "-",
  ]);
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(stderr)?.[1] ?? 0);
  const gain = (-1 - peak).toFixed(2);
  await run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    raw,
    "-ac",
    "1",
    "-af",
    `volume=${gain}dB,silenceremove=start_periods=1:start_threshold=-45dB,areverse,afade=t=in:d=0.06,areverse`,
    "-b:a",
    "64k",
    out,
  ]);
  return out;
}

// The steps in a raw take: where the level jumps up out of a quiet stretch (10 ms windows), at least 0.22 s apart.
async function stepsIn(raw, length) {
  const rate = 22050;
  const { stdout } = await run(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", raw, "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"],
    {
      encoding: "buffer",
      maxBuffer: 1 << 26,
    },
  );
  const pcm = new Float32Array(stdout.buffer, stdout.byteOffset, stdout.byteLength / 4);
  const win = Math.round(rate / 100),
    env = [];
  for (let i = 0; i + win <= pcm.length; i += win) {
    let sum = 0;
    for (let j = i; j < i + win; j++) sum += pcm[j] * pcm[j];
    env.push(Math.sqrt(sum / win));
  }
  const top = Math.max(...env),
    found = [];
  let quiet = true;
  for (let i = 0; i < env.length; i++) {
    if (quiet && env[i] > top * 0.22 && (!found.length || i - found.at(-1).at >= 22)) {
      found.push({ at: i, peak: Math.max(...env.slice(i, i + 12)) });
      quiet = false;
    } else if (env[i] < top * 0.08) quiet = true;
  }
  return found.map((f, k) => {
    const start = Math.max(0, f.at / 100 - 0.012),
      next = found[k + 1] ? found[k + 1].at / 100 - 0.03 : env.length / 100;
    return { raw, start, dur: Math.min(length, next - start), peak: f.peak };
  });
}
async function slices(sound) {
  const all = [];
  for (let n = 1; n <= sound.slice.raws; n++)
    if (existsSync(rawName(sound, n))) all.push(...(await stepsIn(rawName(sound, n), sound.slice.length)));
  // the clearest steps: long enough to be whole, then the loudest
  const best = all
    .filter((s) => s.dur > 0.12)
    .sort((a, b) => b.peak - a.peak)
    .slice(0, sound.takes);
  if (best.length < sound.takes) throw new Error(`${sound.key}: only ${best.length} steps found`);
  for (const [i, s] of best.entries()) {
    const out = `${OUT}${sound.key}-${i + 1}.mp3`,
      cut = ["-ss", s.start.toFixed(3), "-t", s.dur.toFixed(3), "-i", s.raw];
    const gain = (-1 - (await peakOf(cut))).toFixed(2);
    await run("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      ...cut,
      "-ac",
      "1",
      "-af",
      `volume=${gain}dB,afade=t=in:d=0.004,afade=t=out:st=${(s.dur - 0.06).toFixed(3)}:d=0.06`,
      "-b:a",
      "64k",
      out,
    ]);
  }
}

const only = process.argv
  .find((a) => a.startsWith("--only="))
  ?.slice(7)
  .split(",");
const jobs = SOUNDS.flatMap((s) =>
  Array.from({ length: s.slice ? s.slice.raws : s.takes }, (_, i) => [s, i + 1]),
);
if (!process.argv.includes("--process-only")) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is needed to make the sounds");
  const queue = jobs.filter(([s]) => !only || only.includes(s.key));
  const failed = [];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const [s, n] = queue.shift();
        try {
          await make(s, n);
        } catch (e) {
          failed.push(s.key + "-" + n);
          console.error(e.message);
        }
      }
    }),
  );
  if (failed.length) console.error("failed:", failed.join(", "));
}
for (const s of SOUNDS) if (s.slice && (!only || only.includes(s.key))) await slices(s);
for (const [s, n] of jobs)
  if (!s.slice && (!only || only.includes(s.key)) && existsSync(rawName(s, n))) await ready(s, n);
console.log("ready:", jobs.length, "takes");
