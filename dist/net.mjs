// Online co-op (22 October 2026): up to three players on one shift, each a coach (crew.mjs), over the internet. Pure: no DOM, no
// Steam; it talks through a transport (below: an in-memory one for the checks, a BroadcastChannel one for two windows of one
// browser, and Steam's relayed P2P in the desktop app, steam-net.mjs).
//
// How it stays in step: the shift is seeded and ticks in fixed steps, so it is decided by how it began and the inputs, tick by
// tick (replay.mjs plays a shift again from exactly that). The host plays the shift for real and is its authority: every
// player's input (the host's own, and the guests', which they send it) is applied on the host's machine and stamped with the
// tick it came before; the host sends the stamped inputs to every guest, a few ticks at a time, with a hash of the shift now
// and then. Each guest plays the same shift from the same start and applies the same inputs before the same ticks, a few
// ticks behind the host, so every machine shows the same shift; a guest's own input does nothing on its own machine until the
// host has it (its own coach is drawn a little ahead meanwhile: Predictor). Very little goes over the wire (inputs only),
// which suits Steam's relay; a guest who drops and comes back gets the whole log and plays it through in a second.
//
// The lobby comes first (the character select, coop-ui.mjs): the host takes the guests that join (up to three players, the
// same build only), each picks a coach nobody else has, the host picks the pool and starts once everyone is ready.

import { INPUTS, stateHash } from "./replay.mjs";
import { COACH_IDS, MAX_CREW, coachInfo } from "./crew.mjs";

// Bump when the messages or the way a shift is shared change: a guest on another protocol is turned away at the door.
export const PROTOCOL = 1;
export const NET = {
  flushEvery: 3, // ticks between the host's messages (20 a second)
  hashEvery: 120, // ticks between hashes of the shift (every 2 seconds)
  buffer: 4, // ticks a guest keeps behind the newest it has, to ride out an uneven connection
  catchUp: 240, // ticks a guest may play in one frame when far behind (a rejoin plays the whole log at once)
  lookStep: 0.003, // the smallest turn of the Coach Cam worth sending (radians)
  lookEvery: 3, // ticks between two looks sent
  nameLength: 24,
};
// The inputs a guest may ask the host to play for its coach: the simulation's own (replay.mjs), the look, never anything else.
const ALLOWED = new Set([
  ...INPUTS.filter((n) => n !== "inputAs" && n !== "triggerChaos" && n !== "startCramp"),
  "setLook",
]);
const plain = (a) => ["string", "number", "boolean"].includes(typeof a) || a === null;
const cleanName = (name) =>
  String(name || "Coach")
    .replace(/[\u0000-\u001f<>]/g, "")
    .trim()
    .slice(0, NET.nameLength) || "Coach";

// ---- transports -------------------------------------------------------------------------------------------------------------
// A transport is { id, send(to, msg), onMessage(fn(from, msg)), onLeave(fn(peer)), close() }: messages are plain objects,
// delivered reliably and in order between two peers (Steam's Reliable send type, a BroadcastChannel, the hub below).

// An in-memory hub for the checks: `latency` and `jitter` (in "frames" of the hub's own clock, `hub.pump()`), never out of order.
export function createHub({ latency = 0, jitter = 0, seed = 1 } = {}) {
  const peers = new Map(),
    queue = [];
  let clock = 0;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const lastAt = new Map();
  const hub = {
    connect(id) {
      const handlers = { message: [], leave: [] };
      const t = {
        id,
        send(to, msg) {
          if (!peers.has(to)) return false;
          const pair = id + ">" + to,
            at = Math.max(lastAt.get(pair) || 0, clock + latency + Math.floor(random() * (jitter + 1)));
          lastAt.set(pair, at);
          queue.push({ at, from: id, to, msg: JSON.parse(JSON.stringify(msg)) });
          return true;
        },
        onMessage: (fn) => handlers.message.push(fn),
        onLeave: (fn) => handlers.leave.push(fn),
        close() {
          peers.delete(id);
          for (const [, p] of peers) for (const fn of p.handlers.leave) fn(id);
        },
      };
      peers.set(id, { t, handlers });
      return t;
    },
    // Delivers what is due (all of it when `all`), one hub frame on.
    pump(all = false) {
      clock++;
      queue.sort((a, b) => a.at - b.at);
      while (queue.length && (all || queue[0].at <= clock)) {
        const m = queue.shift(),
          p = peers.get(m.to);
        if (p) for (const fn of p.handlers.message) fn(m.from, m.msg);
      }
    },
    get pending() {
      return queue.length;
    },
  };
  return hub;
}

