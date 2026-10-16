// The Aqua Disco (16 October 2026): a party pool for an aqua-aerobics class. A plan of its own (DISCO in spatial.mjs): four
// zones of open water with no ropes, lines or starting blocks, the class in rows facing a round stage past the far end where
// Valentina, the instructor, dances the routine (dance.mjs) that the class copies. Around it, everything moves to the beat
// (120 BPM, the music of music.mjs): moving-head spotlights sweeping pools of colour left and right across the water and the
// deck, the sparkles of a mirror ball turning, lasers fanning over the pool, an LED strip chasing round the coping, underwater
// lamps changing colour, speaker cones pumping, a DJ nodding at his decks with the records spinning, a neon sign and an
// equaliser screen on the back wall, a neon bar. The hall above (a dark roof with the mirror ball itself, neon bunting) is for
// the Coach Cam only, like every indoor hall. In a blackout everything that glows goes dark (`world.dimmers`).
import { THREE } from "./kit.mjs";
import { buildPool, buildDeck } from "./pool.mjs";
import { checkerTextures, glowTexture } from "./textures.mjs";
import { poolSurround, kioskTreats } from "./resort.mjs";
import { Hall } from "./hall.mjs";
import { rngOf } from "./geom.mjs";
import {
  bench,
  plant,
  finRack,
  station,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
} from "./props.mjs";
import { character } from "./actors.mjs";
import { attachSwimmerModel, loadFigure } from "./swimmer-models.mjs";
import { danceAt, pulse } from "../dance.mjs";

const FLOOR = -1.95;
const INK = 0x0d0818;
const PURPLE = 0x2a1650;
const MAGENTA = 0xff3fb4;
const CYAN = 0x34e6ff;
const LIME = 0x9cff4f;
const GOLD = 0xffd24a;
const NEON = [MAGENTA, CYAN, LIME, GOLD, 0x8f6bff];

const DISCO_HALL = {
  minX: -14.7,
  maxX: 14.7,
  minZ: -16.15,
  maxZ: 13.95,
  floor: FLOOR,
  low: FLOOR,
  eave: 9,
  ridge: 14,
  profile: "arch",
  arcSegments: 12,
  trusses: "lattice",
  trussDepth: 1.4,
  stations: [-12, -4, 4, 12],
  wainscot: 2.2,
  colors: {
    wall: 0x1c1236,
    trim: 0x3b2a6a,
    accent: MAGENTA,
    dark: INK,
    metal: 0x4a4a62,
    boards: 0x24183e,
    tile: "#2a1a52",
    lamp: 0xff8ad8,
    woodBase: "#3a2a4a",
  },
  sky: { top: "#0a0620", bottom: "#2a1250" },
  glass: [0.9, 1.0],
  night: true,
  boardsEmissive: 0x2a1a4a,
  boardsGlow: 0.3,
  seed: 33,
  noWindows: true,
  oculus: 0,
  skylights: false,
  shaftSegments: [],
  bunting: NEON,
  buntingX: [-10, -3.4, 3.4, 10],
  buntingLevels: [0.45],
  buntingDrop: 1.4,
  banners: [
    { color: "#1a0f33", trim: "#ff3fb4" },
    { color: "#1a0f33", trim: "#34e6ff" },
    { color: "#1a0f33", trim: "#9cff4f" },
  ],
  bannerText: { lines: ["AQUA", "DISCO"], sub: "DANCE · SPLASH · REPEAT", ink: "#ff8ad8" },
  bannerX: 11.5,
  bannerHeight: 5.6,
  crownBeam: 13,
  ridgeHang: 12.8,
  ridgeFlagStep: 2.2,
  lampX: [-9, 0, 9],
  lampTop: 11,
  lampPool: 4,
  poolLight: 0.1,
  noDucts: true,
  fans: [],
  sconceCount: 0,
  motes: 40,
  crest: {
    text: "AQUA DISCO",
    sub: "POOL PANIC · AQUA AEROBICS CLASS",
    bg: "#1a0f33",
    fg: "#ff8ad8",
    width: 8,
    height: 3.6,
    y: 9.2,
  },
};

