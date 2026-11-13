import { CLUB } from "./spatial.mjs";

const DIAMETER = 0.72;
export const BUMP_DURATION = 0.48;
// This file runs for everybody on deck sixty times a second, so nothing in it makes a list, a function or an object as it goes
// (13 November 2026: it was a tenth of all the memory the game used up while playing). The sums, and their order, are as they
// were: a shift plays to the same last bit.
const ON_FOOT = new Set([
  "queue",
  "arriving",
  "enter",
  "exit",
  "evacuating",
  "panic",
  "recovering",
  "injured",
]);
export function onDeck(p, venue = CLUB) {
  return (
    (ON_FOOT.has(p.status) ||
      (p.status === "fleeing" && p.fleePhase === "run") ||
      // (the Jumping Pool's divers on their way to a board's line, and standing in it: dive.mjs)
      (p.status === "dive" && (p.dive === "walk" || p.dive === "line"))) &&
    p.recoveryStage !== "resting" &&
    !p.evacWater &&
    p.exitPhase !== "water" &&
    p.exitPhase !== "climb" &&
    !inWater(venue, p.x, p.z)
  );
}
// Inside the water as deck contacts see it: the basin's box, or the Lazy River's channel (a little out over its banks).
function inWater(venue, x, z) {
  if (venue.river) return venue.river.inWater(x, z, -0.2) && !venue.river.onBridge(x, z);
  if (venue.onsen) return venue.onsen.inWater(x, z, -0.2);
  return Math.abs(x) < venue.pool.deckX && Math.abs(z) < venue.pool.deckZ;
}
// (The Kids Pool's children wait running about the deck, not standing in line: sim.roamKid.)
const resting = (p) => (p.status === "queue" && p.type !== "child") || p.status === "panic";

// Corrections respect solid deck edges. Authored door/entry transitions retain their routes.
const allowed = (venue, level, safe, x, z) => {
  const d = venue.deck;
  return (
    x >= d.minX &&
    x <= d.maxX &&
    z >= d.minZ &&
    z <= d.maxZ &&
    !inWater(venue, x, z) &&
    (!safe || venue.isDeck(x, z, level))
  );
};
function displace(p, x, z, sim) {
  const venue = sim.venue,
    level = sim.level,
    safe = venue.isDeck(p.x, p.z, level);
  if (allowed(venue, level, safe, p.x + x, p.z + z)) {
    p.x += x;
    p.z += z;
  } else {
    if (allowed(venue, level, safe, p.x + x, p.z)) p.x += x;
    if (allowed(venue, level, safe, p.x, p.z + z)) p.z += z;
  }
}

function prepareOne(p, sim, dt) {
  p.bumpTime = Math.max(0, (p.bumpTime || 0) - dt);
  p.bumpCooldown = Math.max(0, (p.bumpCooldown || 0) - dt);
  if (!onDeck(p, sim.venue)) return;
  if (resting(p)) {
    p.deckRest ??= { x: p.x, z: p.z };
    const dx = p.deckRest.x - p.x,
      dz = p.deckRest.z - p.z;
    const rate = Math.min(1, dt * 2);
    displace(p, dx * rate, dz * rate, sim);
  } else p.deckRest = null;
  if (p.bumpTime > 0 && p.slipTime <= 0) {
    const fade = p.bumpTime / BUMP_DURATION;
    displace(p, (p.bumpX || 0) * dt * fade, (p.bumpZ || 0) * dt * fade, sim);
  }
}
export function prepareDeck(sim, dt) {
  // (the guests, then the coaches: as many as there were when the tick began)
  const people = sim.people,
    coaches = sim.coaches,
    n = people.length,
    m = coaches.length;
  for (let i = 0; i < n; i++) prepareOne(people[i], sim, dt);
  for (let i = 0; i < m; i++) prepareOne(coaches[i], sim, dt);
}

// Brief right-hand sidesteps break head-on symmetry without changing any destination.
export function deckHeading(sim, p, dx, dz) {
  if (!onDeck(p, sim.venue) || !p.bumpTime) return { x: dx, z: dz };
  const obstacles = sim.people.filter((a) => a !== p && onDeck(a, sim.venue));
  for (const c of sim.coaches) if (c.y < 0.5 && c !== p) obstacles.push(c);
  for (const a of obstacles) {
    const x = a.x - p.x,
      z = a.z - p.z,
      ahead = x * dx + z * dz,
      lateral = x * dz - z * dx;
    if (ahead > -0.05 && ahead < 1.15 && Math.abs(lateral) < 0.8) {
      // Both walkers take their own right; already offset walkers keep their passing side.
      const side = Math.abs(lateral) > 0.12 ? -Math.sign(lateral) : 1;
      const x = dx * 0.55 + dz * side * 0.95,
        z = dz * 0.55 - dx * side * 0.95,
        n = Math.hypot(x, z);
      return { x: x / n, z: z / n };
    }
  }
  return { x: dx, z: dz };
}