// Two windows of one browser (the quick test on one machine, ?coop): a BroadcastChannel named by the room, every message
// addressed. `id` is random per window.
export function channelTransport(room = "pool-panic-coop", id = Math.random().toString(36).slice(2, 10)) {
  const channel = new BroadcastChannel(room),
    handlers = { message: [], leave: [] };
  channel.onmessage = (e) => {
    const m = e.data;
    if (!m || (m.to !== id && m.to !== "*")) return;
    if (m.bye) return handlers.leave.forEach((fn) => fn(m.from));
    handlers.message.forEach((fn) => fn(m.from, m.msg));
  };
  const goodbye = () => channel.postMessage({ from: id, to: "*", bye: true });
  globalThis.addEventListener?.("pagehide", goodbye);
  return {
    id,
    send(to, msg) {
      channel.postMessage({ from: id, to, msg });
      return true;
    },
    onMessage: (fn) => handlers.message.push(fn),
    onLeave: (fn) => handlers.leave.push(fn),
    close() {
      goodbye();
      channel.close();
    },
  };
}

// ---- the session: the lobby, then the shift ---------------------------------------------------------------------------------
// What both sides keep of the lobby: the players (index = their coach in the shift), the host's choice of shift.
function lobbyView(s) {
  return {
    players: s.players.map(({ index, name, coach, ready, away, host }) => ({
      index,
      name,
      coach,
      ready,
      away,
      host,
    })),
    choice: s.choice,
    phase: s.phase,
  };
}

class Session {
  constructor(transport, { name, build = "dev", protocol = PROTOCOL } = {}) {
    this.t = transport;
    this.name = cleanName(name);
    this.build = build;
    this.protocol = protocol;
    this.players = [];
    this.choice = null;
    this.phase = "lobby"; // lobby · shift · results
    this.sim = null;
    this.ticks = 0;
    this.handlers = {};
    this.stats = { sent: 0, received: 0, bytes: 0, desyncs: 0 };
    transport.onMessage((from, msg) => {
      this.stats.received++;
      this.receive(from, msg);
    });
    transport.onLeave((peer) => this.left(peer));
  }
  on(type, fn) {
    (this.handlers[type] ??= []).push(fn);
    return this;
  }
  fire(type, data) {
    for (const fn of this.handlers[type] || []) fn(data);
  }
  send(to, msg) {
    this.stats.sent++;
    this.stats.bytes += JSON.stringify(msg).length;
    return this.t.send(to, msg);
  }
  get me() {
    return this.players.find((p) => p.index === this.index) || null;
  }
  get crew() {
    return this.players
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((p) => p.coach);
  }
  // Whose coach a coach index is (for the names over the coaches, the HUD).
  player(index) {
    return this.players.find((p) => p.index === index) || null;
  }
  // The input methods of `sim`, wrapped: what this machine's game calls goes through `local(name, args)` (the host plays it,
  // a guest sends it); what the session applies itself goes straight in. Only the outermost call of an input counts.
  wrap(sim) {
    this.depth = 0;
    this.applying = 0;
    for (const name of [...INPUTS, "setLook"]) {
      const original = sim[name];
      if (typeof original !== "function" || name === "inputAs") continue;
      sim[name] = (...args) => {
        if (this.depth || this.applying) return original.apply(sim, args);
        this.depth++;
        try {
          return this.local(name, args, original);
        } finally {
          this.depth--;
        }
      };
    }
  }
}

