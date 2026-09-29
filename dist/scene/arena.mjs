// The Grand Gala Arena, the season finale: Splash Park's floor plan raised on a platform in the middle of a domed arena
// under a barrel roof of steel lattice 28 m high. Grandstands full of cheering spectators, a hanging scoreboard, sweeping
// spotlights, a giant trophy on a stage with a chasing marquee, banners and flags all the way up. The hall's upper
// structure (walls, roof, rigs, beams) is for the Coach Cam only, like the club's; the platform, the stage, the stands on
// two sides and the moving pools of light stay in the overview.
import { THREE } from "./kit.mjs";
import { buildPool, buildDeck } from "./pool.mjs";
import { glowTexture, beamTexture, checkerTextures } from "./textures.mjs";
import { poolSurround, commonStations } from "./resort.mjs";
import { Hall } from "./hall.mjs";
import { Crowd, CROWD_COLORS } from "./crowd.mjs";
import { flagGeo, mergeGeos, placed, rngOf, wind } from "./geom.mjs";
import { bench, lifeguardTower, lockerBay, lounger, stripedCone, plant } from "./props.mjs";
import { signTexture } from "./hall-art.mjs";

const TAU = Math.PI * 2;
const FLOOR = -1.95;
const CX = 0.4;
const GOLD = 0xd4a53c;
const NAVY = 0x35507f;

const ARENA_HALL = {
  minX: -26.5,
  maxX: 27.3,
  minZ: -16.15,
  maxZ: 24.5,
  floor: FLOOR,
  low: FLOOR,
  eave: 15,
  ridge: 28,
  profile: "arch",
  arcSegments: 16,
  trusses: "lattice",
  trussDepth: 2.2,
  stations: [-12, -4, 4, 12, 20],
  wainscot: 3.4,
  colors: {
    wall: NAVY,
    trim: 0xe9d29a,
    accent: GOLD,
    dark: 0x101827,
    metal: 0x9aa7bd,
    boards: 0x3a4f86,
    tile: "#2d5678",
    lamp: 0xffe6b0,
    woodBase: "#6a4426",
  },
  sky: { top: "#141c46", bottom: "#3a4a86" },
  glass: [0.95, 1.1],
  night: true,
  boardsEmissive: 0x7f98d8,
  boardsGlow: 0.32,
  seed: 8,
  windowCount: 9,
  windowY: 9.4,
  windowHeight: 4.2,
  windowWidth: 3.2,
  wallShafts: false,
  oculus: 3.6,
  oculusY: 21,
  skylights: true,
  shaftSegments: [],
  skylightSize: [4.2, 2.6],
  bunting: [GOLD, 0xe0513f, 0x2f9aa0, 0xfff1d6, 0x529fd5],
  buntingX: [-16, -8, 0, 8, 16],
  buntingLevels: [0.3, 0.62],
  buntingDrop: 2.8,
  banners: [
    { color: "#1b2a4a", trim: "#f2d58a" },
    { color: "#9c2a3a", trim: "#f2d58a" },
    { color: "#1f6f8b", trim: "#f2d58a" },
  ],
  bannerText: { lines: ["GRAND", "GALA"], sub: "SEASON FINALE", ink: "#fff6e4" },
  bannerX: 12.5,
  bannerHeight: 7.6,
  crownBeam: 24.9,
  ridgeHang: 24.75,
  ridgeFlagStep: 2.3,
  lampX: [-17, -8.5, 0, 8.5, 17],
  lampTop: 19,
  lampPool: 5.5,
  poolLight: 0.12,
  noDucts: true,
  fans: [],
  sconceCount: 0,
  motes: 60,
  crest: {
    text: "GRAND GALA",
    sub: "POOL PANIC · SEASON FINALE",
    bg: "#1b2a4a",
    fg: "#f2d58a",
    width: 10,
    height: 5,
    y: 15.8,
  },
};

