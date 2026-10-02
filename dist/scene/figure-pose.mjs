// How a cannonball man (Carl or the leopard man, drawn by a model: swimmer-models.mjs) goes through the Cannonball incident. The
// simulation moves him (incidents/carl.mjs: walk, wind up, charge, fly, float, swim, climb out); his Cannonball clip is made in
// place (tools/blender/cannonball_clip.py, 24 frames a second), so it is played frame by frame from where he is in that, and
// the crouch, the take-off and the splash happen when the simulation says they do:
//   - wind-up and charge: he stays at the edge (the classic Carl backs away and runs up again) and crouches, slowly, with the
//     arms swung back (the clip from its first frame to the bottom of the crouch), then pushes off (to the take-off);
//   - flight: the clip from the take-off to the frame where he reaches the water (the jump itself is the clip's, the simulation
//     carries him over the water);
//   - in the water, until he is out: the Swim clip, on his front. He settles into the water and rolls over onto his front just
//     after the splash (`lie` goes from 0, upright, to 1) and stands up again as he climbs out.
// Pure functions of the visitor's state, so a check can drive them without a scene.
import { CARL_TUNING as T } from "../incidents/carl.mjs";

// The frames of the Cannonball clip (the manifest's water.run holds the take-off and the splash; the push is where the
// crouch ends).
export const CLIP = { fps: 24, down: 13, takeoff: 20, splash: 37, end: 54 };
// How long after the splash he takes to settle onto his front, seconds.
export const SETTLE = 0.45;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

// What the model does for the visitor's `status` and `timer`:
//   at: "edge" when he is drawn at the edge, not where the simulation has him;
//   jump: the Cannonball clip's time (seconds), or null when it is not playing;
//   swim, stroke: the Swim clip and its rate;
//   lie: 0 upright to 1 on his front in the water;
//   puppet: the classic arms and legs' climbing pose is copied onto the model.
export function figurePose(v) {
  const f = 1 / CLIP.fps;
  switch (v.status) {
    case "windup":
      return { at: "edge", jump: (1 - v.timer / T.windup) * CLIP.down * f, lie: 0 };
    case "charge":
      return {
        at: "edge",
        jump: (CLIP.down + (1 - v.timer / T.charge) * (CLIP.takeoff - CLIP.down)) * f,
        lie: 0,
      };
    case "flying":
      return { jump: (CLIP.takeoff + (1 - v.timer / T.flight) * (CLIP.splash - CLIP.takeoff)) * f, lie: 0 };
    case "floating":
      return { swim: true, stroke: 0.7, lie: smooth((T.float - v.timer) / SETTLE) };
    case "swimming":
      return { swim: true, stroke: 0.9, lie: 1 };
    case "climbing":
      return { lie: clamp(v.timer / T.climb, 0, 1), puppet: true };
    default:
      return { lie: 0 };
  }
}
