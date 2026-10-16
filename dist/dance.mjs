// The Aqua Disco's beat (16 October 2026): one clock for the music (music.mjs), the class in the water and Valentina on the stage
// (scene/disco.mjs, the swimmer models), and the lights. Pure: a time in seconds in, where the routine is out. Render only: it
// reads the shift's clock and moves nothing in the simulation.
//
// The routine is the three dance clips (tools/blender/character_clips.py, `dance_clip`), four beats each at 120 BPM, two bars
// of each in turn: the right arm, the left arm, both arms; then again, for as long as the shift lasts.

export const BPM = 120;
export const BEAT = 60 / BPM; // seconds
export const BAR = 4; // beats in a bar (one clip)
export const ROUTINE = ["right", "right", "left", "left", "both", "both"];
// The SwimmerRig action each move plays (swimmer-models.mjs CLIPS).
export const DANCE_CLIP = { right: "danceRight", left: "danceLeft", both: "danceBoth" };

const mod = (a, n) => ((a % n) + n) % n;

// Where the routine is `seconds` into the shift: the move, its clip, the time inside the clip (0 to one bar), the beat count
// and where inside the beat (0 on the beat, to 1), and the bar.
export function danceAt(seconds) {
  const beats = Math.max(0, seconds) / BEAT,
    bar = Math.floor(beats / BAR),
    move = ROUTINE[mod(bar, ROUTINE.length)];
  return {
    move,
    clip: DANCE_CLIP[move],
    time: mod(beats, BAR) * BEAT,
    beats,
    beat: Math.floor(beats),
    phase: mod(beats, 1),
    bar,
  };
}

// How hard the light pulses on the beat: 1 on the beat, falling away to 0 before the next.
export const pulse = (phase) => Math.exp(-phase * 5);