export function buildDisco(w, venue) {
  buildDeck(w, venue, {
    checker: { a: "#221640", b: "#170f2c", grout: "#0b0716", tiles: 4 },
    slab: INK,
    rim: MAGENTA,
    side: 0x2a1a4a,
  });
  buildPool(w, venue, w.look.water, {
    floorTiles: ["#1f8fd6", "#8fd8ff"],
    wallTiles: ["#2d7fd0", "#b7e6ff"],
    line: null,
    ropes: null,
    pennants: null,
  });
  poolSurround(w, venue, { base: "#2a1a52", grout: "#ff8ad8", seed: 61 });
  const hall = new Hall(w, DISCO_HALL);
  const ctx = { w, venue, hall, rand: rngOf(71), beats: [] };
  roomFloor(ctx);
  lowWalls(ctx);
  backWall(ctx);
  entrance(ctx);
  for (const f of venue.furniture) {
    if (f.kind === "bench") bench(w, f.x, f.z, f.angle);
    if (f.kind === "plant") plant(w, f.x, f.z, f.scale || 1);
    if (f.kind === "speaker") speaker(ctx, f.x, f.z);
    if (f.kind === "dj-booth") djBooth(ctx, f.x, f.z);
    if (f.kind === "bar") bar(ctx, f.x, f.z);
    if (f.kind === "stage") stage(ctx, f.x, f.z);
  }
  finRack(w, venue.stations.fins);
  station(w, "chlorine", venue.stations.chlorine, GOLD, "WATER CARE", -Math.PI / 2);
  station(w, "relief", venue.stations.relief, 0xddf3d7, "EYE CARE", -Math.PI / 2);
  sanitationCorner(w, venue);
  rescueStations(w, venue);
  fishNetHook(w, venue.fixtures.fishNet);
  flashlightHolder(w, venue.fixtures.flashlight);
  fuseBox(w, venue.fixtures.fuseBox);
  kioskTreats(w, venue.fixtures.treats);
  ledRim(ctx);
  spotlights(ctx);
  sparkles(ctx);
  lasers(ctx);
  mirrorBall(ctx);
  // The beat: every part that moves to it reads the routine's clock, the shift's own time (it stops with a pause), or the page's
  // in the menu. Reduced motion holds it all still at one moment, at a steady glow: no sweeping, no flashing.
  w.updaters.push((time, dt, world, sim) => {
    const calm = world.reducedMotion?.matches,
      t = calm ? 4.2 : sim && sim.status !== "ready" ? sim.time || 0 : time;
    const d = danceAt(t),
      lit = Math.min(1, w.incidentLight ?? 1);
    for (const f of ctx.beats) f(t, d, calm ? 0.5 : pulse(d.phase), lit, calm ? 0 : dt, sim);
  });
  w.dimmers.push((k) => (w.incidentLight = Math.min(1, k)));
}

const canvasTexture = (w, width, height, draw) => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  draw?.(c.getContext("2d"), width, height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  w.textures.push(t);
  return { canvas: c, texture: t };
};
const glowMaterial = (color, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, fog: false });
const hsl = new THREE.Color();

