// The sound engineering pass (4 November 2026, the creator: "take the best practices out of FMOD … and implement in our game
// the same sound mechanics, sound systems, and sound engineering"). What a middleware gives a sound designer, as plain data the
// game's own Web Audio engine (audio.mjs) reads, so it can be tuned in one place and checked without a browser
// (sound-mix-check.mjs):
//
//   - a bus tree under the master: the music, and the effects in groups (one-shots, ambience, footsteps, voices, the interface),
//     Settings' two sliders over the two halves, a limiter at the end so nothing ever clips;
//   - snapshots: the mix of each moment of the game (the menu, a shift, paused, the results, the highlight replay), blended in;
//   - sidechain ducking: the music and the ambience dip under the moments that must be heard;
//   - voice limits: so many of one sound at once, a gap between two, the oldest stolen;
//   - 3D placement: a sound from somewhere on the deck is panned to where it is on the screen and softer and duller far off;
//   - a reverb per venue (a sent bus, a room made from noise);
//   - parameters driving loops: the venue's ambience bed, the swimmers' layer by how many are in the water, a swimmer's
//     struggle while they wait for a ring (the cramp);
//   - footsteps by surface and pace, and the coaches' efforts (never words) by what happens to them, each coach at their pitch.

// ---- the buses ---------------------------------------------------------------------------------------------------------------
// Each group's own level in the mix (under Settings' effects slider; the music has the music slider).
export const BUSES = { sfx: 1, amb: 0.75, foley: 0.85, voice: 0.95, ui: 1 };

// ---- snapshots ---------------------------------------------------------------------------------------------------------------
// What each moment of the game does to the mix: each group's level (times its own), and the game's mix through a low-pass
// (`lowpass`, Hz: muffled under a pause, as if heard through a door). The interface is never touched.
const FULL = { music: 1, sfx: 1, amb: 1, foley: 1, voice: 1, lowpass: 20000 };
export const SNAPSHOTS = {
  menu: { ...FULL, amb: 0, foley: 0, voice: 0 },
  shift: FULL,
  paused: { music: 0.5, sfx: 0.45, amb: 0.55, foley: 0, voice: 0, lowpass: 700 },
  results: { ...FULL, amb: 0.35, foley: 0, voice: 0.8 },
  replay: { ...FULL, music: 0.75, amb: 0.6 },
};
// The app's modes, as snapshots.
export function snapshotFor(mode) {
  if (mode === "playing" || mode === "countdown") return "shift";
  if (mode === "paused" || mode === "help" || mode === "playtest") return "paused";
  return SNAPSHOTS[mode] ? mode : "shift";
}
// How long a snapshot takes to blend in (seconds; a pause is felt at once, the rest eases).
export const SNAPSHOT_FADE = { paused: 0.12, menu: 0.8, shift: 0.5, results: 1, replay: 0.4 };

// ---- sidechain ducking -------------------------------------------------------------------------------------------------------
// The moments the music and the ambience make room for: [music dB, ambience dB, hold s]. Released over DUCK_RELEASE.
export const DUCKS = {
  "cramp-alarm": [-7, -6, 1.4],
  catastrophe: [-8, -6, 1.6],
  blackout: [-10, -9, 1.6],
  thunder: [-5, -4, 1.4],
  "monster-warning": [-7, -5, 2],
  "swell-warning": [-5, -4, 1.4],
  overboard: [-6, -5, 1.2],
  "coach-fell": [-5, -3, 1],
  "big-announce": [-6, -4, 1.6],
  "race-go": [-4, -3, 1],
  "race-finish": [-4, -3, 1.2],
  "streak-broken": [-4, -2, 0.8],
  "dive-result": [-3, -2, 1],
  "karen-arrive": [-5, -3, 1.6],
  vip: [-4, -2, 1],
  ended: [-6, -6, 2],
  sting: [-6, -4, 1.2], // an incident's sting (audio.sting)
  voice: [-3, -1, 0.5], // a coach's effort: the music leans back a little, like dialogue ducking
};
export const DUCK_ATTACK = 0.04;
export const DUCK_RELEASE = 0.7;
export const dbToGain = (db) => Math.pow(10, db / 20);

// ---- voice limits ------------------------------------------------------------------------------------------------------------
// At most `max` of one recorded sound at once (the oldest is stolen, faded out fast) and `gap` seconds between two starts
// (a second one sooner is dropped: twenty swimmers diving in on one tick are a few splashes, not a wall). `VOICE_CAP` voices in
// all; past it the oldest footstep, then the oldest anything, gives way.
export const LIMITS = {
  default: { max: 4, gap: 0.035 },
  splash: { max: 5, gap: 0.03 },
  cannonball: { max: 2, gap: 0.12 },
  thud: { max: 3, gap: 0.05 },
  "dog-bark": { max: 1, gap: 0.5 },
  "dog-growl": { max: 1, gap: 0.5 },
  monkey: { max: 2, gap: 0.25 },
  cheer: { max: 2, gap: 0.4 },
  roar: { max: 1, gap: 1 },
  laugh: { max: 1, gap: 0.6 },
  groan: { max: 1, gap: 0.6 },
  ooh: { max: 1, gap: 0.6 },
  whistle: { max: 1, gap: 0.15 },
  thunder: { max: 1, gap: 1.5 },
  door: { max: 2, gap: 0.25 },
  "door-close": { max: 2, gap: 0.25 },
  step: { max: 6, gap: 0.04 }, // every step-* sound
  vo: { max: 3, gap: 0.05 }, // every voice (one per coach: VOCAL_GAP)
};
export const VOICE_CAP = 32;
export function limitFor(key) {
  if (LIMITS[key]) return LIMITS[key];
  if (key.startsWith("step-")) return LIMITS.step;
  if (key.startsWith("vo-")) return LIMITS.vo;
  return LIMITS.default;
}

