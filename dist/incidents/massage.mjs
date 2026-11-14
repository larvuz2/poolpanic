// 💆 The massage (23 October 2026, the creator: "a swimmer comes out and goes straight to massage table and lays down!! if no
// coach arrives, starts emptying the bar and gets frustrated if goes to cero and we subtract points!!! so coach needs to go and
// press and hold E for the massage session (same duration as Karen) same progress bar!! 2 coaches, speed things up! … add this
// massage table in some venues !! not all!!").
// Only a venue with a massage table has it (`venue.fixtures.massage`: the Sunset Lagoon, the Aquatic Centre, Senior Aqua Fit and
// the Grand Gala Arena). When it starts, the next swimmer to climb out of the pool does not go home: they walk straight to the
// table, climb on and lie face down, and their patience starts to run out (a bar on their tag). The warning is that walk and
// the tag; the prevention window is the patience; the comic failure is the guest getting up in a huff and storming off, with
// points taken; the recovery is physical: a coach goes to the table and HOLDS E beside it until the wheel fills (8 s alone, 5
// with two, 3 with three: the same wheel, the same times and the same many hands as Karen's, teamwork.mjs), working the
// guest's back with both hands. Each coach on the job steps to a place of their own at the table (`SPOTS`), the first in front
// (facing the camera). Let go, or step away, and the wheel drains; the patience only runs while nobody is on it.
// The simulation only reports facts: the table, the lying pose, the Massage clip, the sounds are the presentation's.
import { teamTime, joinTeam, teamTag } from "../teamwork.mjs";
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const MASSAGE_TUNING = {
  times: [8, 5, 3], // seconds of holding E: one coach alone, two together, three (Karen's, as the creator asked)
  release: 1.6, // seconds for a full wheel to drain once nobody is on it
  patience: 24, // seconds lying on the table before giving up
  edgy: 0.35, // the share of patience left when the guest starts to fidget (drumming feet, head up)
  reach: 0.95, // metres from the table's edge a coach can work from
  walk: 3.2, // m/s to the table
  climb: 0.9, // seconds getting onto the table, face down
  rise: 1.0, // seconds getting off it
  glide: 2.6, // m/s a coach steps to their place at the table
  reward: 120,
  vipBonus: 80,
  penalty: 100,
  vipPenalty: 200,
  wait: 40, // seconds the table waits for someone to climb out before the incident is dropped
};
const T = MASSAGE_TUNING;
// The table: 2 m long, 0.6 m wide, its top at 0.58 m (the scene draws it, massage-view.mjs). Where its middle is, which way the
// head end points (`angle`) and which long side is the front one (`side`: the side a coach works from facing the camera) come from
// the venue (`fixtures.massage`). Its obstacle is narrower than the top (only its legs), so a coach can stand close enough to
// reach across: spatial.mjs.
export const TABLE = { half: 1.0, width: 0.3, top: 0.58, stand: 0.43, obstacle: 0.1 };
// Where the coaches stand to work, in order of preference: the front side by the back, the far side by the back, the front side
// by the legs, the far side by the legs (a fourth, so three coaches on one side need not all walk round). `along`: metres from the middle toward the head end, `side`: +1 the front, -1 the back. The two on the front stand
// 0.95 m apart (5 November 2026, the creator: two coaches leaning in side by side crossed over), wider than two coaches' shoulders
// with their arms on the guest's back.
export const SPOTS = [
  { side: 1, along: 0.5 },
  { side: -1, along: 0.2 },
  { side: 1, along: -0.45 },
  { side: -1, along: -0.75 },
];
// How a coach gets to their place: never through the table, nor through a coach already working at it (the creator, the same
// day: one walked straight through the table and stuck in it). Round the nearer end of the table when the place is on the other
// side, and along a lane behind the coaches working on the same side when one is in the way.
export const APPROACH = { lane: 0.75, end: 0.5, near: 0.06 };