function bump(p, x, z) {
  if (p.bumpCooldown > 0 || p.slipTime > 0) return;
  p.bumpTime = BUMP_DURATION;
  p.bumpCooldown = 0.65;
  p.bumpX = x * 0.9;
  p.bumpZ = z * 0.9;
}

// (who is on deck this tick, and the coaches on foot: two lists kept and filled again each tick. Nothing here moves anybody on or
// off the deck, or a coach's feet off it, so both are as good for the fifth pass as for the first.)
const DECK = [],
  CREW = [];
const onFoot = (c) => !(c.y >= 0.5 || c.swimming || c.waterTransition || c.wading);
export function resolveDeck(sim) {
  const people = DECK,
    crew = CREW,
    venue = sim.venue;
  people.length = 0;
  crew.length = 0;
  for (const p of sim.people) if (onDeck(p, venue)) people.push(p);
  for (const c of sim.coaches) if (onFoot(c)) crew.push(c);
  // A few positional passes resolve crowded contacts; no stops, falls, or score penalties.
  for (let pass = 0; pass < 5; pass++) {
    for (let i = 0; i < people.length; i++)
      for (let j = i + 1; j < people.length; j++) {
        const a = people[i],
          b = people[j],
          dx = b.x - a.x,
          dz = b.z - a.z,
          d = Math.hypot(dx, dz);
        if (d >= DIAMETER) continue;
        const nx = d > 0.0001 ? dx / d : 0,
          nz = d > 0.0001 ? dz / d : a.id < b.id ? 1 : -1;
        if (resting(a)) a.deckRest ??= { x: a.x, z: a.z };
        if (resting(b)) b.deckRest ??= { x: b.x, z: b.z };
        bump(a, -nx, -nz);
        bump(b, nx, nz);
        const overlap = (DIAMETER - d + 0.001) / 2;
        displace(a, -nx * overlap, -nz * overlap, sim);
        displace(b, nx * overlap, nz * overlap, sim);
      }
    // Coaches on foot shove guests aside (and each other, evenly).
    for (let i = 0; i < crew.length; i++)
      for (let j = i + 1; j < crew.length; j++) {
        const a = crew[i],
          b = crew[j],
          dx = b.x - a.x,
          dz = b.z - a.z,
          d = Math.hypot(dx, dz);
        if (d >= DIAMETER) continue;
        const nx = d > 0.0001 ? dx / d : 1,
          nz = d > 0.0001 ? dz / d : 0,
          overlap = (DIAMETER - d + 0.001) / 2;
        displace(a, -nx * overlap, -nz * overlap, sim);
        displace(b, nx * overlap, nz * overlap, sim);
      }
    for (let c = 0; c < crew.length; c++)
      for (let i = 0; i < people.length; i++) {
        const coach = crew[c],
          p = people[i],
          dx = p.x - coach.x,
          dz = p.z - coach.z,
          d = Math.hypot(dx, dz);
        if (d >= DIAMETER) continue;
        const nx = d > 0.0001 ? dx / d : Math.cos(coach.angle),
          nz = d > 0.0001 ? dz / d : -Math.sin(coach.angle);
        if (resting(p)) p.deckRest ??= { x: p.x, z: p.z };
        bump(p, nx, nz);
        bump(coach, -nx, -nz);
        // Coach keeps responsive controls; swimmers yield most of the small displacement.
        const overlap = DIAMETER - d + 0.001;
        displace(p, nx * overlap * 0.85, nz * overlap * 0.85, sim);
        displace(coach, -nx * overlap * 0.15, -nz * overlap * 0.15, sim);
      }
  }
  // (the lists hold nobody between ticks)
  people.length = 0;
  crew.length = 0;
}

export function bumpLean(p, reducedMotion = false) {
  if (reducedMotion || !p.bumpTime || p.slipTime > 0) return { x: 0, z: 0 };
  const t = 1 - p.bumpTime / BUMP_DURATION;
  const wave = Math.sin(t * Math.PI * 3) * (1 - t) * 0.13;
  const a = p.angle || 0,
    x = p.bumpX || 0,
    z = p.bumpZ || 0;
  return { x: wave * (x * Math.sin(a) + z * Math.cos(a)), z: -wave * (x * Math.cos(a) - z * Math.sin(a)) };
}
