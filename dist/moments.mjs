// Incident moments. The simulation reports `incident` (a problem starts or gets worse) and `save` (a problem
// prevented or solved) events; this module decides how they land: a sting that names the problem and the action
// (with slow motion, and a one-line lesson the first time a player meets it), a hit-stop and stamp for every
// save, and where the loud alert's arrow sits when its target is off screen. Pure logic with no DOM or Three.js,
// so every rule here is checkable headlessly; app.mjs renders it.

// {name} and {lane} are filled from the event. `how` is shown once per player: the first time they meet it.
export const STINGS = {
  cramp: {
    icon: "🆘",
    title: "CRAMP!",
    verb: "Grab a life ring and dive in",
    how: "{name} can't swim on. Pick up a glowing ring and walk to the edge: you dive in and hand it over.",
    tone: "danger",
  },
  stomach: {
    icon: "💩",
    title: "TUMMY TROUBLE!",
    verb: "Select {name} · Send to locker",
    how: "A 💩 tag means an accident is coming. Send them to the locker room before it happens.",
    tone: "warning",
  },
  spill: {
    icon: "💩",
    title: "EVERYBODY OUT!",
    verb: "Skim it · bin it · hang it · chlorine",
    how: "The pool stays closed until it's clean again. The shift clock waits while you tidy up.",
    tone: "danger",
  },
  fish: {
    icon: "🐟",
    title: "FISH KID!",
    verb: "Stop {name} before the edge · E",
    how: "{name} wants to set a fish free in the pool. Walk up to them before they reach the edge and press E.",
    tone: "warning",
  },
  "fish-loose": {
    icon: "🐟",
    title: "FISH IN THE POOL!",
    verb: "Grab the net and dive in",
    how: "Everyone waits on deck until it's caught. Take the net from its hooks, walk to the edge, swim after it.",
    tone: "danger",
  },
  dog: {
    icon: "🐶",
    title: "LOOSE DOG!",
    verb: "Grab the treats · lead {name} out",
    how: "Dogs steal gear and shake puddles everywhere. Carry the treats close and {name} follows you to a door.",
    tone: "warning",
  },
  karen: {
    icon: "😡",
    title: "KAREN IS HERE!",
    verb: "Run to her · hold E to calm her down",
    how: "Karen marches at you complaining, and everyone she passes gets annoyed and loses points. Reach her and HOLD E until the ring fills; let go and it drains.",
    tone: "warning",
  },
  carl: {
    icon: "💣",
    fallback: { name: "Carl" }, // (the incident names the man who does it: Carl or the leopard man)
    title: "CANNONBALL {name}!",
    verb: "Red-card {name} before the edge · E",
    how: "Every cannonball soaks the lanes, scatters goggles and sends the crowd into a panic. Catch {name} on the deck and press E.",
    tone: "warning",
  },
  flicker: {
    icon: "⚡",
    title: "LIGHTS FLICKERING!",
    verb: "Reset the breaker at the fuse box · E",
    how: "You have a few seconds. Reach the fuse box and press E before the power dies.",
    tone: "warning",
  },
  blackout: {
    icon: "🔦",
    title: "BLACKOUT!",
    verb: "Flashlight first, then the fuse box",
    how: "In the dark, swimmers bump into each other and lose goggles. Light your way to the breakers.",
    tone: "danger",
  },
  tower: {
    icon: "🤸",
    title: "CLEAR LANE {lane}!",
    verb: "{name} is waiting to flip",
    how: "Select each swimmer in the splash lane and send them to another lane before the jump.",
    tone: "warning",
  },
  "tower-go": {
    icon: "🤸",
    title: "{name} IS JUMPING!",
    verb: "Lane {lane} is still busy!",
    how: "Daredevils only wait so long. Anyone left in the splash lane is about to be landed on.",
    tone: "danger",
  },
  rush: {
    icon: "🚌",
    title: "RUSH HOUR!",
    verb: "A crowd is arriving · keep the lanes moving",
    how: "Halfway through a shift the room changes. A whole crowd walks in at once: assign quickly and mix speeds carefully.",
    tone: "warning",
  },
  closure: {
    icon: "🚧",
    title: "LANE {lane} CLOSED!",
    verb: "Wet floor · use the other lanes",
    how: "That lane is out for the rest of the shift. Swimmers already in it can finish, but nobody new can go in.",
    tone: "warning",
  },
  team: {
    icon: "🏅",
    title: "SWIM TEAM!",
    verb: "Fast swimmers ahead · give them room",
    how: "From now on most arrivals are fast Pros. Keep them out of slow lanes and away from the aqua class.",
    tone: "warning",
  },
  class: {
    icon: "💦",
    title: "AQUA CLASS!",
    verb: "Slow, in-place swimmers · protect the fast lanes",
    how: "From now on most arrivals do aqua aerobics: they stay put and slow everyone behind them.",
    tone: "warning",
  },
  storm: {
    icon: "⛈️",
    title: "STORM FRONT!",
    verb: "Rain makes puddles · jump them (Space)",
    how: "The deck is getting wet. Walk around puddles or jump over them: anyone who steps in one slips, and swimmers who slip lose happiness.",
    tone: "warning",
  },
  crash: {
    icon: "💥",
    title: "CRASH!",
    verb: "A life ring for every swimmer hurt",
    how: "Each swimmer hurt in the water needs their own ring. Then patch them up with the medical kit.",
    tone: "danger",
  },
};