// The table's axes: `a` along it toward the head end, `n` across it toward its front side.
export function tableFrame(fixture) {
  const a = { x: Math.sin(fixture.angle || 0), z: Math.cos(fixture.angle || 0) },
    s = fixture.side || 1,
    n = { x: a.z * s, z: -a.x * s };
  return { a, n };
}
// A point on or beside the table: `along` the length, `across` toward the front.
export function tablePoint(fixture, along, across) {
  const { a, n } = tableFrame(fixture);
  return { x: fixture.x + a.x * along + n.x * across, z: fixture.z + a.z * along + n.z * across };
}
// Where a guest walks to before climbing on: beside the table on the side away from the front (the pool's side), by the middle.
export const tableApproach = (fixture) => tablePoint(fixture, 0, -(TABLE.width + 0.6));
// The way to the table from anywhere on the deck: round the pool to the walk along its side nearest the table, along it to the
// table's level, then across (a straight line from the far corner would cut through the trampoline tower or the podium).
export function tableRoute(venue, from, fixture = venue.fixtures.massage) {
  const on = tableApproach(fixture);
  // (The Jumping Pool's deck routes round everything itself: dive-plan.mjs.)
  if (venue.dive) return venue.route(from, on);
  const walk = { x: Math.sign(on.x || 1) * venue.pool.corridorX, z: on.z };
  return [...venue.route(from, walk), on];
}
// How far a point is from the table's top (0 on it).
function fromTable(fixture, p) {
  const { a, n } = tableFrame(fixture),
    dx = p.x - fixture.x,
    dz = p.z - fixture.z,
    along = Math.abs(dx * a.x + dz * a.z) - TABLE.half,
    across = Math.abs(dx * n.x + dz * n.z) - TABLE.width;
  return Math.hypot(Math.max(0, along), Math.max(0, across));
}

// Every massage table a venue has: most have one (`fixtures.massage`); the Jumping Pool's corner has a second (`massageMore`).
export const tablesOf = (venue) =>
  [venue.fixtures?.massage, ...(venue.fixtures?.massageMore || [])].filter(Boolean);
// The table a session is at (`m.table`, its index in tablesOf), and the first table free of any session.
const table = (sim, m) => tablesOf(sim.venue)[m?.table ?? 0] || null;
function freeTable(sim) {
  const tables = tablesOf(sim.venue);
  for (let k = 0; k < tables.length; k++) if (!sim.massages.some((m) => m.table === k)) return k;
  return -1;
}
// The session a guest is in (on the way to a table, or on it), or null.
export const sessionOf = (sim, p) => (sim.massages || []).find((m) => m.id === p.id) || null;
function newSession(sim, k, director) {
  return {
    uid: (sim.massageUid = (sim.massageUid || 0) + 1),
    table: k,
    director, // (the director's incident, drawn like any other; else a rescued diver's, dive.mjs)
    id: null,
    stage: "waiting", // for someone to climb out of the pool
    waited: 0,
    t: 0,
    progress: 0,
    patience: T.patience,
    helpers: [], // the coaches working on the guest, in the order they joined (teamwork.mjs)
    spots: {}, // coach index -> SPOTS index
    angry: false,
    elapsed: 0,
  };
}
function endSession(sim, m) {
  sim.massages = sim.massages.filter((x) => x !== m);
}
// Who may ask for a massage: a grown-up who has had their swim (no child, nobody in a wheelchair, no racer, no chiller).
const eligible = (p) => p.type !== "child" && !p.wheelchair && !p.racer && !p.chill && p.served !== false;