export function buildArena(w, venue) {
  const dynamic = { ...w.look.water, glow: Math.max(w.look.water.glow || 0, 0.001) };
  buildDeck(w, venue, {
    checker: { a: "#f4ead2", b: "#e2d0a0", grout: "#c9a24a", tiles: 4 },
    slab: NAVY,
    rim: 0x37bdd0, // the slab under the deck shows through the water as the pool's bottom
    side: GOLD,
  });
  buildPool(w, venue, dynamic);
  poolSurround(w, venue, { base: "#c99a3a", grout: "#f6e8cc", seed: 71 });
  const hall = new Hall(w, ARENA_HALL),
    upper = hall.ctx.g;
  const ctx = { w, venue, hall, upper, rand: rngOf(97), crowds: [], ribbons: [] };
  arenaFloor(ctx);
  stage(ctx);
  lockerBay(w, venue, -12, "TEAM A", 0x2f9aa0, "arena");
  lockerBay(w, venue, 12, "TEAM B", 0xe0513f, "arena");
  for (const f of venue.furniture) {
    if (f.kind === "bench") bench(w, f.x, f.z, f.angle);
    if (f.kind === "palm") topiary(ctx, f.x, f.z);
    if (f.kind === "lounger") lounger(w, f.x, f.z, f.angle || 0, 0x9c2a3a);
    if (f.kind === "umbrella") stanchion(ctx, f.x, f.z);
    if (f.kind === "lifeguard-tower") lifeguardTower(w, f.x, f.z);
    if (f.kind === "kiosk") champagneBar(ctx, f.x, f.z);
  }
  commonStations(w, venue, { tower: { blue: 0x9c2a3a, white: 0xf2d58a, steps: 0xe9d29a } });
  stands(ctx);
  scoreboard(ctx);
  spotlights(ctx);
  balloons(ctx);
  cannons(ctx);
  // Crowd, ribbons and lights update every frame; the crowd on the far side of the pool updates every other frame.
  let frame = 0;
  w.updaters.push((time, dt) => {
    const cheer = w.cheer || 0;
    frame++;
    for (const c of ctx.crowds)
      if (!c.coachOnly || hall.coach) if (frame % 2 === 0) c.crowd.update(time, cheer);
    for (const t of ctx.ribbons) t.offset.x = (time * 0.05) % 1;
  });
}