export class CoopHost extends Session {
  constructor(transport, options = {}) {
    super(transport, options);
    this.index = 0;
    this.players = [
      { peer: transport.id, index: 0, name: this.name, coach: "waters", ready: true, host: true },
    ];
    this.log = []; // every input of the shift: [tick, coach, name, ...args]
    this.pending = [];
    this.lastLook = new Map();
  }
  // ---- the lobby
  receive(from, msg) {
    const p = this.players.find((q) => q.peer === from);
    if (msg.t === "hello") return this.hello(from, msg);
    if (!p) return;
    if (msg.t === "pick") return this.pick(p, msg.coach);
    if (msg.t === "ready") {
      p.ready = !!msg.on;
      return this.broadcastLobby();
    }
    if (msg.t === "in") return this.remote(p, msg);
    if (msg.t === "bye") return this.left(from);
  }
  hello(from, msg) {
    if (
      msg.protocol !== this.protocol ||
      (msg.build !== this.build && msg.build !== "dev" && this.build !== "dev")
    )
      return this.send(from, { t: "refuse", why: "version", build: this.build });
    // A player coming back (same peer, or the same name while their place is empty) takes their coach again.
    let p =
      this.players.find((q) => q.peer === from) ||
      this.players.find((q) => q.away && q.name === cleanName(msg.name));
    if (!p) {
      if (this.phase !== "lobby") return this.send(from, { t: "refuse", why: "playing" });
      if (this.players.length >= MAX_CREW) return this.send(from, { t: "refuse", why: "full" });
      const index = [1, 2].find((i) => !this.players.some((q) => q.index === i));
      const coach = COACH_IDS.find((c) => !this.players.some((q) => q.coach === c));
      p = { peer: from, index, name: cleanName(msg.name), coach, ready: false };
      this.players.push(p);
    }
    p.peer = from;
    p.away = false;
    this.send(from, { t: "welcome", index: p.index, ...lobbyView(this) });
    if (this.phase !== "lobby" && this.shift)
      this.send(from, { t: "catchup", shift: this.shift, log: this.log, k: this.ticks });
    this.fire("lobby", lobbyView(this));
    this.broadcastLobby();
  }
  // Coaches are one each: a pick of a coach someone else has is ignored (the carousel skips them).
  pick(p, coach) {
    if (this.phase !== "lobby" || !COACH_IDS.includes(coach)) return;
    if (this.players.some((q) => q !== p && q.coach === coach)) return this.broadcastLobby();
    p.coach = coach;
    if (!p.host) p.ready = false;
    this.broadcastLobby();
  }
  // The host's own pick (the carousel on the host's screen) and choice of shift.
  pickMine(coach) {
    this.pick(this.players[0], coach);
  }
  choose(choice) {
    this.choice = choice;
    this.broadcastLobby();
  }
  kick(index) {
    const p = this.player(index);
    if (!p || p.host) return;
    this.send(p.peer, { t: "refuse", why: "kicked" });
    this.players = this.players.filter((q) => q !== p);
    this.broadcastLobby();
  }
  get everyoneReady() {
    return this.players.every((p) => p.ready && !p.away);
  }
  broadcastLobby() {
    const view = lobbyView(this);
    for (const p of this.players) if (!p.host && !p.away) this.send(p.peer, { t: "lobby", ...view });
    this.fire("lobby", view);
  }
  left(peer) {
    const p = this.players.find((q) => q.peer === peer && !q.host);
    if (!p) return;
    if (this.phase === "lobby") this.players = this.players.filter((q) => q !== p);
    else {
      // Mid-shift their coach stands still where they left him, ready for them to come back.
      p.away = true;
      if (this.sim) this.apply(p.index, "clearInput", []);
    }
    this.fire("left", p);
    this.broadcastLobby();
  }
  // ---- the shift
  // `shift`: what every machine needs to build the same simulation ({ level, seed, options }, options.crew from the lobby).
  start(shift) {
    this.shift = { ...shift, options: { ...shift.options, crew: this.crew } };
    this.phase = "shift";
    this.log = [];
    this.pending = [];
    this.ticks = 0;
    for (const p of this.players) if (!p.host) p.ready = false;
    for (const p of this.players)
      if (!p.host && !p.away) this.send(p.peer, { t: "start", shift: this.shift });
    return this.shift;
  }
  // The host's simulation, once built from `this.shift`: its inputs are logged, its ticks counted and shared.
  attach(sim) {
    this.sim = sim;
    sim.actor = 0;
    this.wrap(sim);
    const tick = sim.tick;
    sim.tick = (dt) => {
      // (what the shift calls of its own during a tick, a cramp it starts, is not an input)
      this.depth++;
      let r;
      try {
        r = tick.call(sim, dt);
      } finally {
        this.depth--;
      }
      this.ticks++;
      if (this.ticks % NET.hashEvery === 0) this.hash = [this.ticks, stateHash(sim)];
      if (this.ticks % NET.flushEvery === 0 || sim.status === "ended") this.flush();
      return r;
    };
  }
  local(name, args, original) {
    if (name === "setMovement" && this.sameMove(0, args)) return undefined;
    this.note(0, name, args);
    return original.apply(this.sim, args);
  }
  // Movement is shared only when it changes the coach's (the game sets it every frame): as setMovement would set it.
  sameMove(index, [x, z]) {
    const c = this.sim.coaches[index],
      n = Math.max(1, Math.hypot(x, z));
    return !!c?.input && c.input.x === x / n && c.input.z === z / n;
  }
  note(index, name, args) {
    const entry = [this.ticks, index, name, ...args.filter(plain)];
    this.log.push(entry);
    this.pending.push(entry);
  }
  apply(index, name, args) {
    this.note(index, name, args);
    this.applying++;
    try {
      return this.sim.inputAs(index, name, ...args);
    } finally {
      this.applying--;
    }
  }
  remote(p, msg) {
    if (!this.sim || p.away || !ALLOWED.has(msg.name) || !Array.isArray(msg.args) || !msg.args.every(plain))
      return;
    if (msg.name === "setMovement" && this.sameMove(p.index, msg.args)) return;
    this.apply(p.index, msg.name, msg.args);
  }
  // The Coach Cam's turn (the game sets coach.lookAngle every frame): shared like an input, when it has turned enough.
  look(angle) {
    if (!this.sim) return;
    const a = Number.isFinite(angle) ? Math.round(angle * 10000) / 10000 : null,
      was = this.lastLook.get(0);
    if (was !== undefined && (a === was || (a !== null && was !== null && Math.abs(a - was) < NET.lookStep)))
      return;
    this.lastLook.set(0, a);
    this.apply(0, "setLook", [a]);
  }
  flush() {
    const msg = { t: "fr", k: this.ticks, ins: this.pending, ...(this.hash && { h: this.hash }) };
    this.pending = [];
    this.hash = null;
    for (const p of this.players) if (!p.host && !p.away) this.send(p.peer, msg);
  }
  // The shift is over on the host: back to the lobby for the next one (every guest has the same results on its own screen).
  finish() {
    this.phase = "lobby";
    this.sim = null;
    this.broadcastLobby();
  }
  close() {
    for (const p of this.players) if (!p.host) this.send(p.peer, { t: "bye" });
    this.t.close();
  }
}

