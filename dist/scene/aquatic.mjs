// The Aquatic Centre (16 October 2026): an indoor competition pool, a little more serious than the others. Splash Park's floor
// plan (five lanes) dressed as a racing pool: deep-blue tiles and black lane lines, red, white and blue racing ropes, dark starting
// blocks, a white deck under cool daylight. Behind the lockers stand an electronic timing board whose lane times run while the
// shift does and a big pace clock; blue grandstands with a crowd line two sides, a victory podium stands where Splash Park's tower
// was, and the snack kiosk is the officials' table. The hall above (glass walls, a white steel roof, flags of the clubs, banners) is
// for the Coach Cam only, like every indoor hall.
import { THREE } from "./kit.mjs";
import { buildPool, buildDeck } from "./pool.mjs";
import { checkerTextures } from "./textures.mjs";
import { poolSurround, commonStations } from "./resort.mjs";
import { Hall } from "./hall.mjs";
import { Crowd } from "./crowd.mjs";
import { placed, rngOf } from "./geom.mjs";
import { bench, lifeguardTower, lockerBay, plant } from "./props.mjs";

const FLOOR = -1.95;
const NAVY = 0x10284a;
const BLUE = 0x1f5fd1;
const RED = 0xe03a3a;
const WHITE = 0xf4f8fb;
const GOLD = 0xe9b949;

const AQUATIC_HALL = {
  minX: -26.5,
  maxX: 27.3,
  minZ: -16.15,
  maxZ: 24.5,
  floor: FLOOR,
  low: FLOOR,
  eave: 13,
  ridge: 21,
  profile: "arch",
  arcSegments: 14,
  trusses: "lattice",
  trussDepth: 1.8,
  stations: [-12, -4, 4, 12, 20],
  wainscot: 2.6,
  colors: {
    wall: 0xdfe9f0,
    trim: 0xffffff,
    accent: BLUE,
    dark: NAVY,
    metal: 0xe9eef2,
    boards: 0xf2f6f9,
    tile: "#2b6fb8",
    lamp: 0xf2f8ff,
    woodBase: "#8a6a4a",
  },
  sky: { top: "#7fb8e6", bottom: "#e8f4fb" },
  glass: [1.25, 1.45],
  boardsEmissive: 0xdde8f2,
  boardsGlow: 0.38,
  seed: 21,
  windowCount: 10,
  windowY: 4.2,
  windowHeight: 7.4,
  windowWidth: 3.4,
  wallShafts: true,
  shaftOpacity: 0.12,
  oculus: 0,
  skylights: true,
  shaftSegments: [],
  skylightSize: [4.6, 2.4],
  bunting: [RED, WHITE, BLUE, GOLD, 0x2fae7a],
  buntingX: [-16, -8, 0, 8, 16],
  buntingLevels: [0.4],
  buntingDrop: 1.6,
  banners: [
    { color: "#10284a", trim: "#e9b949" },
    { color: "#1f5fd1", trim: "#ffffff" },
    { color: "#c22f2f", trim: "#ffffff" },
  ],
  bannerText: { lines: ["AQUATIC", "CENTRE"], sub: "CLUB CHAMPIONSHIPS", ink: "#ffffff" },
  bannerX: 12.5,
  bannerHeight: 6.4,
  crownBeam: 19,
  ridgeHang: 18.8,
  ridgeFlagStep: 2.1,
  lampX: [-17, -8.5, 0, 8.5, 17],
  lampTop: 15,
  lampPool: 5,
  poolLight: 0.1,
  noDucts: true,
  fans: [],
  sconceCount: 0,
  motes: 30,
  crest: {
    text: "AQUATIC CENTRE",
    sub: "POOL PANIC · CLUB CHAMPIONSHIPS",
    bg: "#10284a",
    fg: "#ffffff",
    width: 10,
    height: 4.4,
    y: 13.6,
  },
};