// ---- 3D placement ------------------------------------------------------------------------------------------------------------
// A sound at a place on the deck: panned by where it is across the screen (`sx`, −1 left to 1 right; never hard to one side,
// SPREAD), softer and duller with its distance (metres) from what the player is watching (their coach).
export const SPREAD = 0.65;
export function placement(sx, distance) {
  const pan = Math.max(-1, Math.min(1, sx)) * SPREAD;
  const d = Math.max(0, distance - 5);
  return {
    pan,
    gain: Math.max(0.4, 1 / (1 + d * 0.045)),
    lowpass: Math.max(2800, 20000 / (1 + d * 0.14)),
  };
}

// ---- the venues: their room, their ambience, their floor ---------------------------------------------------------------------
// The reverb's rooms: `seconds` of tail, `decay` (how fast it dies: higher dies sooner), `damp` (how dark the tail grows),
// `send` (how much of the effects goes in). An outdoor venue still has a short slap off its walls.
export const ROOMS = {
  hall: { seconds: 2.2, decay: 2.6, damp: 0.5, send: 0.2 },
  arena: { seconds: 3, decay: 2.4, damp: 0.55, send: 0.22 },
  glass: { seconds: 1.8, decay: 2.8, damp: 0.35, send: 0.18 },
  club: { seconds: 1, decay: 3.4, damp: 0.6, send: 0.12 },
  cave: { seconds: 1.4, decay: 3, damp: 0.6, send: 0.1 },
  outdoor: { seconds: 0.5, decay: 5, damp: 0.7, send: 0.05 },
};
// Each venue: its room, its ambience bed (an amb-* recording) and its level, its floor (a step-* recording), whether the
// swimmers' layer belongs (a pool people swim in).
export const VENUES = {
  club: { room: "hall", bed: "hall", bedLevel: 0.8, floor: "tile", swimmers: true },
  resort: { room: "outdoor", bed: "outdoor", bedLevel: 0.7, floor: "stone", swimmers: true },
  lagoon: { room: "outdoor", bed: "beach", bedLevel: 0.8, floor: "wood", swimmers: true },
  arena: { room: "arena", bed: "arena", bedLevel: 0.75, floor: "tile", swimmers: true },
  aquatic: { room: "hall", bed: "arena", bedLevel: 0.55, floor: "tile", swimmers: true },
  disco: { room: "club", bed: "club", bedLevel: 0.9, floor: "tile", swimmers: false },
  kids: { room: "outdoor", bed: "seaside", bedLevel: 0.8, floor: "tile", swimmers: true },
  senior: { room: "glass", bed: "conservatory", bedLevel: 1, floor: "tile", swimmers: true },
  river: { room: "cave", bed: "jungle", bedLevel: 0.85, floor: "stone", swimmers: false },
  wave: { room: "outdoor", bed: "beach", bedLevel: 0.6, floor: "sand", swimmers: false },
  roof: { room: "outdoor", bed: "city", bedLevel: 0.75, floor: "stone", swimmers: false },
  cruise: { room: "outdoor", bed: "sea", bedLevel: 0.8, floor: "wood", swimmers: true },
  onsen: { room: "outdoor", bed: "snow", bedLevel: 0.85, floor: "snow", swimmers: false },
  dive: { room: "outdoor", bed: "outdoor", bedLevel: 0.6, floor: "stone", swimmers: true },
};
export const venueSound = (id) => VENUES[id] || VENUES.club;

// The swimmers' layer: none in an empty pool, most of it by six in the water, all of it by a dozen.
export function swimmersLevel(count) {
  return count <= 0 ? 0 : Math.min(1, Math.sqrt(count / 12));
}

// ---- footsteps ---------------------------------------------------------------------------------------------------------------
// The surface under a coach: wading (the rooftop's pool, a hot spring), the hot springs' ice, else the venue's floor. A coach
// swimming, sliding or in the air makes no step.
export function stepSurface(venueId, c) {
  if (c.swimming || c.waterTransition || (c.y || 0) > 0.03 || c.sliding || c.slipTime > 0) return null;
  if (c.wading) return "water";
  if (c.onIce) return "skate";
  return venueSound(venueId).floor;
}
// A step every `stride` metres: longer strides when he runs (the coach's top speed is 7.6 m/s, a dash about twice it), and
// the run's steps heavier. Wading and skating take their own longer strides.
export const RUN_SPEED = 5.5;
export function stride(surface, speed) {
  if (surface === "water") return 1.1;
  if (surface === "skate") return 2.2;
  return speed > RUN_SPEED ? 1.55 : 1.05;
}
export function stepGain(speed, local) {
  const run = speed > RUN_SPEED;
  return (run ? 1 : 0.62) * (local ? 1 : 0.7);
}

