// The intro cinematic (5 November 2026, the creator: "whenever we are starting a new venue… a close-up of the coach always, and
// then… one more one-shot of the environment cinematic, like with the camera moving at lower level, and then another one of the
// coach with a nervous animation… like the minigames in Mario Party… very, very brief… a toggle… apply this for every venue").
//
// Three shots in real time, in the venue as it is, before the countdown: the shift waits (app.mjs holds the simulation) and any key
// or click skips it; Settings' Intro cinematics turns it off. Render only: nothing here moves the simulation.
//   1. COACH    (1.5 s) a close-up of Coach Waters where he will walk in from, the camera easing in on his face;
//   2. VENUE    (1.9 s) a low sweep across the venue, round its middle, at about head height, the venue's name on screen;
//   3. NERVOUS  (1.5 s) the coach from low and close again: a jolt (Startle), then the FreakOut, panic on his face.
// Positions are worked out in the venue's own frame (the deck), and put through the scene's turn (the Cruise Ship's roll).

export const SHOTS = [
  { kind: "coach", seconds: 1.5, fov: 30 },
  { kind: "venue", seconds: 1.9, fov: 46 },
  { kind: "nervous", seconds: 1.5, fov: 36 },
];
export const CINEMATIC_SECONDS = SHOTS.reduce((t, s) => t + s.seconds, 0);

const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });

// How far one can go from (cx, cz) along the angle before leaving the deck's rectangle.
function reach(deck, cx, cz, angle) {
  const dx = Math.cos(angle),
    dz = Math.sin(angle);
  let t = Infinity;
  if (dx > 1e-6) t = Math.min(t, (deck.maxX - cx) / dx);
  if (dx < -1e-6) t = Math.min(t, (deck.minX - cx) / dx);
  if (dz > 1e-6) t = Math.min(t, (deck.maxZ - cz) / dz);
  if (dz < -1e-6) t = Math.min(t, (deck.minZ - cz) / dz);
  return t;
}

// The three shots' cameras for this venue and this coach (where he stands, the way he faces: the walk-in's start), and the overview's
// side (`side`: the direction from the pool to the game's camera, so the sweep starts from where the player will look from).
export function planCinematic(venue, coach, side = { x: -0.65, z: 0 }) {
  const a = coach.angle ?? Math.PI / 2,
    f = { x: Math.sin(a), z: Math.cos(a) }, // the way he faces
    r = { x: Math.cos(a), z: -Math.sin(a) }, // his right… or left: either side of the face reads
    at = (k, s, y) => ({ x: coach.x + f.x * k + r.x * s, y, z: coach.z + f.z * k + r.z * s });
  const head = { x: coach.x, y: 1.4, z: coach.z };
  const shots = [];
  let start = 0;
  for (const shot of SHOTS) {
    let cam;
    if (shot.kind === "coach")
      cam = {
        from: at(3.0, 1.0, 1.65),
        to: at(2.1, 0.55, 1.5),
        lookFrom: { ...head, y: 1.3 },
        lookTo: head,
      };
    else if (shot.kind === "nervous")
      cam = {
        from: at(2.2, -0.8, 0.85),
        to: at(1.75, -0.45, 0.95),
        lookFrom: { ...head, y: 1.25 },
        lookTo: { ...head, y: 1.35 },
        shake: 0.035,
      };
    else {
      // round the pool's middle at about head height, a third of a turn's worth of sweep at most, kept inside the deck
      const d = venue.deck,
        c = { x: 0, z: 0 },
        a0 = Math.atan2(side.z, side.x),
        span = 0.5,
        radius = (ang) => Math.max(4, Math.min(12, reach(d, c.x, c.z, ang) - 1.2) * 0.85),
        point = (ang, y) => ({
          x: c.x + Math.cos(ang) * radius(ang),
          y,
          z: c.z + Math.sin(ang) * radius(ang),
        });
      cam = {
        from: point(a0 - span, 1.45),
        to: point(a0 + span, 1.9),
        lookFrom: { x: c.x, y: 0.2, z: c.z },
        lookTo: { x: c.x, y: 0.4, z: c.z },
        sweep: true,
      };
    }
    shots.push({ ...shot, ...cam, start, end: start + shot.seconds });
    start += shot.seconds;
  }
  return { shots, total: start, coach: { x: coach.x, z: coach.z, angle: a } };
}

// Where the camera is at `t` seconds in (and which shot), or null when it is over.
export function cinematicAt(plan, t, clock = 0) {
  if (!plan || t >= plan.total) return null;
  const index = Math.max(
      0,
      plan.shots.findIndex((s) => t < s.end),
    ),
    s = plan.shots[index],
    k = ease(Math.min(1, Math.max(0, (t - s.start) / s.seconds))),
    pos = mix3(s.from, s.to, s.sweep ? (t - s.start) / s.seconds : k),
    look = mix3(s.lookFrom, s.lookTo, k);
  if (s.shake) {
    pos.x += Math.sin(clock * 37) * s.shake;
    pos.y += Math.sin(clock * 43) * s.shake * 0.6;
    pos.z += Math.cos(clock * 31) * s.shake;
  }
  return { index, kind: s.kind, fov: s.fov, pos, look, inShot: t - s.start };
}