// ---- floor and stage --------------------------------------------------------------------------------------
function arenaFloor(ctx) {
  const { w } = ctx,
    S = ARENA_HALL,
    t = checkerTextures({ a: "#3a4a6c", b: "#2f3d5c", grout: "#1e2a44", tiles: 4 });
  for (const tx of [t.map, t.bump]) {
    tx.repeat.set((S.maxX - S.minX) / 4, (S.maxZ - S.minZ) / 4);
    w.textures.push(tx);
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(S.maxX - S.minX + 4, S.maxZ - S.minZ + 8),
    new THREE.MeshStandardMaterial({
      map: t.map,
      bumpMap: t.bump,
      bumpScale: 0.6,
      roughness: 0.4,
      metalness: 0.15,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((S.minX + S.maxX) / 2, FLOOR, (S.minZ + S.maxZ) / 2 + 2);
  floor.receiveShadow = true;
  w.scene.add(floor);
}

function crackTexture(draw, width, height) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  draw(c.getContext("2d"), width, height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The wall behind the huts: a wide LED screen in a gold frame with a chasing marquee, side screens, red drapes and
// the giant trophy on its plinth.
function stage(ctx) {
  const { w, hall } = ctx,
    z0 = -16.35,
    upper = ctx.upper;
  void upper;
  // A solid backing wall so the stage reads in the overview too (the hall's own rear wall is coach-only), with gold rails.
  w.box(34.4, 7.7, 0.4, NAVY, CX, 1.9, z0 - 0.02, 0, w.scene);
  w.box(34, 0.5, 0.5, GOLD, CX, 0.4, z0 + 0.15, 0.04);
  w.box(34, 0.3, 0.4, 0xe9d29a, CX, 5.6, z0 + 0.15, 0.04);
  const screenTex = crackTexture(
    (c, W, H) => {
      const g = c.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, "#132244");
      g.addColorStop(0.5, "#24407a");
      g.addColorStop(1, "#132244");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      c.strokeStyle = "rgba(242,213,138,0.25)";
      c.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        c.beginPath();
        for (let x = 0; x <= W; x += 8) {
          const y = H * 0.55 + Math.sin(x * 0.012 + i * 0.6) * 26 + i * 9;
          x ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.stroke();
      }
      c.fillStyle = "#f2d58a";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = "900 190px Arial";
      c.fillText("GRAND GALA", W / 2, H * 0.4, W * 0.9);
      c.fillStyle = "#fff6e4";
      c.font = "800 60px Arial";
      c.fillText("POOL PANIC  ·  SEASON FINALE", W / 2, H * 0.72, W * 0.9);
    },
    1024,
    400,
  );
  w.textures.push(screenTex);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 3.28), screenMat);
  screen.position.set(CX, 3.55, z0 + 0.34);
  w.scene.add(screen);
  w.box(8.9, 3.75, 0.2, GOLD, CX, 3.55, z0 + 0.2, 0.06);
  // Side screens.
  const sideMat = new THREE.MeshBasicMaterial({
    map: crackTexture(
      (c, W, H) => {
        const g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#9c2a3a");
        g.addColorStop(1, "#4a1424");
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
        c.fillStyle = "#f2d58a";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = "900 120px Arial";
        c.fillText("★", W / 2, H * 0.3);
        c.font = "900 84px Arial";
        c.fillText("FINAL", W / 2, H * 0.58);
        c.fillText("SHIFT", W / 2, H * 0.78);
      },
      320,
      512,
    ),
  });
  w.textures.push(sideMat.map);
  for (const x of [CX - 8.6, CX + 8.6]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), sideMat);
    p.position.set(x, 3.55, z0 + 0.34);
    w.scene.add(p);
    w.box(2.8, 4.0, 0.2, GOLD, x, 3.55, z0 + 0.2, 0.06);
  }
  w.dimmers.push((k) => {
    screenMat.color.setScalar(Math.min(1, k));
    sideMat.color.setScalar(Math.min(1, k));
  });
  // Marquee: warm bulbs all round the main screen, chasing.
  const bulbs = [],
    W2 = 9.2,
    H2 = 4.05,
    n = 46,
    perimeter = (W2 + H2) * 2;
  for (let i = 0; i < n; i++) {
    let d = (i / n) * perimeter,
      x,
      y;
    if (d < W2) [x, y] = [-W2 / 2 + d, H2 / 2];
    else if ((d -= W2) < H2) [x, y] = [W2 / 2, H2 / 2 - d];
    else if ((d -= H2) < W2) [x, y] = [W2 / 2 - d, -H2 / 2];
    else [x, y] = [-W2 / 2, -H2 / 2 + (d - W2)];
    bulbs.push([CX + x, 3.55 + y]);
  }
  const marquee = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.11, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    n,
  );
  bulbs.forEach(([x, y], i) => {
    const m = new THREE.Matrix4().setPosition(x, y, z0 + 0.36);
    marquee.setMatrixAt(i, m);
  });
  marquee.setColorAt(0, new THREE.Color());
  marquee.frustumCulled = false;
  w.scene.add(marquee);
  const on = new THREE.Color(0xffe2a0),
    off = new THREE.Color(0x4a3a20),
    color = new THREE.Color();
  w.updaters.push((time) => {
    const k = Math.min(1, w.incidentLight ?? 1);
    for (let i = 0; i < n; i++) {
      const phase = ((i / n) * 6 - time * 2.2) % 1;
      color
        .copy(off)
        .lerp(on, Math.max(0, Math.sin(phase * Math.PI * 2) * 0.5 + 0.5) ** 2)
        .multiplyScalar(0.4 + 0.6 * k);
      marquee.setColorAt(i, color);
    }
    marquee.instanceColor.needsUpdate = true;
  });
  w.dimmers.push((k) => (w.incidentLight = Math.min(1, k)));
  // Drapes: red velvet with baked folds, swaying a little.
  const drape = (x) => {
    const g = flagGeo(3.4, 5.4, { edge: "top", cols: 14, rows: 10, phase: x });
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 4.4) * 0.16);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(
      placed(g, { at: [x, 5.5, z0 + 0.3] }),
      wind(
        new THREE.MeshStandardMaterial({ color: 0x8f1f32, roughness: 0.75, side: THREE.DoubleSide }),
        w.wind,
        {
          amp: 0.05,
          speed: 1.2,
        },
      ),
    );
    mesh.frustumCulled = false;
    ctx.hall.live.add(mesh);
    w.box(3.6, 0.16, 0.2, GOLD, x, 5.55, z0 + 0.3, 0.02);
  };
  drape(CX - 12.6);
  drape(CX + 12.6);
  // The trophy: a lathe-turned gold cup with handles and a star, turning slowly on a marble plinth.
  const trophy = new THREE.Group();
  trophy.position.set(CX, 1.2, -18.2);
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.85, roughness: 0.28 });
  const profile = [
    [0.95, 0],
    [0.95, 0.3],
    [0.55, 0.45],
    [0.3, 0.7],
    [0.26, 1.5],
    [0.6, 1.85],
    [1.05, 2.6],
    [1.25, 3.6],
    [1.14, 3.66],
    [1.02, 2.85],
    [0.42, 2.0],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), gold);
  cup.castShadow = true;
  trophy.add(cup);
  for (const side of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.1, 8, 20, Math.PI * 1.15), gold);
    handle.position.set(side * 1.15, 2.6, 0);
    handle.rotation.z = side > 0 ? -Math.PI * 0.42 : Math.PI * 1.42;
    trophy.add(handle);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), gold);
  star.position.y = 4.15;
  star.scale.y = 1.3;
  trophy.add(star);
  trophy.scale.setScalar(1.15);
  w.scene.add(trophy);
  w.box(3.4, 1.2, 3.4, 0xf3ead6, CX, 0.05, -18.2, 0.1);
  w.box(3.7, 0.24, 3.7, GOLD, CX, 0.66, -18.2, 0.05);
  w.updaters.push((time) => (trophy.rotation.y = time * 0.5));
  void hall;
}