export const Massage = {
  key: "massage",
  init(sim) {
    // The sessions under way, one a table (`sim.massage` is the first of them: most venues only ever have one).
    sim.massages = [];
    Object.defineProperty(sim, "massage", {
      get() {
        return this.massages[0] || null;
      },
      configurable: true,
    });
  },
  // An incident while the director's session is on (a rescued diver's own massage is no incident, dive.mjs).
  isActive: (sim) => sim.massages.some((m) => m.director),
  // Only where there is a free table, and only while someone is swimming who could come out wanting one.
  canStart: (sim) =>
    freeTable(sim) >= 0 &&
    sim.people.some(
      (p) => (p.status === "swim" || (p.status === "dive" && p.dive !== "line")) && eligible(p),
    ),
  describe(sim) {
    return sim.massages
      .map((m) => {
        const p = m.id != null ? sim.get(m.id) : null;
        return (
          (sim.massages.length > 1 ? "table " + (m.table + 1) + " " : "") +
          "stage " +
          m.stage +
          (p ? " · " + p.name : "") +
          (m.helpers.length
            ? " · being massaged" + (m.helpers.length > 1 ? ` by ${m.helpers.length} coaches` : "")
            : "")
        );
      })
      .join(" | ");
  },
  detail(sim) {
    const m = sim.massage,
      p = m?.id != null ? sim.get(m.id) : null;
    return (
      m && {
        at: p && { x: p.x, z: p.z },
        done: m.progress,
        patience: m.patience,
        tables: sim.massages.length,
      }
    );
  },
  start(sim) {
    const k = freeTable(sim);
    if (k < 0) return false;
    sim.massages.push(newSession(sim, k, true));
    return true;
  },
  // A guest straight to a free table (the Jumping Pool's rescued divers, dive.mjs: "exit or massage area"). True when they went.
  request(sim, p) {
    const k = freeTable(sim);
    if (k < 0 || !eligible({ ...p, served: true })) return false;
    const m = newSession(sim, k, false);
    sim.massages.push(m);
    begin(sim, m, p);
    return true;
  },
  // The next swimmer out of the pool (sim.tickWaterExit, as they reach the deck) takes the table. True when they did.
  claim(sim, p) {
    const m = sim.massages.find((x) => x.stage === "waiting");
    if (!m || !table(sim, m) || !eligible(p)) return false;
    begin(sim, m, p);
    return true;
  },
  focus(sim) {
    const m = sim.massage;
    return m?.helpers?.length ? m.helpers[0] : { near: table(sim, m) || undefined };
  },
  update(sim, dt) {
    for (const m of [...sim.massages]) updateSession(sim, m, dt);
  },
  interactions(sim, options) {
    const c = sim.coach;
    if (c.massaging) return;
    for (const m of sim.massages) {
      const f = table(sim, m);
      if (m.stage !== "lying" || !f || !inReach(sim, f, c)) continue;
      const p = sim.get(m.id);
      if (!p) continue;
      options.push({
        kind: "massage",
        label: m.helpers.length
          ? `💆 Hold E · help massage ${p.name} (faster together)`
          : `💆 Hold E · massage ${p.name}`,
        x: p.x,
        z: p.z,
        rank: -325 + fromTable(f, c),
        run: () => beginMassage(sim, m),
      });
    }
  },
  alert(sim, alerts) {
    for (const m of sim.massages) {
      const p = m.id != null && sim.get(m.id);
      if (!p || !["walk", "climb", "lying"].includes(m.stage)) continue;
      const edgy = m.stage === "lying" && m.patience < T.patience * T.edgy;
      alerts.push({
        kind: "massage",
        icon: edgy ? "😤" : "💆",
        label: p.name,
        x: p.x,
        z: p.z,
        y: 1.6,
        urgency: m.helpers.length ? 40 : edgy ? 84 : 66,
        id: p.id,
      });
    }
  },
  hint(sim) {
    const m = urgent(sim),
      p = m && sim.get(m.id);
    if (!p) return "";
    if (m.helpers.length) return "💆 Keep holding E · massaging " + p.name;
    return inReach(sim, table(sim, m), sim.coach)
      ? "💆 Hold E at the table to massage " + p.name
      : "💆 " + p.name + " wants a massage · run to the table, then hold E";
  },
  panel(sim) {
    const m = urgent(sim),
      p = m && sim.get(m.id);
    if (!p) return null;
    const near = inReach(sim, table(sim, m), sim.coach),
      edgy = m.stage === "lying" && m.patience < T.patience * T.edgy,
      both = sim.massages.filter((x) => ["walk", "climb", "lying"].includes(x.stage)).length > 1;
    return {
      icon: edgy ? "😤" : "💆",
      title: edgy ? `${p.name.toUpperCase()} IS LOSING PATIENCE!` : both ? "TWO MASSAGES!" : "MASSAGE TIME!",
      task: Massage.hint(sim),
      steps: [
        { label: "🏃 TO THE TABLE", active: !near, done: near },
        { label: "✋ HOLD E", active: near, done: false },
      ],
    };
  },
  // The guest's own tag (app.mjs): the wheel, the faces on it, and the patience left.
  personTag(sim, p) {
    const m = sessionOf(sim, p);
    if (!m || !["climb", "lying"].includes(m.stage)) return null;
    return {
      ring: m.progress,
      team: teamTag(sim, m.helpers),
      patience: m.patience / T.patience,
      left: m.patience,
      edgy: m.patience < T.patience * T.edgy,
    };
  },
};