export function buildAquatic(w, venue) {
  buildDeck(w, venue, {
    checker: { a: "#eef3f6", b: "#e1e9ee", grout: "#b8c7d0", tiles: 4 },
    slab: NAVY,
    rim: 0x2f8fd0,
    side: 0xdfe8ee,
  });
  buildPool(w, venue, w.look.water, {
    floorTiles: ["#2a76c6", "#8fc6ef"],
    wallTiles: ["#3a87d2", "#a6d3f4"],
    line: 0x0c2240,
    ropes: [0xffffff, BLUE, RED],
    blockTop: NAVY,
    pennants: [RED, 0xffffff, BLUE],
  });
  poolSurround(w, venue, { base: "#1d5aa6", grout: "#eaf3f9", seed: 23 });
  const hall = new Hall(w, AQUATIC_HALL);
  const ctx = { w, venue, hall, rand: rngOf(53), crowds: [], ribbons: [] };
  hallFloor(ctx);
  timingWall(ctx);
  lockerBay(w, venue, -12, "HOME", BLUE, "arena");
  lockerBay(w, venue, 12, "AWAY", RED, "arena");
  for (const f of venue.furniture) {
    if (f.kind === "bench") bench(w, f.x, f.z, f.angle);
    if (f.kind === "plant") plant(w, f.x, f.z, f.scale || 1);
    if (f.kind === "lifeguard-tower") lifeguardTower(w, f.x, f.z);
    if (f.kind === "kiosk") officialsTable(ctx, f.x, f.z);
    if (f.kind === "podium") podium(ctx, f.x, f.z);
    if (f.kind === "team-bench") teamBench(ctx, f.x, f.z);
  }
  commonStations(w, venue);
  deckMarks(ctx);
  stands(ctx);
  let frame = 0;
  w.updaters.push((time) => {
    const cheer = w.cheer || 0;
    frame++;
    for (const c of ctx.crowds)
      if ((!c.coachOnly || hall.coach) && frame % 2 === 0) c.crowd.update(time, cheer);
    for (const t of ctx.ribbons) t.offset.x = (time * 0.04) % 1;
  });
}

const canvasTexture = (w, width, height, draw) => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  draw(c.getContext("2d"), width, height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  w.textures.push(t);
  return { canvas: c, texture: t };
};