export class CoopGuest extends Session {
  constructor(transport, host, options = {}) {
    super(transport, options);
    this.host = host;
    this.index = null;
    this.queue = []; // stamped inputs not yet played
    this.confirmed = 0;
    this.hashes = [];
    this.lookAt = -99;
    this.movedAt = -99;
    this.clock = 0;
    this.hello();
    // (said again each second until the host answers: over Steam the first word can come before the host sees the lobby's
    // new member, and is dropped)
    this.knock = globalThis.setInterval?.(
      () => (this.index == null ? this.hello() : this.stopKnocking()),
      1000,
    );
  }
  hello() {
    this.send(this.host, { t: "hello", name: this.name, build: this.build, protocol: this.protocol });
  }
  stopKnocking() {
    globalThis.clearInterval?.(this.knock);
    this.knock = null;
  }
  receive(from, msg) {
    if (from !== this.host) return;
    if (msg.t === "refuse") return (this.stopKnocking(), this.fire("refused", msg.why));
    if (msg.t === "welcome") {
      this.stopKnocking();
      this.index = msg.index;
      this.players = msg.players;
      this.choice = msg.choice;
      return this.fire("welcome", msg);
    }
    if (msg.t === "lobby") {
      this.players = msg.players;
      this.choice = msg.choice;
      if (msg.phase === "lobby" && this.phase !== "lobby") this.phase = "results";
      return this.fire("lobby", msg);
    }
    if (msg.t === "start") return this.begin(msg.shift, [], 0);
    if (msg.t === "catchup") return this.begin(msg.shift, msg.log, msg.k);
    if (msg.t === "fr") {
      for (const e of msg.ins) this.queue.push(e);
      this.confirmed = Math.max(this.confirmed, msg.k);
      if (msg.h) this.hashes.push(msg.h);
      return;
    }
    if (msg.t === "bye") return this.fire("closed", "host left");
  }
  left(peer) {
    if (peer === this.host) this.fire("closed", "host left");
  }
  begin(shift, log, k) {
    this.shift = shift;
    this.phase = "shift";
    this.queue = log.slice();
    this.confirmed = k;
    this.hashes = [];
    this.ticks = 0;
    this.sim = null;
    this.fire("start", shift); // the game builds the simulation from it and calls attach()
  }
  attach(sim) {
    this.sim = sim;
    // Between ticks the shift is this player's: their coach is the one their screen asks about (sim.mjs tick).
    sim.actor = this.index;
    this.wrap(sim);
  }
  local(name, args) {
    // Nothing happens here until the host has played it: the input goes to the host.
    if (name === "setMovement") {
      // (sent when it changes, and again now and then while it is held: the shift may have stopped him meanwhile)
      const key = args.join(",");
      if (key === this.lastMove && (key === "0,0" || this.ticks - this.movedAt < 20)) return undefined;
      this.lastMove = key;
      this.movedAt = this.ticks;
      this.moving = { x: args[0], z: args[1] };
    }
    if (name === "clearInput") {
      this.lastMove = "0,0";
      this.moving = { x: 0, z: 0 };
    }
    this.send(this.host, { t: "in", name, args: args.filter(plain) });
    return undefined;
  }
  look(angle) {
    if (!this.sim || this.ticks - this.lookAt < NET.lookEvery) return;
    const a = Number.isFinite(angle) ? Math.round(angle * 10000) / 10000 : null;
    if (
      a === this.lastLook ||
      (a !== null && this.lastLook != null && Math.abs(a - this.lastLook) < NET.lookStep)
    )
      return;
    this.lastLook = a;
    this.lookAt = this.ticks;
    this.send(this.host, { t: "in", name: "setLook", args: [a] });
  }
  // How far behind the host this machine is, in ticks it could play now.
  get lag() {
    return this.confirmed - this.ticks;
  }
  // One frame of the game (`dt` seconds): plays the ticks it may, a little faster when behind, a little slower when it has
  // caught up, never past what the host has confirmed. Returns the ticks played.
  advance(dt) {
    if (!this.sim || this.phase !== "shift") return 0;
    const lag = this.lag - NET.buffer,
      rate = lag > 30 ? NET.catchUp : Math.max(0.5, Math.min(3, 1 + lag / 12));
    this.clock = Math.min(NET.catchUp, this.clock + dt * 60 * rate);
    let played = 0;
    while (this.clock >= 1 && this.ticks < this.confirmed) {
      this.step();
      this.clock -= 1;
      played++;
    }
    if (this.ticks >= this.confirmed) this.clock = Math.min(this.clock, 1);
    return played;
  }
  // One tick: the inputs stamped for it (in the host's order), then the tick, then the hash if the host sent one for it.
  step() {
    const sim = this.sim;
    this.applying++;
    try {
      while (this.queue.length && this.queue[0][0] <= this.ticks) {
        const [, index, name, ...args] = this.queue.shift();
        sim.inputAs(index, name, ...args);
      }
      sim.tick(1 / 60);
    } finally {
      this.applying--;
    }
    this.ticks++;
    while (this.hashes.length && this.hashes[0][0] <= this.ticks) {
      const [k, h] = this.hashes.shift();
      if (k === this.ticks && h !== stateHash(sim)) {
        this.stats.desyncs++;
        this.fire("desync", { tick: k });
      }
    }
  }
  ready(on) {
    this.send(this.host, { t: "ready", on: !!on });
  }
  pick(coach) {
    this.send(this.host, { t: "pick", coach });
  }
  close() {
    this.stopKnocking();
    this.send(this.host, { t: "bye" });
    this.t.close();
  }
}