// The session that needs the coach most: one on its way or lying with nobody on it, the least patient first.
function urgent(sim) {
  const live = sim.massages.filter((m) => m.id != null && ["walk", "climb", "lying"].includes(m.stage));
  return (
    live.sort(
      (a, b) =>
        (a.helpers.length ? 1 : 0) - (b.helpers.length ? 1 : 0) ||
        (a.stage === "lying" ? 0 : 1) - (b.stage === "lying" ? 0 : 1) ||
        a.patience - b.patience,
    )[0] || null
  );
}
// A guest takes a session's table: off they go to it.
function begin(sim, m, p) {
  m.id = p.id;
  m.stage = "walk";
  p.status = "massage";
  p.massage = "walk";
  p.path = tableRoute(sim.venue, p, table(sim, m));
  sim.emit("chaos", { kind: "massage" });
  sim.incident("massage", p, { id: p.id, name: p.name });
  sim.emit("toast", {
    text: m.director
      ? `💆 ${p.name} wants a massage! Get to the massage table and hold E.`
      : `💆 ${p.name} needs a massage after that! Get to the massage corner and hold E.`,
    warning: true,
  });
}
function updateSession(sim, m, dt) {
  m.elapsed += dt;
  if (m.stage === "waiting") {
    m.waited += dt;
    if (m.waited > T.wait) endSession(sim, m); // (nobody came out: the table stays free)
    return;
  }
  const p = sim.get(m.id),
    f = table(sim, m);
  if (!p || p.status !== "massage" || !f) return release(sim, m);
  const on = tablePoint(f, 0, 0),
    head = Math.atan2(tableFrame(f).a.x, tableFrame(f).a.z);
  switch (m.stage) {
    case "walk":
      if (sim.moveAlong(p, dt, sim.pace(p, T.walk))) {
        m.stage = p.massage = "climb";
        m.t = 0;
        m.from = { x: p.x, z: p.z };
      }
      return;
    case "climb": {
      m.t = Math.min(1, m.t + dt / T.climb);
      p.x = m.from.x + (on.x - m.from.x) * m.t;
      p.z = m.from.z + (on.z - m.from.z) * m.t;
      p.angle = head;
      p.climb = m.t; // (how far onto the table: the scene's pose)
      if (m.t >= 1) {
        m.stage = p.massage = "lying";
        sim.emit("massage-lie", { x: p.x, z: p.z, id: p.id });
      }
      return;
    }
    case "lying":
      p.x = on.x;
      p.z = on.z;
      p.angle = head;
      work(sim, m, p, f, dt);
      return;
    case "rise": {
      m.t = Math.min(1, m.t + dt / T.rise);
      p.climb = 1 - m.t;
      const side = tableApproach(f);
      p.x = on.x + (side.x - on.x) * m.t;
      p.z = on.z + (side.z - on.z) * m.t;
      if (m.t >= 1) {
        // Off home: round the pool to the door they came in by (the same way out as everyone's).
        p.status = "exit";
        p.exitPhase = "deck";
        p.massage = null;
        p.climb = 0;
        p.path = [...sim.venue.route(p, sim.venue.arrival.at(p.side, "outside")), ...sim.returnRoute(p.side)];
        endSession(sim, m);
      }
      return;
    }
  }
}