// ---- the room ---------------------------------------------------------------------------------------------------
function roomFloor(ctx) {
  const { w } = ctx,
    t = checkerTextures({ a: "#140c26", b: "#1c1234", grout: "#0a0614", tiles: 4 });
  for (const tx of [t.map, t.bump]) {
    tx.repeat.set(16, 16);
    w.textures.push(tx);
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({
      map: t.map,
      bumpMap: t.bump,
      bumpScale: 0.4,
      roughness: 0.3,
      metalness: 0.2,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR;
  floor.receiveShadow = true;
  w.scene.add(floor);
}
// Low walls on the long sides with a neon strip along the top that breathes with the music.
function lowWalls(ctx) {
  const { w, venue } = ctx,
    room = venue.room,
    length = room.maxZ - room.minZ - 1.4,
    cz = (room.maxZ + room.minZ) / 2 + 0.5;
  const strip = glowMaterial(MAGENTA);
  for (const x of [room.minX + 0.2, room.maxX - 0.2]) {
    w.box(0.32, 1.1, length, PURPLE, x, 0.5, cz, 0.08);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, length), strip);
    s.position.set(x, 1.1, cz);
    w.scene.add(s);
  }
  ctx.beats.push((t, d, p, lit) => {
    hsl.setHSL((0.88 + d.bar * 0.17) % 1, 0.95, 0.45 + 0.25 * p);
    strip.color.copy(hsl).multiplyScalar(lit);
  });
}
// The back wall (screen left): the neon sign and the equaliser screen above the entrance.
function backWall(ctx) {
  const { w } = ctx,
    z0 = -16.35;
  w.box(29.6, 8, 0.4, INK, 0, 3.1, z0 - 0.02, 0);
  // The neon sign: two tubes of light, pink and cyan, that flash on the first beat of every bar.
  const sign = canvasTexture(w, 1024, 256, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "italic 900 150px Arial";
    c.shadowColor = "#ff3fb4";
    c.shadowBlur = 30;
    c.fillStyle = "#ffd1f0";
    c.fillText("AQUA", W * 0.3, H * 0.52);
    c.shadowColor = "#34e6ff";
    c.fillStyle = "#d6fbff";
    c.fillText("DISCO", W * 0.7, H * 0.52);
  });
  const signMat = new THREE.MeshBasicMaterial({ map: sign.texture, transparent: true, fog: false });
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 2.1), signMat);
  signMesh.position.set(0, 5.55, z0 + 0.26);
  w.scene.add(signMesh);
  w.liveProps.push(signMesh);
  // The equaliser: bars that jump on the beat, in the hall's neon.
  const eq = canvasTexture(w, 512, 160),
    c2 = eq.canvas.getContext("2d");
  const eqMat = new THREE.MeshBasicMaterial({ map: eq.texture, fog: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.3), eqMat);
  screen.position.set(0, 3.6, z0 + 0.26);
  w.scene.add(screen);
  w.liveProps.push(screen);
  w.box(6.8, 1.6, 0.2, 0x0a0614, 0, 3.6, z0 + 0.12, 0.05);
  let lastKey = "";
  ctx.beats.push((t, d, p, lit) => {
    signMat.color.setScalar((0.55 + 0.45 * (d.beat % 4 === 0 ? p : 0.4)) * lit);
    eqMat.color.setScalar(lit);
    const key = Math.floor(t * 12);
    if (String(key) === lastKey) return;
    lastKey = String(key);
    c2.fillStyle = "#07040f";
    c2.fillRect(0, 0, 512, 160);
    for (let i = 0; i < 24; i++) {
      const level =
        0.25 +
        0.55 * p * (0.6 + 0.4 * Math.sin(i * 0.9 + t * 3)) +
        0.2 * Math.abs(Math.sin(i * 1.7 + t * 7.3 + d.bar));
      const h = Math.min(1, level) * 140;
      const g = c2.createLinearGradient(0, 160, 0, 160 - h);
      g.addColorStop(0, "#34e6ff");
      g.addColorStop(0.6, "#ff3fb4");
      g.addColorStop(1, "#ffd24a");
      c2.fillStyle = g;
      c2.fillRect(8 + i * 21, 150 - h, 15, h);
    }
    eq.texture.needsUpdate = true;
  });
}