// ---- the hall floor around the tabletop ------------------------------------------------------------------
function hallFloor(ctx) {
  const { w } = ctx,
    S = AQUATIC_HALL,
    t = checkerTextures({ a: "#3a5770", b: "#34506a", grout: "#22384d", tiles: 4 });
  for (const tx of [t.map, t.bump]) {
    tx.repeat.set((S.maxX - S.minX) / 4, (S.maxZ - S.minZ) / 4);
    w.textures.push(tx);
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(S.maxX - S.minX + 4, S.maxZ - S.minZ + 8),
    new THREE.MeshStandardMaterial({
      map: t.map,
      bumpMap: t.bump,
      bumpScale: 0.5,
      roughness: 0.35,
      metalness: 0.1,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((S.minX + S.maxX) / 2, FLOOR, (S.minZ + S.maxZ) / 2 + 2);
  floor.receiveShadow = true;
  w.scene.add(floor);
}

// ---- the wall behind the lockers: the timing board, the pace clock, club flags ---------------------------------
const LANE_NAMES = ["ROSSI", "OKAFOR", "MARCO", "LINDQVIST", "TANAKA"];
function timingWall(ctx) {
  const { w } = ctx,
    z0 = -16.35,
    cx = 0.4;
  // A solid backing wall in white and blue, with a red stripe and a navy plinth, so the board reads in the overview.
  w.box(34.4, 7.2, 0.4, WHITE, cx, 1.7, z0 - 0.02, 0);
  w.box(34.4, 0.7, 0.45, NAVY, cx, -0.3, z0 + 0.02, 0.02);
  w.box(34.2, 0.22, 0.45, RED, cx, 4.95, z0 + 0.04, 0.02);
  w.box(34.2, 0.32, 0.45, BLUE, cx, 5.35, z0 + 0.04, 0.02);
  // The timing board: lane, name, time, place, with the lane times ticking while the shift runs.
  const W = 1024,
    H = 448,
    { canvas, texture } = canvasTexture(w, W, H, () => {}),
    c2 = canvas.getContext("2d");
  let last = "";
  const draw = (time, score) => {
    const g = c2.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#071427");
    g.addColorStop(1, "#0d2140");
    c2.fillStyle = g;
    c2.fillRect(0, 0, W, H);
    c2.fillStyle = "#1f5fd1";
    c2.fillRect(0, 0, W, 74);
    c2.fillStyle = "#ffffff";
    c2.font = "900 50px Arial";
    c2.textBaseline = "middle";
    c2.textAlign = "left";
    c2.fillText("AQUATIC CENTRE", 24, 38);
    c2.textAlign = "right";
    c2.fillStyle = "#ffd76a";
    c2.font = "800 44px monospace";
    c2.fillText(String(Math.round(score)).padStart(5, "0") + " PTS", W - 24, 38);
    // Each lane swims its own pace; the leader is the lowest time on the last length.
    const times = LANE_NAMES.map((_, i) => 24 + ((time * (0.92 + i * 0.03) + i * 7.3) % 36));
    const order = [...times.keys()].sort((a, b) => times[a] - times[b]);
    LANE_NAMES.forEach((name, i) => {
      const y = 112 + i * 68;
      c2.fillStyle = i % 2 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)";
      c2.fillRect(14, y - 30, W - 28, 60);
      c2.textAlign = "left";
      c2.fillStyle = "#ffd76a";
      c2.font = "900 44px monospace";
      c2.fillText(String(i + 1), 34, y);
      c2.fillStyle = name === "MARCO" ? "#ff8a6a" : "#ffffff";
      c2.font = "800 42px Arial";
      c2.fillText(name, 110, y);
      c2.textAlign = "right";
      c2.fillStyle = "#79e0a0";
      c2.font = "800 42px monospace";
      c2.fillText(times[i].toFixed(2), W - 150, y);
      c2.fillStyle = "#ffffff";
      c2.fillText(String(order.indexOf(i) + 1), W - 40, y);
    });
    texture.needsUpdate = true;
  };
  draw(0, 0);
  const face = new THREE.MeshBasicMaterial({ map: texture });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 4.2), face);
  board.position.set(cx, 2.55, z0 + 0.25);
  w.scene.add(board);
  (w.liveProps ||= []).push(board);
  w.box(10.1, 4.65, 0.24, NAVY, cx, 2.55, z0 + 0.1, 0.06);
  w.dimmers.push((k) => face.color.setScalar(Math.min(1, Math.max(0.25, k))));
  w.updaters.push((time, dt, world, sim) => {
    const t = sim?.time ?? time,
      key = Math.floor(t * 4) + ":" + Math.round(sim?.score || 0);
    if (key === last) return;
    last = key;
    draw(t, sim?.score || 0);
  });
  // The pace clock: a big face with a red sweep hand, one turn a minute.
  for (const x of [cx - 8.4, cx + 8.4]) {
    const g = w.group(x, 2.55, z0 + 0.3);
    const rim = w.cyl(1.32, 1.32, 0.16, NAVY, 0, 0, 0, g, 40);
    rim.rotation.x = Math.PI / 2;
    const dial = w.cyl(1.2, 1.2, 0.18, 0xffffff, 0, 0, 0.02, g, 40);
    dial.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2,
        tick = w.box(
          0.07,
          i % 3 ? 0.18 : 0.3,
          0.02,
          i % 3 ? NAVY : RED,
          Math.sin(a) * 1.0,
          Math.cos(a) * 1.0,
          0.13,
          0,
          g,
        );
      tick.rotation.z = -a;
    }
    const hand = new THREE.Group();
    hand.position.z = 0.16;
    g.add(hand);
    w.liveProps.push(hand);
    w.box(0.08, 1.05, 0.03, RED, 0, 0.45, 0, 0, hand);
    w.ball(0.1, NAVY, 0, 0, 0.03, g);
    w.updaters.push(
      (time, dt, world, sim) => (hand.rotation.z = -(((sim?.time ?? time) % 60) / 60) * Math.PI * 2),
    );
  }
  // Club flags along the top of the wall: stripes and crosses in the hall's colours, stirring a little.
  const designs = [
    [RED, WHITE, BLUE],
    [BLUE, GOLD, BLUE],
    [0x2fae7a, WHITE, RED],
    [NAVY, WHITE, NAVY],
    [GOLD, RED, GOLD],
    [WHITE, BLUE, WHITE],
  ];
  for (let i = 0; i < 12; i++) {
    const x = cx - 15.4 + i * 2.8,
      d = designs[i % designs.length];
    if (Math.abs(x - cx) < 5.6) continue; // the board's place
    const f = w.group(x, 6.3, z0 + 0.32);
    for (let k = 0; k < 3; k++) w.box(1.5, 0.3, 0.03, d[k], 0, -k * 0.3, 0, 0, f);
    w.rod([x - 0.8, 6.45, z0 + 0.32], [x + 0.8, 6.45, z0 + 0.32], 0.025, 0x9aa7bd);
    w.flags.push(f);
  }
  w.textPlane("CLUB CHAMPIONSHIPS", 5.6, 0.5, "#10284a", "#ffffff", cx, 5.35, z0 + 0.3, w.scene, 60);
}