// ---- furniture in gala dress --------------------------------------------------------------------------------
function topiary(ctx, x, z) {
  const { w } = ctx,
    g = w.group(x, 0, z);
  w.cyl(0.55, 0.42, 0.75, GOLD, 0, 0.38, 0, g, 12);
  w.cyl(0.08, 0.08, 1.1, 0x6f4a26, 0, 1.2, 0, g, 6);
  w.ball(0.6, 0x4f9a5b, 0, 2.05, 0, g);
  w.ball(0.42, 0x68b267, 0, 2.85, 0, g);
  w.ball(0.09, 0xf4c849, 0, 3.35, 0, g);
}
// A brass stanchion post with a velvet cap.
function stanchion(ctx, x, z) {
  const { w } = ctx,
    g = w.group(x, 0, z);
  w.cyl(0.32, 0.36, 0.1, GOLD, 0, 0.05, 0, g, 14);
  w.cyl(0.05, 0.05, 1.2, GOLD, 0, 0.7, 0, g, 8);
  w.ball(0.11, 0x9c2a3a, 0, 1.35, 0, g);
}
// The snack kiosk becomes a champagne bar in marble and gold.
function champagneBar(ctx, x, z) {
  const { w } = ctx,
    g = w.group(x, 0, z, w.scene, -Math.PI / 2);
  w.box(2.4, 1.15, 2.0, 0xf3ead6, 0, 0.58, 0, 0.1, g);
  w.box(2.6, 0.12, 2.2, GOLD, 0, 1.2, 0, 0.05, g);
  w.box(2.5, 0.08, 0.16, GOLD, 0, 0.35, 1.0, 0.02, g);
  for (const xx of [-1.15, 1.15]) w.cyl(0.07, 0.07, 1.9, GOLD, xx, 2.15, 0.95, g, 8);
  for (let i = 0; i < 7; i++) {
    const s = w.box(0.4, 0.08, 1.45, i % 2 ? 0xf3ead6 : 0x9c2a3a, -1.2 + i * 0.4, 3.1, 0.35, 0.02, g);
    s.rotation.x = -0.35;
  }
  w.textPlane("CHAMPAGNE", 1.7, 0.34, "#243657", "#f2d58a", 0, 0.8, 1.01, g, 46);
  for (let i = 0; i < 4; i++)
    w.cyl(0.07, 0.1, 0.42, i % 2 ? 0x3a7a4a : 0x243657, -0.6 + i * 0.4, 1.47, 0.2, g, 8);
}