// The way in and out (no locker rooms here: the creator, 16 October 2026): one double door set flush in the back wall, in
// the middle, under the equaliser. Each side of the line has its leaf (`venue.arrival`: guests come out of the dark behind it
// and go back into it), and the leaves swing open towards the deck as someone comes or goes (`world.lockerDoors`, read in
// `World.sync`). A neon frame round it breathes with the music.
function entrance(ctx) {
  const { w, venue } = ctx,
    door = venue.arrival,
    face = -16.12, // the wall's front face
    half = door.doorX * 2 + 0.02, // half the opening: each leaf as wide as its side's lane in
    height = 2.6;
  // The dark beyond, and a step of light on the floor in front.
  w.box(half * 2, height, 0.04, 0x030208, 0, height / 2, face - 0.03, 0);
  const frame = glowMaterial(MAGENTA);
  for (const [sx, sy, x, y] of [
    [0.14, height + 0.14, -half - 0.07, height / 2],
    [0.14, height + 0.14, half + 0.07, height / 2],
    [half * 2 + 0.28, 0.14, 0, height + 0.07],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.1), frame);
    bar.position.set(x, y, face + 0.05);
    w.scene.add(bar);
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a1a52, roughness: 0.5, metalness: 0.4 }),
    pane = glowMaterial(CYAN);
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * half, 0, face + 0.06);
    w.scene.add(hinge);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(half - 0.03, height - 0.05, 0.07), mat);
    leaf.position.set((-side * half) / 2, (height - 0.05) / 2, 0.04);
    leaf.castShadow = true;
    hinge.add(leaf);
    const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), pane);
    porthole.position.set((-side * half) / 2, 1.75, 0.08);
    hinge.add(porthole);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.06), glowMaterial(GOLD));
    handle.position.set(-side * (half - 0.16), 1.1, 0.1);
    hinge.add(handle);
    w.lockerDoors.push({ side, hinge });
  }
  ctx.beats.push((t, d, p, lit) => {
    frame.color.setHSL((0.9 + d.bar * 0.17) % 1, 1, 0.45 + 0.2 * p).multiplyScalar(lit);
    pane.color.set(CYAN).multiplyScalar(lit * 0.7);
  });
}

// ---- the stage and Valentina ---------------------------------------------------------------------------------
// A round platform past the far end of the pool with an LED edge, an arch of bulbs behind, and Valentina on it facing
// the class, dancing the routine. She is a model (models/valentina.glb, fetched here); until it is in, a classic figure in pink
// dances the same moves with its arms.
function stage(ctx, x, z) {
  const { w, venue } = ctx,
    top = venue.stage.y;
  w.cyl(2.7, 2.9, top, 0x1a1030, x, top / 2, z, w.scene, 40);
  const rim = glowMaterial(CYAN);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.07, 8, 64), rim);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, top + 0.02, z);
  w.scene.add(ring);
  w.liveProps.push(ring);
  // A disc of light on the stage's top that pulses on the beat.
  const glow = glowTexture(128);
  w.textures.push(glow);
  const disc = w.decal(glow, 5.2, 5.2, MAGENTA, 0.5, true);
  disc.position.set(x, top + 0.03, z);
  disc.rotation.x = -Math.PI / 2;
  w.scene.add(disc);
  w.liveProps.push(disc);
  // The arch of bulbs behind her.
  const bulbs = [],
    n = 28;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (i / (n - 1));
    bulbs.push([x + Math.cos(a) * 2.6, 0.7 + Math.sin(a) * 2.8]);
  }
  const arch = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), glowMaterial(0xffffff), n);
  bulbs.forEach(([bx, by], i) => {
    arch.setMatrixAt(i, new THREE.Matrix4().setPosition(bx, by + top, z + 0.9));
    arch.setColorAt(i, new THREE.Color(GOLD));
  });
  arch.frustumCulled = false;
  w.scene.add(arch);
  w.liveProps.push(arch);
  // Valentina.
  const person = {
    id: "instructor",
    type: "aqua",
    figure: "valentina",
    skin: 2,
    shape: 0.5,
    name: "Valentina",
  };
  const g = character(w, person);
  g.position.set(x, top, z - 0.1);
  g.rotation.y = Math.PI; // facing the pool
  w.scene.add(g);
  w.liveProps.push(g);
  const u = g.userData;
  w.clickables = w.clickables.filter((m) => m !== u.hit); // (not someone the coach can select)
  let rig = null;
  loadFigure("valentina").then((t) => {
    if (!t || !g.parent) return;
    try {
      rig = attachSwimmerModel(g, person);
    } catch (error) {
      console.warn("Valentina stays classic.", error);
    }
  });
  const color = new THREE.Color();
  ctx.beats.push((t, d, p, lit, dt) => {
    rim.color.setHSL((0.5 + d.bar * 0.13) % 1, 1, 0.5).multiplyScalar(lit);
    disc.material.opacity = (0.25 + 0.45 * p) * lit;
    for (let i = 0; i < n; i++) {
      const on = (i + d.beat) % 3 === 0;
      color.set(on ? GOLD : 0x4a3410).multiplyScalar(lit * (on ? 0.7 + 0.3 * p : 1));
      arch.setColorAt(i, color);
    }
    arch.instanceColor.needsUpdate = true;
    if (rig) {
      rig.update(dt, { dance: { clip: d.clip, time: d.time } });
      return;
    }
    // The classic figure: the same moves with its arms, and a bounce.
    const up = (i) =>
      (d.move === "both" || (d.move === "right") === (i === 0) ? 1 : 0) *
      (0.55 + 0.45 * Math.cos(d.phase * Math.PI * 2));
    u.arms.forEach((a, i) => a.rotation.set(0, 0, (i ? -1 : 1) * (0.4 + 2.4 * up(i))));
    u.root.position.y = Math.max(0, Math.sin(d.phase * Math.PI)) * 0.06;
  });
}