// ---- furniture in competition dress ----------------------------------------------------------------------------
// The victory podium: first in the middle, second and third either side, numbered, with medals on the top step.
function podium(ctx, x, z) {
  const { w } = ctx,
    g = w.group(x, 0, z, w.scene, -Math.PI / 2);
  const steps = [
    [-0.9, 0.55, "2", 0xc9d3dc],
    [0, 0.85, "1", GOLD],
    [0.9, 0.38, "3", 0xd59a62],
  ];
  for (const [dx, h, n, color] of steps) {
    w.box(0.88, h, 1.1, WHITE, dx, h / 2, 0, 0.04, g);
    w.box(0.9, 0.08, 1.12, color, dx, h + 0.04, 0, 0.02, g);
    w.textPlane(n, 0.42, 0.42, "#f4f8fb", "#10284a", dx, h * 0.55, 0.56, g, 120);
  }
  w.box(2.8, 0.06, 1.3, BLUE, 0, 0.03, 0, 0.02, g);
  // A medal hanging off the top step on its ribbon.
  w.ball(0.11, GOLD, 0.25, 0.75, 0.57, g, [1, 1, 0.3]);
  w.rod([0.25, 0.86, 0.57], [0.25, 0.94, 0.5], 0.02, RED, g);
}
// The officials' table (Splash Park's kiosk spot): a white desk with timing screens, a starter's horn and the dog treats.
function officialsTable(ctx, x, z) {
  const { w } = ctx,
    g = w.group(x, 0, z, w.scene, -Math.PI / 2);
  w.box(2.4, 0.95, 1.4, WHITE, 0, 0.48, 0, 0.06, g);
  w.box(2.6, 0.1, 1.55, NAVY, 0, 1.0, 0, 0.03, g);
  w.box(2.4, 0.22, 0.04, BLUE, 0, 0.72, 0.71, 0.01, g);
  for (const dx of [-0.75, 0.15]) {
    w.box(0.6, 0.4, 0.04, 0x0d1d33, dx, 1.3, -0.2, 0.01, g);
    w.box(0.54, 0.34, 0.02, 0x2fb6e8, dx, 1.3, -0.17, 0, g);
    w.box(0.08, 0.2, 0.08, 0x0d1d33, dx, 1.1, -0.22, 0, g);
  }
  w.cyl(0.07, 0.11, 0.3, RED, 0.8, 1.2, 0.1, g, 10);
  w.textPlane("OFFICIALS", 1.6, 0.3, "#ffffff", "#10284a", 0, 0.5, 0.73, g, 46);
}
// A team bench with a backrest, kit bags and towels.
function teamBench(ctx, x, z) {
  const { w } = ctx,
    g = w.group(x, 0, z);
  w.box(3, 0.1, 0.6, BLUE, 0, 0.5, 0, 0.03, g);
  w.box(3, 0.55, 0.08, BLUE, 0, 0.82, -0.28, 0.03, g);
  for (const dx of [-1.3, 1.3]) w.box(0.1, 0.5, 0.5, 0x9aa7bd, dx, 0.25, 0, 0.02, g);
  w.box(0.55, 0.32, 0.35, RED, -0.8, 0.71, 0.05, 0.08, g);
  w.box(0.6, 0.05, 0.5, 0xffffff, 0.4, 0.58, 0.02, 0.02, g);
  w.box(0.6, 0.05, 0.5, 0xffd76a, 1.0, 0.58, 0.02, 0.02, g);
}
// Painted on the deck: the meet's name at the open end, and lane numbers past the turning end.
function deckMarks(ctx) {
  const { w, venue } = ctx;
  w.textPlane("AQUATIC CENTRE", 5.6, 0.62, "#e1e9ee", "#1d5aa6", 0, 0.025, 12.2, w.scene, 70).rotation.x =
    -Math.PI / 2;
  venue.lanes.forEach((x, i) => {
    const t = w.textPlane(String(i + 1), 0.9, 0.9, "#e1e9ee", "#10284a", x, 0.022, 9.9, w.scene, 110);
    t.rotation.x = -Math.PI / 2;
    t.rotation.z = Math.PI / 2;
  });
}