// Tier 2 saves get the full hit-stop, burst and cheer; tier 1 a lighter version.
export const SAVES = {
  rescue: { stamp: "RESCUED!", tier: 2 },
  "sent-home": { stamp: "GOOD CATCH!", tier: 1 },
  cleanup: { stamp: "ALL CLEAN!", tier: 2 },
  "fish-stopped": { stamp: "SAVE!", tier: 2 },
  "fish-caught": { stamp: "GOT IT!", tier: 2 },
  "fish-returned": { stamp: "HAPPY KID!", tier: 1 },
  "dog-out": { stamp: "GOOD DOG!", tier: 2 },
  "red-card": { stamp: "RED CARD!", tier: 2 },
  karen: { stamp: "CALMED DOWN!", tier: 2 },
  breaker: { stamp: "SAVE!", tier: 2 },
  lights: { stamp: "LIGHTS ON!", tier: 1 },
  landing: { stamp: "STUCK IT!", tier: 1 },
  healed: { stamp: "PATCHED UP!", tier: 1 },
};

export const MOMENT_TIMING = {
  sting: 1.25, // seconds a repeat sting stays up
  firstSting: 3, // the first sighting, with its one-line lesson
  slow: { scale: 0.4, hold: 0.45 }, // repeat: brief slow motion
  firstSlow: { scale: 0.18, hold: 1.25 }, // first sighting: nearly still while the player reads
  rampIn: 0.1,
  rampOut: 0.35,
  freeze: { 1: 0.07, 2: 0.15 }, // hit-stop per save tier
  queue: 2, // stings waiting behind the current one (older ones are dropped)
};
const T = MOMENT_TIMING;

const fill = (text, e) =>
  text.replace(/\{(\w+)\}/g, (_, key) => (e[key] ?? (key === "name" ? "them" : "")).toString());

export class MomentDirector {
  // `seen`: incident kinds this player already met; `remember(list)` persists the updated list.
  constructor({ seen = [], remember = () => {} } = {}) {
    this.seen = new Set(seen);
    this.remember = remember;
    this.reset();
  }
  // A new shift: nothing on screen, nothing queued (the seen list is kept).
  reset() {
    this.active = null;
    this.queue = [];
    this.slow = null;
    this.freezeUntil = -Infinity;
  }
  // An incident started. Returns the sting to show now, or null when it waits behind the current one.
  incident(e, now) {
    const style = STINGS[e.kind];
    if (!style) return null;
    const first = !this.seen.has(e.kind);
    if (first) {
      this.seen.add(e.kind);
      this.remember([...this.seen]);
    }
    const named = { ...style.fallback, ...e };
    const sting = {
      kind: e.kind,
      first,
      icon: style.icon,
      tone: style.tone,
      title: fill(style.title, named).toUpperCase(),
      verb: fill(style.verb, named),
      how: first ? fill(style.how, named) : "",
      x: e.x,
      z: e.z,
      duration: first ? T.firstSting : T.sting,
    };
    if (this.active && now < this.active.until) {
      this.queue.push(sting);
      if (this.queue.length > T.queue) this.queue.shift();
      return null;
    }
    return this.begin(sting, now);
  }
  begin(sting, now) {
    sting.start = now;
    sting.until = now + sting.duration;
    this.active = sting;
    const slow = sting.first ? T.firstSlow : T.slow;
    this.slow = { start: now, ...slow };
    return sting;
  }
  // Per frame: expires the current sting and returns the next queued one when its turn comes.
  next(now) {
    if (this.active && now >= this.active.until) this.active = null;
    if (!this.active && this.queue.length) return this.begin(this.queue.shift(), now);
    return null;
  }
  // A save: the payoff to show, and a hit-stop.
  save(e, now) {
    const style = SAVES[e.kind];
    if (!style) return null;
    this.freezeUntil = Math.max(this.freezeUntil, now + T.freeze[style.tier]);
    return {
      kind: e.kind,
      stamp: style.stamp,
      tier: style.tier,
      value: e.value || 0,
      name: e.name || "",
      x: e.x,
      z: e.z,
    };
  }
  // How fast the simulation runs right now: 1 normally, slowed for a sting, stopped for a hit-stop.
  timeScale(now) {
    if (now < this.freezeUntil) return 0;
    const s = this.slow;
    if (!s) return 1;
    const t = now - s.start;
    if (t < 0) return 1;
    if (t < T.rampIn) return 1 + (s.scale - 1) * (t / T.rampIn);
    if (t < T.rampIn + s.hold) return s.scale;
    const out = (t - T.rampIn - s.hold) / T.rampOut;
    if (out < 1) return s.scale + (1 - s.scale) * out;
    this.slow = null;
    return 1;
  }
}

// Where the loud alert's arrow sits when its target is off screen: the point where the line from the centre of
// the safe area toward the target leaves that area, and the angle it points. `p` is the target in screen pixels.
// Returns null when the target is inside the safe area (the marker is drawn on it instead). A target behind the
// camera (only possible in the Coach Cam) has no meaningful screen position; `p.lean` says how far it sits to the
// right (1) or left (-1) of straight behind (0), so the arrow points the way to turn, sliding down to the bottom
// edge ("behind you") as the target gets closer to straight behind.
export function edgeArrow(p, rect) {
  const cx = (rect.left + rect.right) / 2,
    cy = (rect.top + rect.bottom) / 2;
  if (!p.behind && p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom)
    return null;
  let dx = p.x - cx,
    dy = p.y - cy;
  if (p.behind) {
    const lean = Math.max(-1, Math.min(1, p.lean || 0));
    dx = (lean < 0 ? -1 : 1) * Math.max(Math.abs(lean), 0.3);
    dy = 1.6 * (1 - Math.abs(lean)) + 0.15;
  }
  const sx = dx > 0 ? (rect.right - cx) / dx : dx < 0 ? (rect.left - cx) / dx : Infinity,
    sy = dy > 0 ? (rect.bottom - cy) / dy : dy < 0 ? (rect.top - cy) / dy : Infinity,
    s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s, angle: Math.atan2(dy, dx) };
}