// ---- deck furniture ------------------------------------------------------------------------------------------
// A speaker stack: two cones that pump on the beat, and a moving head on top.
function speaker(ctx, x, z) {
  const { w } = ctx;
  w.box(1.1, 1.9, 1.0, 0x120a20, x, 0.95, z, 0.08);
  const facing = Math.atan2(-x, -z); // toward the middle of the pool
  const cones = [];
  for (const [y, r] of [
    [1.35, 0.32],
    [0.6, 0.4],
  ]) {
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 0.6, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 0.5, metalness: 0.3 }),
    );
    cone.rotation.x = Math.PI / 2;
    const holder = new THREE.Group();
    holder.position.set(x, y, z);
    holder.rotation.y = facing;
    cone.position.z = 0.5;
    holder.add(cone);
    w.scene.add(holder);
    w.liveProps.push(holder);
    cones.push(cone);
  }
  const led = glowMaterial(CYAN);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.06, 1.02), led);
  strip.position.set(x, 1.92, z);
  w.scene.add(strip);
  w.liveProps.push(strip);
  ctx.beats.push((t, d, p, lit) => {
    for (const c of cones) c.scale.set(1 + 0.12 * p, 1, 1 + 0.12 * p);
    led.color.setHSL((0.5 + 0.3 * Math.sin(t * 0.7 + x)) % 1, 1, 0.5).multiplyScalar(lit * (0.5 + 0.5 * p));
  });
}
// The DJ booth: a desk with a light panel, two decks with the records spinning, and the DJ nodding on the beat with a hand up now
// and then.
function djBooth(ctx, x, z) {
  const { w } = ctx,
    g = w.group(x, 0, z, w.scene, Math.PI / 2);
  w.box(2.4, 1.0, 1.1, 0x120a20, 0, 0.5, 0, 0.06, g);
  const panel = glowMaterial(MAGENTA);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), panel);
  front.position.set(0, 0.5, 0.56);
  g.add(front);
  w.box(2.5, 0.08, 1.2, 0x2a2440, 0, 1.04, 0, 0.02, g);
  const records = [];
  for (const dx of [-0.65, 0.65]) {
    w.box(0.7, 0.08, 0.7, 0x1a1a24, dx, 1.12, 0, 0.02, g);
    const rec = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.02, 24),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3 }),
    );
    rec.position.set(dx, 1.17, 0);
    g.add(rec);
    w.ball(0.05, MAGENTA, dx, 1.19, 0, g);
    records.push(rec);
  }
  // The DJ: a body, a head with headphones, an arm that goes up on the last beat of a bar.
  const dj = new THREE.Group();
  dj.position.set(0, 0, -0.75);
  g.add(dj);
  w.cyl(0.26, 0.3, 1.1, 0x34e6ff, 0, 0.95, 0, dj, 12);
  const head = new THREE.Group();
  head.position.set(0, 1.72, 0);
  dj.add(head);
  w.ball(0.26, 0xc78e65, 0, 0, 0, head);
  const phones = w.torus(0.27, 0.04, 0x1a1a24, head, Math.PI);
  phones.rotation.z = 0;
  for (const s of [-1, 1]) w.ball(0.09, MAGENTA, s * 0.27, 0, 0, head);
  const arm = new THREE.Group();
  arm.position.set(0.3, 1.4, 0);
  dj.add(arm);
  w.cyl(0.07, 0.07, 0.6, 0x34e6ff, 0, -0.3, 0, arm, 8);
  w.liveProps.push(g);
  ctx.beats.push((t, d, p, lit, dt) => {
    for (const r of records) r.rotation.y += dt * 3.5;
    head.rotation.x = 0.25 * p;
    dj.position.y = 0.04 * p;
    arm.rotation.z = d.beat % 4 === 3 ? 2.6 : 0.3;
    panel.color.setHSL((0.85 + d.beat * 0.05) % 1, 1, 0.5).multiplyScalar(lit * (0.6 + 0.4 * p));
  });
}
// The bar: a counter under a neon strip with bottles that glow, the dog treats on top (kioskTreats).
function bar(ctx, x, z) {
  const { w } = ctx,
    g = w.group(x, 0, z, w.scene, Math.PI / 2);
  w.box(2.8, 1.1, 1.2, 0x1a1030, 0, 0.55, 0, 0.06, g);
  w.box(3.0, 0.1, 1.35, 0x3b2a6a, 0, 1.12, 0, 0.03, g);
  const neon = glowMaterial(LIME);
  const tube = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 0.06), neon);
  tube.position.set(0, 0.95, 0.62);
  g.add(tube);
  for (let i = 0; i < 6; i++) {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.36, 10),
      glowMaterial(NEON[i % NEON.length], 0.85),
    );
    bottle.position.set(-1.1 + i * 0.44, 1.35, -0.3);
    g.add(bottle);
  }
  w.textPlane("JUICE BAR", 1.6, 0.34, "#1a1030", "#9cff4f", 0, 0.5, 0.61, g, 46);
  w.liveProps.push(g);
  ctx.beats.push((t, d, p, lit) => neon.color.set(LIME).multiplyScalar(lit * (0.5 + 0.5 * p)));
}