function inReach(sim, f, c = sim.coach) {
  return !!f && !c.swimming && !c.waterTransition && fromTable(f, c) <= T.reach;
}
// Where coach `i` stands at the table: their own place, the free one nearest them when they join.
function spotFor(sim, m, f, i) {
  if (m.spots[i] === undefined) {
    const c = sim.coaches[i],
      taken = new Set(Object.values(m.spots));
    let best = 0,
      bestD = Infinity;
    SPOTS.forEach((s, k) => {
      if (taken.has(k)) return;
      const d = walkTo(f, c, s) + k * 0.3; // (the front a little preferred)
      if (d < bestD) [best, bestD] = [k, d];
    });
    m.spots[i] = best;
  }
  const s = SPOTS[m.spots[i]];
  return { ...tablePoint(f, s.along, s.side * TABLE.stand), side: s.side };
}

// How far a coach walks to a place (`SPOTS` entry): straight on their own side, round the nearer end of the table to the other.
function walkTo(f, c, s) {
  const me = inFrame(f, c),
    mine = Math.sign(me.across) || s.side;
  if (mine === s.side) return Math.hypot(me.along - s.along, me.across - s.side * TABLE.stand);
  const lane = TABLE.stand + APPROACH.lane,
    corner = Math.sign(me.along || 1) * (TABLE.half + APPROACH.end);
  return (
    Math.abs(lane - Math.abs(me.across)) +
    Math.abs(corner - me.along) +
    2 * lane +
    Math.abs(corner - s.along) +
    APPROACH.lane
  );
}
// A point in the table's own frame: `along` toward the head end, `across` toward the front.
function inFrame(f, p) {
  const { a, n } = tableFrame(f),
    dx = p.x - f.x,
    dz = p.z - f.z;
  return { along: dx * a.x + dz * a.z, across: dx * n.x + dz * n.z };
}
// The next point on coach `i`'s way to their place (`spot`). A few ways there are tried, shortest first: straight; out to the lane
// behind their side and along it; round either end of the table; round both (when a coach already working is in the way on a
// side too narrow to pass behind them). A way counts if it stays on the deck, keeps a body clear of the table and passes no
// coach already at their place. Worked out afresh every tick from where everyone is, so it needs no memory (and replays the
// same); with no way at all, straight there, and the deck's own pushing sorts it out.
export function stepTowards(sim, m, f, i, spot) {
  const c = sim.coaches[i],
    me = inFrame(f, c),
    to = inFrame(f, spot),
    side = Math.sign(to.across) || 1,
    mine = Math.abs(me.across) < 0.05 ? side : Math.sign(me.across),
    lanes = lanesOf(sim, f),
    end = TABLE.half + APPROACH.end,
    lane = (s) => s * lanes[s > 0 ? 1 : 0],
    settled = m.helpers
      .filter((j) => {
        const s = SPOTS[m.spots[j]];
        return j !== i && s && distance(sim.coaches[j], tablePoint(f, s.along, s.side * TABLE.stand)) < 0.08;
      })
      .map((j) => inFrame(f, sim.coaches[j]));
  // (and those who pressed E before this one, still on their way: the later one walks round them)
  for (const j of m.helpers)
    if (m.helpers.indexOf(j) < m.helpers.indexOf(i)) settled.push(inFrame(f, sim.coaches[j]));
  const ways = [[to], [{ along: me.along, across: lane(side) }, { along: to.along, across: lane(side) }, to]];
  for (const e of [1, -1]) {
    const out = { along: me.along, across: lane(mine) },
      c1 = { along: e * end, across: lane(mine) },
      c2 = { along: e * end, across: lane(-mine) },
      c3 = { along: -e * end, across: lane(-mine) },
      c4 = { along: -e * end, across: lane(mine) };
    if (mine !== side) ways.push([c1, c2, to], [out, c1, c2, to]);
    else ways.push([out, c1, c2, c3, c4, to], [c1, c2, c3, c4, to]);
  }
  // the shortest open way; failing that, one that only needs a nudge past a coach or off the deck's edge (the deck's pushing
  // sorts those out); never one through the table: with none at all, the coach waits where they are
  // (every way also without its first stops: a coach just past a corner carries on rather than stepping back to it)
  for (const w of [...ways]) for (let k = 1; k < w.length; k++) ways.push(w.slice(k));
  let best = null;
  for (const strict of [2, 1, 0]) {
    let bestLen = Infinity;
    for (const w of ways) {
      let from = me,
        len = 0,
        ok = true;
      for (const q of w) {
        if (!wayClear(sim, f, from, q, strict >= 2 ? settled : [], strict >= 1, me)) {
          ok = false;
          break;
        }
        len += Math.hypot(q.along - from.along, q.across - from.across);
        from = q;
      }
      if (ok && len < bestLen) [best, bestLen] = [w, len];
    }
    if (best) break;
  }
  if (!best) return { x: c.x, z: c.z };
  const first = best.find((q) => Math.hypot(q.along - me.along, q.across - me.across) > APPROACH.near) || to;
  return first === to ? spot : tablePoint(f, first.along, first.across);
}
// How far out a coach can walk past the workers on each side of a table ([back, front]): the lane, or less where the deck ends
// (the Sunset Lagoon's front, against the boardwalk's rail). Worked out once per table.
const LANES = new WeakMap();
function lanesOf(sim, f) {
  let l = LANES.get(f);
  if (l) return l;
  const end = TABLE.half + APPROACH.end,
    deck = (along, across) => sim.venue.isDeck(...Object.values(tablePoint(f, along, across)), sim.level);
  l = [-1, 1].map((s) => {
    for (const d of [APPROACH.lane, 0.6, 0.45, 0.3]) {
      const off = TABLE.stand + d;
      let ok = true;
      for (let a = -end; a <= end + 1e-6 && ok; a += 0.25) ok = deck(a, s * off) && deck(a, s * (off + 0.15));
      if (ok) return off;
    }
    return TABLE.stand + 0.3;
  });
  LANES.set(f, l);
  return l;
}
// Whether a straight walk from `p` to `q` (in the table's frame) is open: on the deck, a body clear of the table (its top padded
// by half a coach at the ends and a little at the sides, the places themselves just outside) and of every coach already at their
// place (`settled`). `leaving`: the walk starts where the coach is now, which may itself be a little off (where they pressed E).
const BODY = { ends: 0.25, sides: 0.1, apart: 0.7 };
function wayClear(sim, f, p, q, settled, onDeck, me) {
  const len = Math.hypot(q.along - p.along, q.across - p.across),
    steps = Math.max(1, Math.ceil(len / 0.1)),
    // (a coach already closer than that to a worker, or a little off the deck, may still walk away from them)
    room = settled.map((o) =>
      Math.min(BODY.apart, Math.hypot(o.along - me.along, o.across - me.across) - 0.02),
    ),
    // (only a coach already somewhere awkward, off the deck or against the table, is let off the first steps of the walk out)
    stuck =
      (Math.abs(me.along) < TABLE.half + BODY.ends && Math.abs(me.across) < TABLE.width + BODY.sides) ||
      !sim.venue.isDeck(...Object.values(tablePoint(f, me.along, me.across)), sim.level),
    near = (along, across) => stuck && Math.hypot(along - me.along, across - me.across) < 0.3;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps,
      along = p.along + (q.along - p.along) * t,
      across = p.across + (q.across - p.across) * t;
    if (
      Math.abs(along) < TABLE.half + BODY.ends &&
      Math.abs(across) < TABLE.width + BODY.sides &&
      !near(along, across)
    )
      return false;
    if (settled.some((o, k) => Math.hypot(o.along - along, o.across - across) < room[k])) return false;
    if (
      onDeck &&
      !near(along, across) &&
      !sim.venue.isDeck(...Object.values(tablePoint(f, along, across)), sim.level)
    )
      return false;
  }
  return true;
}

