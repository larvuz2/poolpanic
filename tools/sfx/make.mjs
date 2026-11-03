// Makes the recorded sound effects of tools/sfx/sounds.mjs with ElevenLabs Sound Effects v3 on fal, and readies them for the game:
//
//   FAL_KEY=… node tools/sfx/make.mjs            every take not made yet (tools/sfx/raw/, not committed)
//   node tools/sfx/make.mjs --process-only       only the second step, from what is in raw/
//
// Each take is then trimmed of its leading silence, made mono, given a short fade at its end, brought to the same loudness
// (peak −1 dBFS) and encoded at 64 kbps into dist/assets/sfx/<key>-<n>.mp3. dist/audio-files.mjs lists them (`SFX`).
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

async function make(sound, n) {
  const raw = `${RAW}${sound.key}-${n}.mp3`;
  if (existsSync(raw) && statSync(raw).size > 1000) return raw;
  const body = JSON.stringify({
    text: sound.text,
    duration_seconds: sound.seconds,
    prompt_influence: 0.55,
    output_format: "mp3_44100_128",
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

async function ready(sound, n) {
  const raw = `${RAW}${sound.key}-${n}.mp3`,
    out = `${OUT}${sound.key}-${n}.mp3`;
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

const jobs = SOUNDS.flatMap((s) => Array.from({ length: s.takes }, (_, i) => [s, i + 1]));
if (!process.argv.includes("--process-only")) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is needed to make the sounds");
  const queue = jobs.slice();
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
for (const [s, n] of jobs) if (existsSync(`${RAW}${s.key}-${n}.mp3`)) await ready(s, n);
console.log("ready:", jobs.length, "takes");