// ---- grandstands ------------------------------------------------------------------------------------------
const STAND = { tiers: 8, depth: 1.15, rise: 0.55 };
function stands(ctx) {
  const { w, hall, upper } = ctx,
    sections = [0xe0513f, GOLD, 0x2f9aa0, 0xfff1d6];
  const list = [
    {
      name: "right",
      axis: "x",
      dir: 1,
      front: 17.7,
      from: -13.6,
      to: 22.4,
      ry: -Math.PI / 2,
      parent: w.scene,
      coachOnly: false,
    },
    {
      name: "front",
      axis: "z",
      dir: 1,
      front: 14.6,
      from: -14.4,
      to: 16.4,
      ry: Math.PI,
      parent: w.scene,
      coachOnly: false,
    },
    {
      name: "left",
      axis: "x",
      dir: -1,
      front: -16.9,
      from: -13.6,
      to: 22.4,
      ry: Math.PI / 2,
      parent: upper,
      coachOnly: true,
    },
  ];
  const ribbon = ribbonTexture(w);
  for (const s of list) {
    const length = s.to - s.from,
      mid = (s.from + s.to) / 2,
      seats = [];
    for (let k = 0; k < STAND.tiers; k++) {
      const h = STAND.rise * (k + 1),
        along = s.front + s.dir * (k + 0.5) * STAND.depth;
      if (s.axis === "x")
        w.box(STAND.depth, h, length, k % 2 ? 0x1c2a48 : 0x243657, along, FLOOR + h / 2, mid, 0, s.parent);
      else w.box(length, h, STAND.depth, k % 2 ? 0x1c2a48 : 0x243657, mid, FLOOR + h / 2, along, 0, s.parent);
      // Seat strips in coloured sections.
      for (let a = s.from; a < s.to - 0.01; a += 9) {
        const seg = Math.min(9, s.to - a),
          color = sections[(Math.floor((a - s.from) / 9) + k) % sections.length],
          seatAlong = along - s.dir * 0.28;
        if (s.axis === "x")
          w.box(0.55, 0.1, seg - 0.2, color, seatAlong, FLOOR + h + 0.05, a + seg / 2, 0.02, s.parent);
        else w.box(seg - 0.2, 0.1, 0.55, color, a + seg / 2, FLOOR + h + 0.05, seatAlong, 0.02, s.parent);
      }
      for (let a = s.from + 0.5, i = 0; a < s.to - 0.3; a += 0.95, i++) {
        if (i % 10 === 9 || ctx.rand() < 0.16) continue;
        const pos = along + s.dir * 0.1;
        seats.push(
          s.axis === "x"
            ? { x: pos, y: FLOOR + h - 0.36, z: a, ry: s.ry }
            : { x: a, y: FLOOR + h - 0.36, z: pos, ry: s.ry },
        );
      }
    }
    // The LED ribbon along the front of the stand, scrolling.
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
    ctx.ribbons.push(mat.map);
    const mesh = new THREE.Mesh(board, mat);
    s.parent.add(mesh);
    w.dimmers.push((k) => mat.color.setScalar(Math.min(1, k)));
    w.textures.push(mat.map);
    const crowd = new Crowd(w, s.coachOnly ? hall.live : w.scene, seats, {
      seed: 3 + list.indexOf(s),
      waveAxis: s.axis === "x" ? "z" : "x",
      scale: 0.95,
    });
    if (!s.coachOnly) w.liveProps.push(crowd.bodies, crowd.heads, crowd.arms);
    ctx.crowds.push({ crowd, coachOnly: s.coachOnly });
  }
}

function ribbonTexture(w) {
  const t = crackTexture(
    (c, W, H) => {
      c.fillStyle = "#101a30";
      c.fillRect(0, 0, W, H);
      c.font = "900 44px Arial";
      c.textBaseline = "middle";
      c.fillStyle = "#f2d58a";
      c.fillText("POOL PANIC  ★  GRAND GALA  ★  SEASON FINALE  ★", 10, H / 2);
      c.fillStyle = "#e0513f";
      c.fillRect(0, 0, W, 5);
      c.fillRect(0, H - 5, W, 5);
    },
    1024,
    64,
  );
  t.wrapS = THREE.RepeatWrapping;
  w.textures.push(t);
  return t;
}