// ---- grandstands -----------------------------------------------------------------------------------------------
const STAND = { tiers: 7, depth: 1.15, rise: 0.55 };
function stands(ctx) {
  const { w, hall } = ctx,
    sections = [BLUE, WHITE, BLUE, RED];
  const list = [
    {
      axis: "x",
      dir: 1,
      front: 17.7,
      from: -13.6,
      to: 22.4,
      ry: -Math.PI / 2,
      parent: w.scene,
      coachOnly: false,
    },
    { axis: "z", dir: 1, front: 14.6, from: -14.4, to: 16.4, ry: Math.PI, parent: w.scene, coachOnly: false },
    {
      axis: "x",
      dir: -1,
      front: -16.9,
      from: -13.6,
      to: 22.4,
      ry: Math.PI / 2,
      parent: hall.ctx.g,
      coachOnly: true,
    },
  ];
  const ribbon = ribbonTexture(w);
  list.forEach((s, si) => {
    const length = s.to - s.from,
      mid = (s.from + s.to) / 2,
      seats = [];
    for (let k = 0; k < STAND.tiers; k++) {
      const h = STAND.rise * (k + 1),
        along = s.front + s.dir * (k + 0.5) * STAND.depth;
      if (s.axis === "x")
        w.box(STAND.depth, h, length, k % 2 ? 0x1a3557 : 0x21426b, along, FLOOR + h / 2, mid, 0, s.parent);
      else w.box(length, h, STAND.depth, k % 2 ? 0x1a3557 : 0x21426b, mid, FLOOR + h / 2, along, 0, s.parent);
      for (let a = s.from; a < s.to - 0.01; a += 9) {
        const seg = Math.min(9, s.to - a),
          color = sections[(Math.floor((a - s.from) / 9) + k) % sections.length],
          seatAlong = along - s.dir * 0.28;
        if (s.axis === "x")
          w.box(0.55, 0.1, seg - 0.2, color, seatAlong, FLOOR + h + 0.05, a + seg / 2, 0.02, s.parent);
        else w.box(seg - 0.2, 0.1, 0.55, color, a + seg / 2, FLOOR + h + 0.05, seatAlong, 0.02, s.parent);
      }
      for (let a = s.from + 0.5, i = 0; a < s.to - 0.3; a += 0.95, i++) {
        if (i % 9 === 8 || ctx.rand() < 0.22) continue;
        const pos = along + s.dir * 0.1;
        seats.push(
          s.axis === "x"
            ? { x: pos, y: FLOOR + h - 0.36, z: a, ry: s.ry }
            : { x: a, y: FLOOR + h - 0.36, z: pos, ry: s.ry },
        );
      }
    }
    const board =
      s.axis === "x"
        ? placed(new THREE.PlaneGeometry(length, 0.85), {
            at: [s.front - s.dir * 0.02, FLOOR + 0.55, mid],
            rot: [0, s.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0],
          })
        : placed(new THREE.PlaneGeometry(length, 0.85), {
            at: [mid, FLOOR + 0.55, s.front - s.dir * 0.02],
            rot: [0, s.dir > 0 ? Math.PI : 0, 0],
          });
    const mat = new THREE.MeshBasicMaterial({ map: ribbon.clone() });
    mat.map.needsUpdate = true;
    mat.map.repeat.set(length / 8, 1);
    w.textures.push(mat.map);
    ctx.ribbons.push(mat.map);
    s.parent.add(new THREE.Mesh(board, mat));
    w.dimmers.push((k) => mat.color.setScalar(Math.min(1, k)));
    const crowd = new Crowd(w, s.coachOnly ? hall.live : w.scene, seats, {
      seed: 11 + si,
      waveAxis: s.axis === "x" ? "z" : "x",
      scale: 0.95,
      colors: [BLUE, WHITE, RED, NAVY, GOLD, 0x2fb6e8, 0x2fae7a],
    });
    if (!s.coachOnly) w.liveProps.push(crowd.bodies, crowd.heads, crowd.arms);
    ctx.crowds.push({ crowd, coachOnly: s.coachOnly });
  });
}

function ribbonTexture(w) {
  const { texture } = canvasTexture(w, 1024, 64, (c, W, H) => {
    c.fillStyle = "#0b1a30";
    c.fillRect(0, 0, W, H);
    c.font = "900 42px Arial";
    c.textBaseline = "middle";
    c.fillStyle = "#ffffff";
    c.fillText("AQUATIC CENTRE  ●  CLUB CHAMPIONSHIPS  ●  GO MARCO!  ●", 10, H / 2);
    c.fillStyle = "#e03a3a";
    c.fillRect(0, 0, W, 5);
    c.fillStyle = "#1f5fd1";
    c.fillRect(0, H - 5, W, 5);
  });
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}