// ---- lights that move to the music ------------------------------------------------------------------------------
// An LED strip all round the coping: a rainbow that chases round the pool, brighter on the beat.
function ledRim(ctx) {
  const { w, venue } = ctx,
    P = venue.pool,
    hx = P.halfX + 0.48,
    hz = P.halfZ + 0.48,
    step = 0.5,
    points = [];
  for (let x = -hx; x < hx; x += step) points.push([x, -hz]);
  for (let z = -hz; z < hz; z += step) points.push([hx, z]);
  for (let x = hx; x > -hx; x -= step) points.push([x, hz]);
  for (let z = hz; z > -hz; z -= step) points.push([-hx, z]);
  const n = points.length,
    mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.05, 0.34), glowMaterial(0xffffff), n);
  points.forEach(([x, z], i) => {
    mesh.setMatrixAt(i, new THREE.Matrix4().setPosition(x, 0.14, z));
    mesh.setColorAt(i, new THREE.Color(MAGENTA));
  });
  mesh.frustumCulled = false;
  w.scene.add(mesh);
  w.liveProps.push(mesh);
  const color = new THREE.Color();
  ctx.beats.push((t, d, p, lit) => {
    for (let i = 0; i < n; i++) {
      color.setHSL((i / n + t * 0.12) % 1, 1, 0.42 + 0.2 * p);
      mesh.setColorAt(i, color.multiplyScalar(lit));
    }
    mesh.instanceColor.needsUpdate = true;
    // The pool's own underwater lamps follow the bar's colour (the scene dims them in a blackout).
    if (w.poolLamps) w.poolLamps.base.setHSL((0.55 + d.bar * 0.21) % 1, 1, 0.6);
  });
}
// Moving heads: pools of coloured light that sweep left and right across the water and the deck, to the beat, all the shift.
function spotlights(ctx) {
  const { w } = ctx,
    glow = glowTexture(96);
  w.textures.push(glow);
  const spots = [];
  for (let i = 0; i < 8; i++) {
    const decal = w.decal(glow, 4.6, 4.6, NEON[i % NEON.length], 0.32, true);
    decal.rotation.x = -Math.PI / 2;
    decal.renderOrder = 3;
    w.scene.add(decal);
    w.liveProps.push(decal);
    spots.push({ decal, lane: -6 + (i % 4) * 4, row: i < 4 ? -4 : 4, phase: i * 0.8 });
  }
  ctx.beats.push((t, d, p, lit) => {
    for (const s of spots) {
      // Left and right across the pool, a whole sweep every two bars, the two rows in opposite directions.
      const swing = Math.sin((d.beats / 8) * Math.PI + s.phase) * (s.row < 0 ? 1 : -1);
      s.decal.position.set(s.lane + swing * 5.5, 0.06, s.row + Math.cos(d.beats * 0.4 + s.phase) * 2.5);
      s.decal.material.opacity = (0.22 + 0.22 * p) * lit;
    }
  });
}
// The mirror ball's sparkles: little points of light circling slowly over the water and the deck.
function sparkles(ctx) {
  const { w, rand } = ctx,
    n = 140,
    glow = glowTexture(32, 2);
  w.textures.push(glow);
  const mat = new THREE.MeshBasicMaterial({
    map: glow,
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.42).rotateX(-Math.PI / 2), mat, n);
  const dots = Array.from({ length: n }, () => ({
    r: 2 + rand() * 13,
    a: rand() * Math.PI * 2,
    y: 0.05 + rand() * 0.04,
  }));
  const m = new THREE.Matrix4();
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  w.scene.add(mesh);
  w.liveProps.push(mesh);
  ctx.beats.push((t, d, p, lit) => {
    const spin = t * 0.18;
    dots.forEach((s, i) => {
      m.makeTranslation(Math.cos(s.a + spin) * s.r, s.y, Math.sin(s.a + spin) * s.r * 0.8);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mat.opacity = (0.45 + 0.35 * p) * lit;
  });
}
// Lasers from the back wall, fanning out over the pool and back on the beat.
function lasers(ctx) {
  const { w } = ctx,
    beams = [];
  for (const [x, color] of [
    [-6, LIME],
    [0, MAGENTA],
    [6, CYAN],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 4.6, -15.9);
    w.scene.add(pivot);
    w.liveProps.push(pivot);
    w.box(0.4, 0.3, 0.4, 0x2a2440, x, 4.6, -16.0, 0.03);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    for (let k = 0; k < 3; k++) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 30, 6).translate(0, 15, 0), mat);
      beam.rotation.x = Math.PI / 2 - 0.12;
      const fan = new THREE.Group();
      fan.add(beam);
      fan.rotation.y = (k - 1) * 0.22;
      pivot.add(fan);
    }
    beams.push({ pivot, mat, x });
  }
  ctx.beats.push((t, d, p, lit) => {
    for (const b of beams) {
      b.pivot.rotation.y = Math.sin(d.beats * 0.5 + b.x) * 0.45;
      b.pivot.rotation.x = -0.05 - 0.05 * Math.sin(d.beats * 0.25);
      b.mat.opacity = (d.move === "both" ? 0.65 : 0.35) * lit * (0.6 + 0.4 * p);
    }
  });
}
// The mirror ball itself, high over the pool (the Coach Cam sees it; the overview has its sparkles).
function mirrorBall(ctx) {
  const { w, hall } = ctx,
    ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.9, 2),
      new THREE.MeshStandardMaterial({ color: 0xe8e8ff, metalness: 1, roughness: 0.12, flatShading: true }),
    );
  ball.position.set(0, 7.6, 0);
  hall.live.add(ball); // (the hall's live group: not baked into a batch, so it turns)
  w.box(0.04, 4.4, 0.04, 0x8a8aa0, 0, 10.3, 0, 0, hall.ctx.g);
  hall.animators.push((time) => (ball.rotation.y = time * 0.6));
}