// A coach presses E at the table (run as that coach: the actor). With the key down: they massage while it is held. Clicked or
// tapped: until they move or step away.
function beginMassage(sim, m) {
  const c = sim.coach;
  c.massaging = true;
  c.massageLatched = !c.holding;
  const before = m.helpers.length;
  if (joinTeam(m.helpers, sim.actor ?? 0) && before > 0) {
    const p = sim.get(m.id);
    sim.emit("team-up", { x: p?.x ?? c.x, z: p?.z ?? c.z, kind: "massage", helpers: m.helpers.length });
  }
  return true;
}

// Every coach on the job keeps working while they hold E (or stay put after a click) and stay in reach: each steps to their place
// and faces the guest, and the wheel fills at the speed of the hands on it. Nobody on it: the wheel drains and the patience runs.
function work(sim, m, p, f, dt) {
  const playing = sim.status === "playing";
  m.helpers = m.helpers.filter((i) => {
    const c = sim.coaches[i];
    if (!c) return false;
    const moving = !!(c.input?.x || c.input?.z),
      holding = c.holding || (c.massageLatched && !moving),
      // (on their way to their place, round the table, a coach may be a little further off than an arm's reach)
      onWay =
        m.spots[i] !== undefined &&
        !c.swimming &&
        !c.waterTransition &&
        fromTable(f, c) <= T.reach + APPROACH.lane,
      on = c.massaging && holding && (inReach(sim, f, c) || onWay) && playing;
    if (!on) {
      c.massaging = c.massageLatched = false;
      delete m.spots[i];
    }
    return on;
  });
  if (m.helpers.length) {
    for (const i of m.helpers) {
      const c = sim.coaches[i],
        spot = spotFor(sim, m, f, i),
        goal = stepTowards(sim, m, f, i, spot),
        d = distance(c, goal),
        step = Math.min(d, T.glide * dt);
      if (d > 1e-4) {
        c.x += ((goal.x - c.x) / d) * step;
        c.z += ((goal.z - c.z) / d) * step;
      }
      c.vx = c.vz = 0;
      const { n } = tableFrame(f);
      c.angle = Math.atan2(-n.x * spot.side, -n.z * spot.side); // facing across the table
    }
    m.progress = clamp(m.progress + dt / teamTime(T.times, m.helpers.length), 0, 1);
    if (m.progress >= 1) return relaxed(sim, m, p);
  } else {
    m.progress = Math.max(0, m.progress - dt / T.release);
    if (playing) m.patience = Math.max(0, m.patience - dt);
    if (m.patience <= 0) return gaveUp(sim, m, p);
  }
  p.massageEdgy = m.patience < T.patience * T.edgy && !m.helpers.length;
}