// ---- the hanging scoreboard ---------------------------------------------------------------------------------
function scoreboard(ctx) {
  const { w, hall, upper } = ctx,
    cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const c2 = cv.getContext("2d"),
    tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  w.textures.push(tex);
  let last = "";
  const draw = (score, time, stars) => {
    c2.fillStyle = "#0e1830";
    c2.fillRect(0, 0, 512, 256);
    c2.strokeStyle = "#f2d58a";
    c2.lineWidth = 8;
    c2.strokeRect(6, 6, 500, 244);
    c2.fillStyle = "#f2d58a";
    c2.textAlign = "center";
    c2.textBaseline = "middle";
    c2.font = "900 54px Arial";
    c2.fillText("GRAND GALA", 256, 46);
    c2.font = "900 96px monospace";
    c2.fillStyle = "#fff6e4";
    c2.fillText(String(Math.round(score)).padStart(4, "0"), 256, 128);
    c2.font = "800 40px monospace";
    c2.fillStyle = "#79e0a0";
    c2.fillText(time, 130, 214);
    c2.fillStyle = "#f4c849";
    c2.fillText("★".repeat(stars) + "☆".repeat(3 - stars), 372, 214);
    tex.needsUpdate = true;
  };
  draw(0, "0:00", 0);
  const face = new THREE.MeshBasicMaterial({ map: tex }),
    dark = new THREE.MeshStandardMaterial({ color: 0x101827, roughness: 0.6 });
  const cube = new THREE.Group();
  cube.position.set(CX, 20, 3);
  upper.add(cube);
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), face);
    p.position.set(Math.sin((i * Math.PI) / 2) * 3.62, 0, Math.cos((i * Math.PI) / 2) * 3.62);
    p.rotation.y = (i * Math.PI) / 2;
    cube.add(p);
  }
  cube.add(new THREE.Mesh(new THREE.BoxGeometry(7.24, 3.64, 7.24), dark));
  const underside = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2), face);
  underside.rotation.x = Math.PI / 2;
  underside.position.y = -1.83;
  cube.add(underside);
  for (const [x, z] of [
    [-3.4, -3.4],
    [3.4, -3.4],
    [3.4, 3.4],
    [-3.4, 3.4],
  ]) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 6), dark);
    cable.position.set(x, 4.8, z);
    cube.add(cable);
  }
  w.dimmers.push((k) => face.color.setScalar(Math.min(1, k)));
  hall.animators.push((time, dt, world, sim) => {
    cube.rotation.y = Math.sin(time * 0.15) * 0.35;
    if (!sim) return;
    const left = Math.max(0, (sim.config?.duration || 0) - (sim.time || 0)),
      clock = Math.floor(left / 60) + ":" + String(Math.floor(left % 60)).padStart(2, "0"),
      stars = ((sim.config?.thresholds || []).filter((t) => sim.score >= t) || []).length,
      key = Math.round(sim.score || 0) + clock + stars;
    if (key !== last) {
      last = key;
      draw(sim.score || 0, clock, stars);
    }
  });
}

