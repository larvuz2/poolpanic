// Recorded sounds that replace the procedural stand-ins, one list per sound. Leave a list empty and the game
// synthesises a placeholder; put files under dist/assets/audio/ and list them here to use them instead (each play picks
// one at random). Paths are relative to this file. mp3, ogg and wav all work.
//
//   karen: Karen's complaining (a squawk every one to two seconds while she is loud: "Excuse me?!", "This is
//          unacceptable!", sighs, tutting). Short clips, 0.4 to 1.5 seconds each, work best.
export const AUDIO_FILES = {
  karen: [
    // "./assets/audio/karen-complain-1.mp3",
    // "./assets/audio/karen-complain-2.mp3",
  ],
};

// The recorded sound effects (3 November 2026, the creator: "the splashing of the water whenever a swimmer dives in: it's very
// mechanical now. We need a more natural splash"): made with ElevenLabs Sound Effects v3 on fal by tools/sfx/make.mjs from the
// descriptions in tools/sfx/sounds.mjs, in dist/assets/sfx/<key>-<n>.mp3. A sound plays one of its `takes` at random (never the
// same one twice running, a little higher or lower each time), at `gain`: matched to the loudness of the synthesised sound it
// replaced (measured offline), so the mix stays as it was. The game's musical cues stay synthesised; a take that will not load
// leaves the synthesised sound playing (PoolAudio.sfx).
export const SFX = {
  splash: { takes: 4, gain: 0.56 },
  cannonball: { takes: 3, gain: 1.16 },
  bellyflop: { takes: 2, gain: 1.33 },
  rip: { takes: 2, gain: 0.22 },
  "fall-in": { takes: 2, gain: 0.44 },
  plop: { takes: 3, gain: 0.34 },
  "step-in": { takes: 2, gain: 0.18 },
  "wave-crash": { takes: 3, gain: 0.18 },
  "wave-launch": { takes: 2, gain: 0.11 },
  spill: { takes: 2, gain: 0.53 },
  glug: { takes: 2, gain: 0.22 },
  "net-swish": { takes: 2, gain: 0.29 },
  thunder: { takes: 3, gain: 0.76 },
  creak: { takes: 3, gain: 0.08 },
  "ship-bell": { takes: 1, gain: 0.22 },
  foghorn: { takes: 1, gain: 0.13 },
  "air-horn": { takes: 1, gain: 0.19 },
  siren: { takes: 1, gain: 0.08 },
  "dog-bark": { takes: 3, gain: 0.17 },
  "dog-growl": { takes: 2, gain: 0.2 },
  "dog-shake": { takes: 2, gain: 0.41 },
  monkey: { takes: 3, gain: 0.1 },
  "monkey-screech": { takes: 2, gain: 0.08 },
  cheer: { takes: 3, gain: 0.23 },
  roar: { takes: 2, gain: 0.18 },
  laugh: { takes: 2, gain: 0.19 },
  groan: { takes: 2, gain: 0.2 },
  ooh: { takes: 1, gain: 0.16 },
  whistle: { takes: 2, gain: 0.08 },
  starter: { takes: 1, gain: 0.16 },
  thud: { takes: 3, gain: 0.56 },
  door: { takes: 2, gain: 0.24 },
  clink: { takes: 2, gain: 0.12 },
  tray: { takes: 1, gain: 0.15 },
  "service-bell": { takes: 1, gain: 0.26 },
  shutter: { takes: 1, gain: 0.25 },
  towel: { takes: 2, gain: 0.16 },
  scrape: { takes: 2, gain: 0.11 },
  knock: { takes: 1, gain: 0.29 },
  "power-down": { takes: 1, gain: 0.18 },
  "power-up": { takes: 1, gain: 0.19 },
  flicker: { takes: 1, gain: 0.08 },
  flop: { takes: 1, gain: 0.28 },
  bonk: { takes: 2, gain: 0.21 },
  springboard: { takes: 2, gain: 0.13 },
  whoosh: { takes: 1, gain: 0.08 },
};
export const sfxUrl = (key, n) => `./assets/sfx/${key}-${n}.mp3`;