function release(sim, m) {
  for (const i of m.helpers) {
    const c = sim.coaches[i];
    if (c) c.massaging = c.massageLatched = false;
  }
  m.helpers = [];
  m.spots = {};
  endSession(sim, m);
}
function finish(sim, m, p) {
  for (const i of m.helpers) {
    const c = sim.coaches[i];
    if (c) c.massaging = c.massageLatched = false;
  }
  m.team = m.helpers.length;
  m.helpers = [];
  m.spots = {};
  m.stage = p.massage = "rise";
  m.t = 0;
  p.massageEdgy = false;
}

function relaxed(sim, m, p) {
  const value = T.reward + (p.vip ? T.vipBonus : 0);
  finish(sim, m, p);
  p.h = 100;
  p.blissful = true;
  sim.score += value;
  sim.stats.massages = (sim.stats.massages || 0) + 1;
  sim.stats.prevented++;
  sim.emit("points", { x: p.x, z: p.z, value });
  sim.save("massage", p, value, { name: p.name });
  if (p.vip) sim.find("royal", "", p); // (a crossover for the scrapbook: a VIP on the table)
  sim.emit("massage-done", { x: p.x, z: p.z, id: p.id });
  sim.emit("toast", {
    text: `😌 ${p.name} floats off the table. +${value}${m.team > 1 ? " · teamwork!" : ""}`,
  });
}

function gaveUp(sim, m, p) {
  const value = p.vip ? T.vipPenalty : T.penalty;
  finish(sim, m, p);
  m.angry = true;
  p.massageAngry = true;
  p.h = Math.max(0, p.h - 60);
  sim.score -= value;
  sim.stats.massagesMissed = (sim.stats.massagesMissed || 0) + 1;
  sim.breakStreak("massage", p);
  sim.emit("points", { x: p.x, z: p.z, value: -value });
  sim.emit("massage-angry", { x: p.x, z: p.z, id: p.id });
  sim.emit("toast", {
    text: `😤 ${p.name} waited too long for a massage and storms off. −${value}`,
    warning: true,
  });
}