// ---- spotlights ---------------------------------------------------------------------------------------------
// Two rigs along the hall, each with eight lamps that sweep pools of colour across the platform. The beams are for the
// Coach Cam; the pools of light on the deck show in the overview too.
function spotlights(ctx) {
  const { w, hall, upper } = ctx,
    glow = glowTexture(96),
    beamTex = beamTexture(),
    colors = [0xfff0d0, 0xffb0c8, 0x9fe8ff, 0xffe27a],
    spots = [],
    dark = new THREE.MeshStandardMaterial({ color: 0x1a2236, roughness: 0.5, metalness: 0.4 });
  w.textures.push(glow, beamTex);
  const beamMats = colors.map(
    (color) =>
      new THREE.MeshBasicMaterial({
        map: beamTex,
        color,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
  );
  const decalMats = colors.map(
    (color) =>
      new THREE.MeshBasicMaterial({
        map: glow,
        color,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
  );
  let index = 0;
  for (const rigX of [CX - 12, CX + 12]) {
    const y = 21;
    const rig = w.box(0.4, 0.4, 37, dark, rigX, y + 0.35, 4, 0.02, upper);
    rig.castShadow = false;
    for (const z of [-12, 20]) {
      w.box(0.12, 6, 0.12, dark, rigX, y + 3.3, z, 0, upper);
    }
    for (let k = 0; k < 8; k++, index++) {
      const z = -13 + k * 4.6,
        m = index % colors.length;
      const pivot = new THREE.Group();
      pivot.position.set(rigX, y, z);
      upper.add(pivot);
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.22, 0.75, 10).rotateX(Math.PI / 2),
        dark,
      );
      housing.position.z = 0.35;
      pivot.add(housing);
      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.29, 12),
        new THREE.MeshBasicMaterial({ color: colors[m] }),
      );
      lens.position.z = 0.75;
      pivot.add(lens);
      const L = 22,
        top = 0.5,
        wide = 3.6,
        beam = beamGeometry(top, wide, L);
      const mesh = new THREE.Mesh(beam, beamMats[m]);
      mesh.renderOrder = 4;
      mesh.position.z = 0.7;
      pivot.add(mesh);
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), decalMats[m]);
      decal.rotation.x = -Math.PI / 2;
      decal.renderOrder = 1;
      w.scene.add(decal);
      spots.push({ pivot, decal, phase: index * 0.9, base: [CX + ((index % 5) - 2) * 3.4, (k - 3.5) * 2.6] });
    }
  }
  w.dimmers.push((k) => {
    beamMats.forEach((m) => (m.opacity = 0.16 * Math.min(1, k)));
    decalMats.forEach((m) => (m.opacity = 0.26 * Math.min(1, k)));
  });
  const target = new THREE.Vector3();
  w.updaters.push((time) => {
    for (const s of spots) {
      const a = time * 0.42 + s.phase;
      target.set(s.base[0] + Math.sin(a) * 4, 0.04, s.base[1] + Math.cos(a * 0.8) * 3.2);
      s.decal.position.set(target.x, 0.05, target.z);
      if (hall.coach) {
        s.pivot.lookAt(target);
      }
    }
  });
  void hall;
}
// A beam widening away from the lamp: two crossed trapezoids along local +Z, textured with the soft beam gradient.
function beamGeometry(top, wide, length) {
  const v = [],
    uv = [],
    idx = [];
  const quad = (axis) => {
    const base = v.length / 3,
      a = top / 2,
      b = wide / 2;
    const corners =
      axis === "x"
        ? [
            [-a, 0, 0],
            [a, 0, 0],
            [b, 0, length],
            [-b, 0, length],
          ]
        : [
            [0, -a, 0],
            [0, a, 0],
            [0, b, length],
            [0, -b, length],
          ];
    corners.forEach((p) => v.push(...p));
    uv.push(0, 1, 1, 1, 1, 0, 0, 0);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  quad("x");
  quad("y");
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ---- balloons and cannons --------------------------------------------------------------------------------------
function balloons(ctx) {
  const { w, upper, rand } = ctx,
    n = 90,
    mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.42, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
      n,
    ),
    d = new THREE.Object3D(),
    colors = [GOLD, 0xe0513f, 0x2f9aa0, 0xfff1d6, 0x529fd5, 0xe45c8b],
    base = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1,
      x = CX + side * (17 + rand() * 6),
      y = 21 + rand() * 1.6 - Math.abs(side * 0.3),
      z = -6 + rand() * 24;
    base.push([x, y, z, rand() * TAU]);
    mesh.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    d.position.set(x, y, z);
    d.scale.set(1, 1.15, 1);
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
  }
  mesh.frustumCulled = false;
  ctx.hall.live.add(mesh);
  ctx.hall.animators.push((time) => {
    for (let i = 0; i < n; i++) {
      const [x, y, z, p] = base[i];
      d.position.set(
        x + Math.sin(time * 0.4 + p) * 0.3,
        y + Math.sin(time * 0.7 + p) * 0.25,
        z + Math.cos(time * 0.35 + p) * 0.3,
      );
      d.scale.set(1, 1.15, 1);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  void w;
}

function cannons(ctx) {
  const { w } = ctx;
  for (const [x, z] of [
    [-15.2, -14.4],
    [16, -14.4],
    [-15.2, 12],
    [16, 12],
  ]) {
    const g = w.group(x, 0, z);
    w.cyl(0.24, 0.3, 1.1, 0xc9a24a, 0, 0.55, 0, g, 10).rotation.z = x < 0 ? -0.35 : 0.35;
    w.cyl(0.3, 0.3, 0.14, 0x9c2a3a, 0, 0.07, 0, g, 10);
    w.ball(0.1, 0xf4c849, x < 0 ? 0.2 : -0.2, 1.15, 0, g);
  }
}

export { stripedCone, plant, signTexture, CROWD_COLORS };
