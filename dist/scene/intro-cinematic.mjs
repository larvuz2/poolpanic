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
//
// Some venues have a beat of their own between the sweep and the nervous coach (5 November 2026, the creator: "for the mountain
// hot springs… a close-up of the monkey… behind a rock… a second and a half… the Aqua Disco… the coach on the stage… the jumping
// pool… a crane shot starting from low to high to see all of the [boards]… the rooftop pool… a close-up of the DJ and the
// bartender"): `VENUE_SHOTS`, each framing a subject the venue's scene puts on the world (`world.cineSpots`: where it stands, the
// way it faces, how high its head is, or a camera of its own); a subject the scene has not put there is left out. At the Jumping
// Pool the sweep is a crane instead (`CRANE`), from low by the near side up over the pool, both diving stations in view.

export const SHOTS = [
  { kind: "coach", seconds: 1.5, fov: 30 },
  { kind: "venue", seconds: 1.9, fov: 46 },
  { kind: "nervous", seconds: 1.5, fov: 36 },
];
// (the common three; a venue with a beat of its own runs a little longer: `planCinematic(...).total`)
export const CINEMATIC_SECONDS = SHOTS.reduce((t, s) => t + s.seconds, 0);
// Its last half second dips to black (6 November 2026, the creator: "add the fade to black at the end too"); the game then comes up
// out of the black (app.mjs). It opens from black too.
export const FADE_OUT = 0.5;
export const VENUE_SHOTS = {
  onsen: [{ kind: "monkey", seconds: 1.5, fov: 34 }],
  disco: [{ kind: "valentina", seconds: 1.5, fov: 30 }],
  roof: [
    { kind: "dj", seconds: 1.2, fov: 30 },
    { kind: "bartender", seconds: 1.2, fov: 30 },
  ],
};
export const CRANE = { dive: { kind: "crane", seconds: 2.3, fov: 40, fovTo: 56 } };
// The shots in this venue, in order: the coach, the venue (or its crane), its own beats, the nervous coach.
export function shotsFor(venueId, spots = {}) {
  const own = (VENUE_SHOTS[venueId] || []).filter((s) => spots[s.kind]);
  return [SHOTS[0], CRANE[venueId] || SHOTS[1], ...own, SHOTS[2]];
}
// Which shots show the coach (the others are the venue's alone: he steps out of them).
export const COACH_SHOTS = new Set(["coach", "nervous"]);

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
// `spots`: the venue's subjects (world.cineSpots), for its own shots.
export function planCinematic(venue, coach, side = { x: -0.65, z: 0 }, spots = {}) {
  const a = coach.angle ?? Math.PI / 2,
    f = { x: Math.sin(a), z: Math.cos(a) }, // the way he faces
    r = { x: Math.cos(a), z: -Math.sin(a) }, // his right… or left: either side of the face reads
    at = (k, s, y) => ({ x: coach.x + f.x * k + r.x * s, y, z: coach.z + f.z * k + r.z * s });
  const head = { x: coach.x, y: 1.4, z: coach.z };
  const shots = [];
  let start = 0;
  for (const shot of shotsFor(venue.id, spots)) {
    let cam;
    const spot = spots[shot.kind];
    if (spot) cam = spot.cam || subject(spot);
    else if (shot.kind === "crane") cam = crane(venue);
    else if (shot.kind === "coach")
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

// A close-up of someone the venue has (`p`: where they stand, `y` the floor under them, `angle` the way they face, `head` its
// height above that floor, `dist` how far in front the camera ends, `side` how far to one side): in front of them, easing in.
function subject(p) {
  const a = p.angle ?? 0,
    f = { x: Math.sin(a), z: Math.cos(a) },
    r = { x: Math.cos(a), z: -Math.sin(a) },
    dist = p.dist ?? 2.4,
    side = p.side ?? 0.7,
    head = (p.y ?? 0) + (p.head ?? 1.5),
    at = (k, s, y) => ({ x: p.x + f.x * k + r.x * s, y, z: p.z + f.z * k + r.z * s });
  return {
    from: at(dist * 1.3, side * 1.4, head + 0.25),
    to: at(dist, side, head + 0.05),
    lookFrom: { x: p.x, y: head - 0.15, z: p.z },
    lookTo: { x: p.x, y: head - 0.05, z: p.z },
  };
}
// The Jumping Pool's crane: from low on the near side, looking up at the high boards at the right end, rising over the pool's near
// edge and tilting down until both diving stations, all six boards, are in view (the camera looks from -x, dive-plan.mjs).
function crane(venue) {
  const d = venue.deck;
  return {
    from: { x: d.minX + 2.4, y: 0.8, z: 1.5 },
    to: { x: d.minX + 2.0, y: 13.5, z: -1.0 },
    lookFrom: { x: 0, y: 3.4, z: 9.5 },
    lookTo: { x: 1.8, y: 0.5, z: 0 },
  };
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
  const fov = s.fovTo ? lerp(s.fov, s.fovTo, k) : s.fov;
  return { index, kind: s.kind, fov, pos, look, inShot: t - s.start, seconds: s.seconds };
}