// ---- the coaches' voices -----------------------------------------------------------------------------------------------------
// Never a word: efforts, yelps and sighs (vo-m-* a man's, vo-f-* a woman's). Each coach their own: Coach Rivers the woman's
// set, the men at their own pitch (Brooks older and lower, Storm the deepest, Fontaine a touch higher, Marsh gruff).
export const VOICES = {
  waters: { set: "m", pitch: 1 },
  brooks: { set: "m", pitch: 0.9 },
  rivers: { set: "f", pitch: 1 },
  storm: { set: "m", pitch: 0.84 },
  fontaine: { set: "m", pitch: 1.07 },
  marsh: { set: "m", pitch: 0.92 },
};
export const voiceOf = (look) => VOICES[look] || VOICES.waters;
// What a coach says to what (a sim event, or a clip of theirs starting: "clip:startle"): the effort, how likely (so it is not
// every time), and the least time before that effort again; `then`, a second sound straight after it, by its own chance.
export const VOCALS = {
  jump: { kind: "hup", chance: 0.55, cooldown: 1.2 },
  dash: { kind: "huff", chance: 0.5, cooldown: 1.5 },
  "coach-slip": { kind: "yelp", chance: 1, cooldown: 0.8, then: { kind: "oof", chance: 0.7 } }, // (and down he goes)
  "coach-fell": { kind: "scream", chance: 1, cooldown: 1.5 },
  save: { kind: "phew", chance: 0.55, cooldown: 4 },
  catastrophe: { kind: "argh", chance: 0.75, cooldown: 3 },
  "streak-broken": { kind: "argh", chance: 0.4, cooldown: 3 },
  "clip:startle": { kind: "gasp", chance: 0.8, cooldown: 2 },
  "clip:freakOut": { kind: "panic", chance: 1, cooldown: 6 },
  "clip:haul": { kind: "strain", chance: 0.85, cooldown: 2.5 },
};
// One mouth: a coach makes one sound at a time, at least this far apart.
export const VOCAL_GAP = 0.45;
export const VOCAL_KINDS = [
  ...new Set(Object.values(VOCALS).flatMap((v) => (v.then ? [v.kind, v.then.kind] : [v.kind]))),
];

// ---- the reverb's room, made from noise --------------------------------------------------------------------------------------
// Two channels of noise dying away (`decay`), darker as they go (`damp`, a one-pole low-pass closing over the tail), after a few
// milliseconds of silence (the first reflection's distance). `random` is for the checks (seeded).
export function impulse(ctx, room, random = Math.random) {
  const rate = ctx.sampleRate,
    length = Math.max(1, Math.floor(rate * room.seconds)),
    pre = Math.floor(rate * 0.012),
    buffer = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let low = 0;
    for (let i = pre; i < length; i++) {
      const t = (i - pre) / (length - pre);
      const k = 1 - room.damp * t * 0.97;
      low = low * (1 - k) + (random() * 2 - 1) * k;
      data[i] = low * Math.pow(1 - t, room.decay);
    }
  }
  return buffer;
}

// ---- every incident heard as it begins ----------------------------------------------------------------------------------
// (4 November 2026, the creator: "every time we have an incident, add a sound effect: the dog, the barks. The cannonball, we
// need a signature sound for Carl.") Each incident's sting is music (audio.sting); this is the thing itself, heard where it
// happens, as it starts: [recording, { delay, gain, rate }]. The incidents whose own first event already makes its sound (the
// blackout's power going down, the monkey's chatter, the selfie's shutter, a fall in, the storm's thunder, the monster wave's
// siren) are not here. Carl's signature runs through his whole incident: his belly laugh as he turns up, a war whoop on the
// run-up (carl-charge), a falling bomb's whistle in the air (carl-jump), the boom and the wall of water (cannonball).
export const INCIDENT_SOUNDS = {
  dog: [["dog-bark"], ["dog-bark", { delay: 0.55, rate: 1.05 }]],
  carl: [["carl-laugh", { delay: 0.2 }]],
  karen: [["karen-gasp"]],
  fish: [["kid-giggle"]],
  "fish-loose": [["fish-flop"]],
  cramp: [["whistle", { delay: 0.15 }]],
  spill: [["crowd-eww", { delay: 0.3 }]],
  pee: [["crowd-eww", { delay: 0.3, gain: 0.8 }]],
  closure: [["whistle"]],
  rush: [["crowd-rush"]],
  team: [["crowd-rush"]],
  class: [["crowd-rush", { gain: 0.7 }]],
  "line-cut": [["groan", { gain: 0.8 }]],
  dizzy: [["ooh"]],
  wet: [["plop", { rate: 1.4, gain: 0.7 }]],
};