// A guest's own coach, drawn a little ahead of the shift on its screen: the shift only moves him once the host has the input,
// a round trip later, so the screen adds what the stick has asked for since and the shift has not played yet (and lets it go
// as the shift catches up, or when he is held up by something). Render only: the shift itself is never touched.
export class Predictor {
  constructor() {
    this.dx = 0;
    this.dz = 0;
    this.last = null;
  }
  // `wanted`: the movement the player asks for now ({x, z}, length up to 1); `coach`: their coach in the shift; `speed`: his
  // speed in m/s. Returns the offset to draw him at.
  update(dt, wanted, coach, speed) {
    const applied = coach.input || { x: 0, z: 0 },
      moved = this.last ? Math.hypot(coach.x - this.last.x, coach.z - this.last.z) : 0;
    this.last = { x: coach.x, z: coach.z };
    this.dx += (wanted.x - applied.x) * speed * dt;
    this.dz += (wanted.z - applied.z) * speed * dt;
    // (held up: a wall, a swimmer, a busy job; and always a little, so the offset never wanders)
    const stuck = Math.hypot(applied.x, applied.z) > 0.3 && moved < speed * dt * 0.3;
    const keep = stuck || coach.busy || coach.swimming || coach.waterTransition ? 0.8 : 0.995;
    this.dx *= keep;
    this.dz *= keep;
    const n = Math.hypot(this.dx, this.dz);
    if (n > 1.2) {
      this.dx *= 1.2 / n;
      this.dz *= 1.2 / n;
    }
    return { dx: this.dx, dz: this.dz };
  }
}

export const coachName = (session, index) =>
  session?.player(index)?.name || coachInfo(session?.crew?.[index] || "waters").name;
