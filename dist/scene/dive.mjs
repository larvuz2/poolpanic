// The Jumping Pool on screen (24 October 2026, the creator: "an open-air country-club complex… bright daylight, colourful tiles,
// garden areas, trees, and sky… height markers in green, yellow and red… an open massage corner… no walls, warm non-slip tiles,
// folded towels, equipment shelf, plants, and a relaxation sign… LETS ADD A HOTTUB HERE"). A deep pool in a mosaic of blues with a
// band of Mediterranean tiles at its waterline, on a deck of warm travertine; at each end a diving station: the green LOW
// springboard on its fulcrum stand nearest the camera, the yellow MID platform and the red HIGH tower behind it, each with its own
// stairs and its height painted on its front; a round hot tub in a teak deck on the far side, steaming, and beside it the massage
// corner under a pergola; lawns, clipped hedges with a white gate at each near corner, flower beds, trees, and the clubhouse with
// its columns and awnings beyond the far hedge. The divers, the springboard's bend and the tub's guests are scene/dive-view.mjs's.
//
// Nothing here moves the simulation.
import { THREE, COLORS } from "./kit.mjs";
import { DIVE, HEIGHTS, BOARDS, LADDERS, TUB, MASSAGE_BEDS, tubSteps } from "../dive-plan.mjs";
import { buildPool, buildDeck } from "./pool.mjs";
import { mosaicTexture } from "./textures.mjs";
import { rngOf } from "./geom.mjs";
import { propModel } from "./prop-models.mjs";
import {
  station,
  sanitationCorner,
  rescueStations,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  treatsTable,
  lifeguardChair,
  stripedCone,
} from "./props.mjs";
import { buildDiveCast, TUB_TOP, TUB_WATER_Y } from "./dive-view.mjs";
export { TUB_WATER_Y };

const TAU = Math.PI * 2;
const CONCRETE = 0xf1ede4,
  CONCRETE_DARK = 0xd8d1c3,
  RAIL = 0xc9d3d6,
  TEAK = 0xa8714a,
  TEAK_DARK = 0x7c5234,
  HEDGE = 0x3f7a3a,
  LAWN = 0x78b552,
  CREAM = 0xf6efdf,
  TERRACOTTA = 0xc8664a,
  NAVY = 0x23415e;
const MARKER = HEIGHTS.map((h) => new THREE.Color(h.color).getHex());

export function buildDive(w, venue) {
  const live = new THREE.Group();
  live.name = "dive-live";
  w.scene.add(live);
  w.liveProps.push(live);
  const ctx = { w, venue, live, rand: rngOf(211) };
  w.camera.far = 320;
  w.camera.updateProjectionMatrix();
  lawn(ctx);
  deckAndPool(ctx);
  stations(ctx);
  hotTub(ctx);
  spaCorner(ctx);
  garden(ctx);
  clubhouse(ctx);
  gates(ctx);
  dressing(ctx);
  pickVolumes(ctx);
  buildDiveCast(w, ctx);
}

// ---- the ground, the deck and the pool ----------------------------------------------------------------------------------

function lawn(ctx) {
  const { w } = ctx;
  // A great lawn under everything, a little darker far off, with mown stripes near the deck.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshStandardMaterial({ color: 0x6aa648, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.62;
  ground.receiveShadow = true;
  w.scene.add(ground);
  for (let k = -9; k <= 9; k++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 60),
      new THREE.MeshStandardMaterial({ color: k % 2 ? 0x7dbb55 : 0x71ad4c, roughness: 0.95 }),
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(DIVE.room.minX - 14, -0.6, k * 4);
    stripe.receiveShadow = true;
    w.scene.add(stripe);
  }
}

function deckAndPool(ctx) {
  const { w, venue } = ctx;
  buildDeck(w, venue, {
    base: "#efe3cd",
    grout: "#d6c6a8",
    pavers: true,
    slab: 0xd9ccb2,
    rim: 0xc5b597,
    side: 0xe8dcc4,
    openBasin: true,
  });
  // The pool: a deep mosaic of blues, a band of patterned tiles at the waterline, white coping, ladders at the long sides.
  const floorMap = mosaicTexture({ seed: 41, base: "#2f7fc4", grout: "#9fd1f0" }),
    wallMap = mosaicTexture({ seed: 43, base: "#3b93cf", grout: "#bfe3f5" });
  floorMap.repeat.set(DIVE.halfX * 1.2, DIVE.halfZ * 1.2);
  wallMap.repeat.set(6, 2.2);
  buildPool(
    w,
    venue,
    {
      shallow: [0.08, 0.46, 0.8],
      deep: [0.02, 0.2, 0.52],
      sky: [0.7, 0.88, 1],
      glint: [1, 0.97, 0.9],
      clarity: 0.3,
    },
    {
      line: null,
      ropes: null,
      pennants: null,
      floorMap,
      wallMap,
      band: 0x1d4f86,
      coping: { color: 0xf4efe6, roughness: 0.55 },
      ladders: { color: 0xe9eef0, metalness: 0.55, rung: 0xf0f2ee },
      depth: DIVE.depth,
      ladderAt: LADDERS.map((l) => [l.side * DIVE.halfX, l.water.z]),
    },
  );
  // (the basin's lane volumes: the Jumping Pool has none, its boards and its tub are clicked instead: pickVolumes)
  w.clickables = w.clickables.filter((m) => m.userData?.kind !== "lane");
  // A band of patterned tiles round the waterline: terracotta, saffron and teal diamonds on cream.
  const band = bandTexture();
  w.textures.push(band);
  const bandMat = new THREE.MeshStandardMaterial({ map: band, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const long = w.mesh(
      new THREE.PlaneGeometry(DIVE.halfZ * 2, 0.3),
      bandMat,
      s * (DIVE.halfX - 0.105),
      -0.43,
      0,
    );
    long.rotation.y = -s * (Math.PI / 2);
    band.repeat.set(DIVE.halfZ * 2, 1);
    const end = w.mesh(
      new THREE.PlaneGeometry(DIVE.halfX * 2, 0.3),
      bandMat,
      0,
      -0.43,
      s * (DIVE.halfZ - 0.085),
    );
    end.rotation.y = s > 0 ? Math.PI : 0;
  }
  // Under each board, a target painted on the deep floor in the board's colour.
  for (const b of BOARDS) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 40),
      new THREE.MeshStandardMaterial({
        color: MARKER[b.h],
        roughness: 0.6,
        transparent: true,
        opacity: 0.55,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(b.x, -DIVE.depth + 0.09, b.tipZ + b.dir * (1.6 + b.h * 0.4));
    w.scene.add(ring);
  }
}

function bandTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#f7efdc";
  g.fillRect(0, 0, 128, 64);
  const colors = ["#c8664a", "#e9b23f", "#2e9c9a", "#1d4f86"];
  for (let i = 0; i < 4; i++) {
    const x = 16 + i * 32;
    g.fillStyle = colors[i];
    g.beginPath();
    g.moveTo(x, 6);
    g.lineTo(x + 14, 32);
    g.lineTo(x, 58);
    g.lineTo(x - 14, 32);
    g.closePath();
    g.fill();
    g.fillStyle = "#f7efdc";
    g.beginPath();
    g.arc(x, 32, 5, 0, TAU);
    g.fill();
  }
  g.fillStyle = "#1d4f86";
  g.fillRect(0, 0, 128, 4);
  g.fillRect(0, 60, 128, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---- the diving stations ------------------------------------------------------------------------------------------------

function stations(ctx) {
  const { w } = ctx;
  w.springboards = [];
  for (const b of BOARDS) {
    if (b.h === 0) springboard(ctx, b);
    else platform(ctx, b);
    stairs(ctx, b);
    lineMarks(ctx, b);
  }
  // The station's back: a low white wall behind the stairs' feet, with its name.
  for (const side of [-1, 1]) {
    const z = side * (DIVE.halfZ + 5.1);
    const sign = w.textPlane(
      "DIVING · " + (side < 0 ? "WEST" : "EAST") + " STATION",
      5.2,
      0.5,
      "#23415e",
      "#ffffff",
      0,
      0.95,
      z,
      w.scene,
      44,
    );
    sign.rotation.y = side < 0 ? 0 : Math.PI;
  }
}

// The LOW springboard: a long fibreglass board on a fulcrum stand, bending when a diver bounces on it (`w.springboards`: the view
// sets each one's bend), its stand painted green with its height.
function springboard(ctx, b) {
  const { w, live } = ctx,
    H = HEIGHTS[b.h],
    s = b.side,
    len = Math.abs(b.topZ - b.tipZ) + 0.2;
  // The stand under the back of the board and the fulcrum roller.
  const standZ = (b.topZ + b.backZ) / 2;
  w.box(1.0, H.y - 0.12, 1.4, CONCRETE, b.x, (H.y - 0.12) / 2, standZ, 0.08);
  w.box(1.02, 0.22, 1.42, MARKER[b.h], b.x, H.y - 0.32, standZ, 0.04);
  const fulcrumZ = b.backZ - s * 0.2;
  w.cyl(0.07, 0.07, 0.62, 0x9aa5a8, b.x, H.y - 0.06, fulcrumZ).rotation.z = Math.PI / 2;
  const label = w.textPlane(
    H.metres + " m",
    0.6,
    0.2,
    "#46b553",
    "#ffffff",
    b.x,
    H.y - 0.32,
    standZ - s * 0.72,
    w.scene,
    70,
  );
  label.rotation.y = s < 0 ? Math.PI : 0;
  // The board itself, pivoting at its back end (in a live group, so it can bend).
  const pivot = new THREE.Group();
  pivot.position.set(b.x, H.y, b.topZ);
  live.add(pivot);
  const plank = new THREE.Group();
  pivot.add(plank);
  w.box(0.52, 0.07, len, 0xf7f8f4, 0, 0, (-s * len) / 2, 0.03, plank);
  w.box(0.46, 0.012, len - 0.3, 0x2f6fa8, 0, 0.04, (-s * (len - 0.1)) / 2, 0.004, plank);
  w.box(0.53, 0.075, 0.18, MARKER[b.h], 0, 0, -s * (len - 0.09), 0.02, plank);
  w.springboards.push({ board: b, pivot, len });
  // Side rails up the stand's top.
  for (const x of [-0.5, 0.5])
    w.rod([b.x + x, H.y + 0.9, b.topZ], [b.x + x, H.y + 0.9, b.backZ + s * 0.3], 0.03, RAIL);
}

// A rigid platform: a white slab on columns (the HIGH one on a concrete tower), its front painted in its colour with its height,
// railings on its sides and back.
function platform(ctx, b) {
  const { w } = ctx,
    H = HEIGHTS[b.h],
    s = b.side,
    width = b.h === 2 ? 1.7 : 1.5,
    z0 = b.tipZ,
    z1 = b.topZ + s * 0.25,
    len = Math.abs(z1 - z0),
    mid = (z0 + z1) / 2;
  // The slab, its non-slip top, its front in the height's colour.
  w.box(width, 0.28, len, CONCRETE, b.x, H.y - 0.14, mid, 0.05);
  w.box(width - 0.12, 0.015, len - 0.12, 0xbfc7c4, b.x, H.y + 0.008, mid, 0.004);
  w.box(width + 0.02, 0.3, 0.06, MARKER[b.h], b.x, H.y - 0.14, z0 - s * 0.01, 0.02);
  const label = w.textPlane(
    H.metres + " m",
    0.9,
    0.26,
    H.color,
    b.h === 1 ? "#3a2f00" : "#ffffff",
    b.x,
    H.y - 0.14,
    z0 - s * 0.05,
    w.scene,
    70,
  );
  label.rotation.y = s < 0 ? Math.PI : 0;
  // Its columns, out of the deck behind the coping (the HIGH one a tower of two pairs, braced).
  const back = b.backZ + s * 0.2;
  const colZ = b.h === 2 ? [back, back + s * 1.2] : [back + s * 0.3];
  for (const z of colZ)
    for (const x of [-width / 2 + 0.18, width / 2 - 0.18])
      w.box(0.3, H.y, 0.3, CONCRETE_DARK, b.x + x, H.y / 2, z, 0.04);
  if (b.h === 2) {
    // The tower's bracing and a mid landing, and a red band round its top.
    for (const y of [2.0, 4.0])
      w.box(
        width,
        0.18,
        Math.abs(colZ[1] - colZ[0]) + 0.3,
        CONCRETE_DARK,
        b.x,
        y,
        (colZ[0] + colZ[1]) / 2,
        0.03,
      );
    w.box(width + 0.04, 0.12, len + 0.04, MARKER[b.h], b.x, H.y - 0.33, mid, 0.02);
  }
  // Railings on both sides and across the back.
  for (const x of [-width / 2 + 0.05, width / 2 - 0.05]) {
    w.rod([b.x + x, H.y + 1.0, z1], [b.x + x, H.y + 1.0, z0 + s * 0.55], 0.035, RAIL);
    w.rod([b.x + x, H.y + 0.5, z1], [b.x + x, H.y + 0.5, z0 + s * 0.55], 0.025, RAIL);
    for (const z of [z1, z0 + s * 0.55]) w.rod([b.x + x, H.y, z], [b.x + x, H.y + 1.0, z], 0.03, RAIL);
  }
}

// The stairs up to a board: a flight of treads from the deck behind the station to its top, with a handrail each side (the HIGH
// one steep, nearly a ladder).
function stairs(ctx, b) {
  const { w } = ctx,
    H = HEIGHTS[b.h],
    s = b.side,
    steps = Math.max(4, Math.round(H.y / 0.25)),
    run = b.footZ - b.topZ,
    width = 0.75;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps,
      y = H.y * ((i + 1) / steps),
      z = b.footZ - run * t;
    w.box(width, 0.06, Math.abs(run) / steps + 0.08, i % 2 ? 0xe2ddd2 : 0xeae6dc, b.x, y - 0.03, z, 0.01);
  }
  // Stringers and handrails.
  for (const x of [-width / 2 - 0.04, width / 2 + 0.04]) {
    w.rod([b.x + x, 0.05, b.footZ], [b.x + x, H.y, b.topZ], 0.045, CONCRETE_DARK);
    w.rod([b.x + x, 0.95, b.footZ + s * 0.05], [b.x + x, H.y + 0.95, b.topZ], 0.03, RAIL);
    w.rod([b.x + x, 0, b.footZ], [b.x + x, 0.95, b.footZ + s * 0.05], 0.03, RAIL);
  }
}

// At the foot of each board's stairs: its line's places on the deck (painted feet in its colour) and its sign.
function lineMarks(ctx, b) {
  const { w } = ctx,
    H = HEIGHTS[b.h];
  for (const [k, spot] of b.line.entries()) {
    const mark = new THREE.Mesh(
      new THREE.CircleGeometry(0.26, 20),
      new THREE.MeshStandardMaterial({
        color: MARKER[b.h],
        roughness: 0.7,
        transparent: true,
        opacity: k < 3 ? 0.55 : 0.25,
      }),
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(spot.x, 0.004, spot.z);
    w.scene.add(mark);
  }
  // A post with the height's sign, beside the foot of its stairs.
  const post = { x: b.x + 0.62, z: b.footZ + b.side * 0.25 };
  w.cyl(0.05, 0.05, 1.9, 0xf7f7f2, post.x, 0.95, post.z);
  const sign = w.textPlane(
    H.name,
    0.7,
    0.34,
    H.color,
    b.h === 1 ? "#3a2f00" : "#ffffff",
    post.x,
    1.75,
    post.z,
    w.scene,
    64,
  );
  sign.rotation.y = Math.PI / 2;
  const sub = w.textPlane(
    String(b.h + 1),
    0.34,
    0.3,
    "#ffffff",
    "#23415e",
    post.x,
    1.38,
    post.z,
    w.scene,
    64,
  );
  sub.rotation.y = Math.PI / 2;
}

// ---- the hot tub --------------------------------------------------------------------------------------------------------

function hotTub(ctx) {
  const { w, live } = ctx,
    r = TUB.r,
    rim = TUB.rim,
    H = TUB_TOP,
    deck = TUB.deck || 0;
  // A raised tub (the paving runs on under it): a teak cabinet, an octagon round a round bowl, its top a step up from the deck.
  const outer = r + rim + deck,
    shape = new THREE.Shape();
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * TAU + Math.PI / 8;
    shape[k ? "lineTo" : "moveTo"](Math.cos(a) * outer, Math.sin(a) * outer);
  }
  const bowl = new THREE.Path();
  bowl.absarc(0, 0, r, 0, TAU, true);
  shape.holes.push(bowl);
  const cabinet = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false, curveSegments: 40 }),
    w.mat(TEAK, { roughness: 0.7 }),
  );
  cabinet.rotation.x = -Math.PI / 2;
  cabinet.position.set(TUB.x, 0, TUB.z);
  cabinet.castShadow = cabinet.receiveShadow = true;
  w.scene.add(cabinet);
  // Dark battens up its sides.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU,
      R = outer * Math.cos(Math.PI / 8) + 0.01;
    w.box(
      0.08,
      H - 0.04,
      0.05,
      TEAK_DARK,
      TUB.x + Math.cos(a) * R,
      H / 2,
      TUB.z - Math.sin(a) * R,
      0.01,
    ).rotation.y = a + Math.PI / 2;
  }
  const coping = new THREE.Mesh(
    new THREE.TorusGeometry(r + rim / 2, rim / 2, 10, 48),
    w.mat(0xeee6d6, { roughness: 0.5 }),
  );
  coping.rotation.x = Math.PI / 2;
  coping.position.set(TUB.x, H + 0.02, TUB.z);
  w.scene.add(coping);
  // The bowl: turquoise, its seat ledge, its floor just above the deck.
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r - 0.12, H, 40, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x4fc3d6, roughness: 0.3, side: THREE.BackSide }),
  );
  shell.position.set(TUB.x, H / 2, TUB.z);
  w.scene.add(shell);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(r - 0.12, 40), w.mat(0x3fb0c6, { roughness: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(TUB.x, 0.01, TUB.z);
  w.scene.add(floor);
  const ledge = new THREE.Mesh(
    new THREE.TorusGeometry(r - 0.22, 0.18, 8, 40),
    w.mat(0x6fd3e0, { roughness: 0.35 }),
  );
  ledge.rotation.x = Math.PI / 2;
  ledge.position.set(TUB.x, 0.2, TUB.z);
  w.scene.add(ledge);
  // The steps up to its rim on the pool side, and a rail.
  const st = tubSteps(),
    dx = st.water.x - st.deck.x,
    dz = st.water.z - st.deck.z,
    len = Math.hypot(dx, dz),
    ux = dx / len,
    uz = dz / len,
    edge = { x: TUB.x - ux * outer, z: TUB.z - uz * outer };
  for (let i = 0; i < 2; i++) {
    const h = (H * (i + 1)) / 3,
      back = 0.62 - i * 0.3;
    w.box(0.32, h, 1.0, TEAK, edge.x - ux * back, h / 2, edge.z - uz * back, 0.02).rotation.y = Math.atan2(
      ux,
      uz,
    );
  }
  w.rod(
    [edge.x - ux * 0.75 + uz * 0.6, 0, edge.z - uz * 0.75 - ux * 0.6],
    [edge.x - ux * 0.75 + uz * 0.6, 0.95, edge.z - uz * 0.75 - ux * 0.6],
    0.03,
    RAIL,
  );
  w.rod(
    [edge.x - ux * 0.75 + uz * 0.6, 0.95, edge.z - uz * 0.75 - ux * 0.6],
    [edge.x + uz * 0.6, H + 0.75, edge.z - ux * 0.6],
    0.03,
    RAIL,
  );
  // The water: a glowing turquoise disc that clouds over with a mess (the view's), bubbling.
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x7fe3ee,
    roughness: 0.08,
    transmission: 0,
    transparent: true,
    opacity: 0.82,
    emissive: 0x1aa6c4,
    emissiveIntensity: 0.25,
    clearcoat: 1,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(r + 0.01, 48), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(TUB.x, TUB_WATER_Y, TUB.z);
  water.renderOrder = 2;
  live.add(water);
  w.tubWater = water;
  // A soft glow in the water, and a little light over it.
  const light = new THREE.PointLight(0x8ff2ff, 0.6, 5, 2);
  light.position.set(TUB.x, H + 0.3, TUB.z);
  live.add(light);
  w.tubLight = light;
  // (The floaters and the wee cloud of a soiled tub sit on its water, not the deck's: scene.mjs syncSanitation.)
  w.floatY = TUB_WATER_Y - 0.01;
}

// ---- the massage corner --------------------------------------------------------------------------------------------------

function spaCorner(ctx) {
  const { w } = ctx,
    beds = [...MASSAGE_BEDS].sort((a, b) => a.x - b.x),
    outer = beds[0], // (the bed by the hedge)
    cx = (beds[0].x + beds[beds.length - 1].x) / 2,
    cz = MASSAGE_BEDS[0].z;
  // Warm non-slip tiles under both beds. (Open to the sky: it is on the camera's side, so no pergola hides the beds.)
  const tiles = mosaicTexture({ seed: 61, base: "#d39a6a", grout: "#e7c39a" });
  tiles.repeat.set(5, 4);
  w.textures.push(tiles);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 3.6),
    new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.8 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx - 0.3, 0.006, cz);
  floor.receiveShadow = true;
  w.scene.add(floor);
  // The equipment shelf against the hedge: folded towels, oils, a stack of stones, facing the pool.
  const shelf = w.group(outer.x - 1.35, 0, cz, w.scene, Math.PI / 2);
  for (const y of [0.25, 0.75, 1.25]) w.box(2.0, 0.05, 0.5, TEAK, 0, y, 0, 0.01, shelf);
  for (const x of [-0.95, 0.95]) w.box(0.06, 1.4, 0.5, TEAK_DARK, x, 0.7, 0, 0.01, shelf);
  const towel = [0xffffff, 0x8fd1c9, 0xf7e7c4];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++)
      w.box(0.38, 0.09, 0.32, towel[(i + j) % 3], -0.7 + i * 0.47, 0.32 + j * 0.095, 0, 0.03, shelf);
  for (let i = 0; i < 5; i++)
    w.cyl(0.05, 0.06, 0.2, i % 2 ? 0xd38a2c : 0x9bbf6a, -0.7 + i * 0.35, 0.88, 0, shelf, 10);
  for (let i = 0; i < 3; i++)
    w.ball(0.09 - i * 0.015, 0x3a3a3a, 0.6, 1.33 + i * 0.12, 0, shelf, [1.3, 0.6, 1.3]);
  // The relaxation sign: a low board on two posts at the corner's far end, turned to the camera.
  const sx = cx - 0.3,
    sz = cz + 2.05;
  for (const dx of [-1.05, 1.05]) w.box(0.08, 0.95, 0.08, 0xfbf8f1, sx + dx, 0.47, sz, 0.02);
  const sign = w.textPlane(
    "RELAX · MASSAGE",
    2.4,
    0.4,
    "#f6efdf",
    "#5f8f6a",
    sx,
    0.9,
    sz - 0.05,
    w.scene,
    46,
  );
  sign.rotation.y = Math.PI;
  sign.rotation.x = -0.35;
  // A plant in a big pot by the hedge, at the corner's far end.
  const g = propModel("potted-plant", { height: 1.3 }, (q) => {
    w.cyl(0.3, 0.24, 0.5, TERRACOTTA, 0, 0.25, 0, q);
    w.ball(0.5, 0x4f8f3c, 0, 0.85, 0, q);
  });
  g.position.set(outer.x - 1.3, 0, cz + 2.0);
  w.scene.add(g);
}

// ---- the garden and the clubhouse ---------------------------------------------------------------------------------------

function hedge(w, x0, z0, x1, z1, height = 1.25) {
  const len = Math.hypot(x1 - x0, z1 - z0),
    along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  w.box(
    along ? len : 0.8,
    height,
    along ? 0.8 : len,
    HEDGE,
    (x0 + x1) / 2,
    height / 2 - 0.02,
    (z0 + z1) / 2,
    0.3,
  );
}
function garden(ctx) {
  const { w, rand } = ctx,
    R = DIVE.room,
    gx = DIVE.gateX;
  // Hedges round the deck: along the near and far sides, and the two ends, with a gap for each gate.
  hedge(w, R.minX + 0.3, R.minZ + 0.3, R.minX + 0.3, R.maxZ - 0.3);
  hedge(w, R.maxX - 0.3, R.minZ + 0.3, R.maxX - 0.3, R.maxZ - 0.3);
  for (const s of [-1, 1]) {
    const z = s * (R.maxZ - 0.3);
    hedge(w, R.minX + 0.3, z, gx - 1.0, z);
    hedge(w, gx + 1.0, z, R.maxX - 0.3, z);
  }
  // Flower beds in front of the hedges: pink, red, yellow and white blooms.
  const blooms = [0xf06292, 0xe53935, 0xffd54f, 0xffffff, 0xba68c8];
  const bed = (x, z, nx, nz) => {
    for (let k = 0; k < 9; k++)
      w.ball(
        0.12 + rand() * 0.06,
        blooms[Math.floor(rand() * blooms.length)],
        x + (rand() - 0.5) * nx,
        0.28,
        z + (rand() - 0.5) * nz,
      );
    w.box(nx, 0.2, nz, 0x6b4a32, x, 0.06, z, 0.04);
  };
  for (let z = -12; z <= 12; z += 4) bed(R.maxX - 1.05, z + 2, 0.5, 2.6);
  // Trees beyond the hedges: rounded broadleaf trees and a few tall cypresses.
  const tree = (x, z, s = 1) => {
    w.cyl(0.18 * s, 0.26 * s, 2.4 * s, 0x6b4a32, x, 1.2 * s - 0.6, z);
    const leaf = w.mat([0x3d7d36, 0x4c8f3e, 0x2f6a2c][Math.floor(rand() * 3)], { roughness: 0.9 });
    for (let k = 0; k < 4; k++)
      w.ball(
        1.0 * s + rand() * 0.4 * s,
        leaf,
        x + (rand() - 0.5) * 1.2 * s,
        2.6 * s + rand() * 0.9 * s - 0.6,
        z + (rand() - 0.5) * 1.2 * s,
      );
  };
  const cypress = (x, z, s = 1) => {
    const g = new THREE.Mesh(
      new THREE.ConeGeometry(0.7 * s, 5.5 * s, 10),
      w.mat(0x2b5a2e, { roughness: 0.9 }),
    );
    g.position.set(x, 2.75 * s - 0.6, z);
    g.castShadow = true;
    w.scene.add(g);
  };
  for (let z = R.minZ - 3; z <= R.maxZ + 3; z += 5.2) {
    tree(R.minX - 4.5 - rand() * 3, z + rand() * 2, 1 + rand() * 0.3);
    if (Math.abs(z) > 4) cypress(R.maxX + 2.0, z + 1.3, 1 + rand() * 0.2);
  }
  for (let x = R.minX - 2; x <= R.maxX + 2; x += 5.5)
    for (const s of [-1, 1]) {
      if (Math.abs(x - gx) < 3) continue;
      tree(x + rand() * 2, s * (R.maxZ + 4 + rand() * 4), 1.1 + rand() * 0.4);
    }
  // Sun loungers and parasols on the lawns behind the stations.
  for (const s of [-1, 1])
    for (const x of [5.4, 8.4, 11.2]) {
      const g = propModel("sunbed", { size: 2 }, (q) => w.box(0.7, 0.35, 1.9, 0xffffff, 0, 0.2, 0, 0.05, q));
      g.position.set(x, 0, s * (DIVE.halfZ + 5.2));
      g.rotation.y = s < 0 ? 0 : Math.PI;
      w.scene.add(g);
    }
  for (const s of [-1, 1]) {
    const p = propModel("parasol", { height: 2.6 }, (q) => {
      w.cyl(0.04, 0.04, 2.4, 0xf7f7f2, 0, 1.2, 0, q);
      q.add(stripedCone(w, 1.4, 0.6, 10, 0x23415e, 0xffffff));
      q.children[q.children.length - 1].position.y = 2.4;
    });
    p.position.set(6.9, 0, s * (DIVE.halfZ + 6.1));
    w.scene.add(p);
  }
}

function clubhouse(ctx) {
  const { w } = ctx,
    x0 = DIVE.room.maxX + 5.5,
    width = 30,
    depth = 9,
    height = 7.5;
  const g = w.group(x0 + depth / 2, -0.6, 0, w.scene);
  // The body, white with a terracotta roof and a deep cornice.
  w.box(depth, height, width, CREAM, 0, height / 2, 0, 0.1, g);
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, depth * 0.72, 3.2, 4, 1),
    w.mat(TERRACOTTA, { roughness: 0.8 }),
  );
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, (width / depth) * 0.98);
  roof.position.set(0, height + 1.55, 0);
  g.add(roof);
  w.box(depth + 0.6, 0.4, width + 0.6, 0xe9dfca, 0, height, 0, 0.06, g);
  // A colonnade along its front: columns and a porch roof.
  for (let k = 0; k < 11; k++) {
    const z = -width / 2 + 1.5 + k * ((width - 3) / 10);
    w.cyl(0.32, 0.36, 4.4, 0xfbf8f1, -depth / 2 - 1.6, 2.2, z, g, 14);
  }
  w.box(2.4, 0.4, width, 0xfbf8f1, -depth / 2 - 1.4, 4.5, 0, 0.06, g);
  // Windows and green shutters; a big clock over the door.
  for (let k = 0; k < 9; k++) {
    const z = -width / 2 + 2.5 + k * ((width - 5) / 8);
    for (const y of [2.0, 5.6]) {
      w.box(0.08, 1.5, 0.95, 0x9ccbe0, -depth / 2 - 0.02, y, z, 0.02, g);
      for (const d of [-0.62, 0.62]) w.box(0.1, 1.5, 0.3, 0x2f6b4a, -depth / 2 - 0.05, y, z + d, 0.02, g);
    }
  }
  const name = w.textPlane(
    "THE COUNTRY CLUB",
    7,
    0.8,
    "#f6efdf",
    "#23415e",
    -depth / 2 - 0.08,
    6.75,
    0,
    g,
    54,
  );
  name.rotation.y = -Math.PI / 2;
  // Striped awnings and a flag on the roof.
  for (const z of [-9, 9]) {
    const a = w.box(1.6, 0.08, 4.5, 0x2f6b4a, -depth / 2 - 0.8, 3.2, z, 0.02, g);
    a.rotation.z = -0.35;
  }
  w.cyl(0.06, 0.06, 4, 0xf7f7f2, 0, height + 4.5, 0, g);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.1),
    new THREE.MeshStandardMaterial({ color: NAVY, side: THREE.DoubleSide }),
  );
  flag.position.set(0, height + 6.0, 0.9);
  flag.rotation.y = Math.PI / 2;
  g.add(flag);
  w.flags.push(flag);
}

// The two garden gates in the end hedges, at the near corners: white picket leaves that swing open as a guest comes or goes
// (`world.lockerDoors`, as the locker doors do), an arch of roses over each.
function gates(ctx) {
  const { w } = ctx,
    gx = DIVE.gateX,
    z0 = DIVE.room.maxZ - 0.3;
  for (const side of [-1, 1]) {
    const z = side * z0;
    for (const dx of [-0.95, 0.95]) {
      w.box(0.2, 2.4, 0.2, 0xfbf8f1, gx + dx, 1.2, z, 0.03);
      w.ball(0.13, 0xfbf8f1, gx + dx, 2.5, z);
    }
    // The arch, with roses on it.
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 8, 24, Math.PI), w.mat(0xfbf8f1));
    arch.position.set(gx, 2.4, z);
    w.scene.add(arch);
    const rand = rngOf(side > 0 ? 5 : 9);
    for (let k = 0; k < 14; k++) {
      const a = rand() * Math.PI;
      w.ball(
        0.1,
        k % 3 ? 0xe53958 : 0x4f8f3c,
        gx + Math.cos(a) * 0.95,
        2.4 + Math.sin(a) * 0.95,
        z + (rand() - 0.5) * 0.15,
      );
    }
    const hinge = new THREE.Group();
    hinge.position.set(gx - 0.85, 0, z);
    w.scene.add(hinge);
    for (let i = 0; i < 5; i++) w.box(0.09, 1.05, 0.05, 0xffffff, 0.17 + i * 0.33, 0.6, 0, 0.02, hinge);
    for (const y of [0.35, 0.9]) w.box(1.65, 0.07, 0.05, 0xffffff, 0.85, y, 0, 0.02, hinge);
    w.lockerDoors.push({ side, hinge });
  }
}

// ---- the stations and the dressing ----------------------------------------------------------------------------------------

function dressing(ctx) {
  const { w, venue } = ctx;
  for (const f of venue.furniture) {
    if (f.kind === "bench") {
      const g = w.group(f.x, 0, f.z, w.scene, f.angle || 0);
      w.box(2.2, 0.08, 0.5, TEAK, 0, 0.45, 0, 0.02, g);
      w.box(2.2, 0.4, 0.06, TEAK, 0, 0.75, -0.22, 0.02, g);
      for (const x of [-0.9, 0.9]) w.box(0.08, 0.45, 0.45, 0x5a5f61, x, 0.22, 0, 0.01, g);
    } else if (f.kind === "towel-rack") {
      const g = propModel("towel-cart", { height: 1.2 }, (s) =>
        w.box(1.2, 1.0, 0.6, 0xc8b49a, 0, 0.5, 0, 0.04, s),
      );
      g.position.set(f.x, 0, f.z);
      g.rotation.y = Math.PI / 2;
      w.scene.add(g);
    } else if (f.kind === "lifeguard") lifeguardChair(w, f.x, f.z, f.x < 0 ? Math.PI / 2 : -Math.PI / 2);
    else if (f.kind === "planter") {
      const g = propModel("palm-planter", { height: 2.0 }, (s) => {
        w.box(0.9, 0.6, 0.9, 0xf6efdf, 0, 0.3, 0, 0.06, s);
        w.ball(0.6, 0x4f8f3c, 0, 1.2, 0, s);
      });
      g.position.set(f.x, 0, f.z);
      w.scene.add(g);
    }
  }
  // (each faces the pool from its own side's hedge)
  const facing = (at) => (at.x < 0 ? Math.PI / 2 : -Math.PI / 2);
  station(w, "chlorine", venue.stations.chlorine, 0x8fc4cf, "HOT TUB CARE", facing(venue.stations.chlorine));
  station(w, "relief", venue.stations.relief, 0xcfe0e8, "EYE CARE", facing(venue.stations.relief));
  sanitationCorner(w, venue);
  rescueStations(w, venue);
  fishNetHook(w, venue.fixtures.fishNet);
  flashlightHolder(w, venue.fixtures.flashlight);
  fuseBox(w, venue.fixtures.fuseBox);
  treatsTable(w, venue.fixtures.treats);
}

// ---- what the coach clicks -----------------------------------------------------------------------------------------------

// Each height: an invisible box round both of its boards to click (that height, 1 to 3), a highlight on both platforms and a rim
// line round them for the guidance; the hot tub: a disc (4). scene.mjs drives them as `springHighlights` and `springRims`.
function pickVolumes(ctx) {
  const { w } = ctx;
  w.springHighlights = [];
  w.springRims = [];
  for (const H of HEIGHTS) {
    const boards = BOARDS.filter((b) => b.h === H.id),
      plates = [],
      lines = [];
    for (const b of boards) {
      const z0 = b.tipZ,
        z1 = b.topZ,
        mid = (z0 + z1) / 2,
        len = Math.abs(z1 - z0),
        width = H.id === 0 ? 0.7 : 1.6;
      const pick = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.6, H.y + 1.6, len + 3.2),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      pick.position.set(b.x, (H.y + 1.6) / 2, mid + b.side * 1.2);
      pick.userData = { kind: "lane", lane: H.id };
      w.scene.add(pick);
      w.clickables.push(pick);
      const plate = new THREE.PlaneGeometry(width + 0.2, len + 0.2);
      plate.rotateX(-Math.PI / 2);
      plate.translate(b.x, H.y + 0.06, mid);
      plates.push(plate);
      const y = H.y + 0.08,
        hx = width / 2 + 0.12,
        hz = len / 2 + 0.12;
      for (const [a, c] of [
        [
          [-hx, -hz],
          [hx, -hz],
        ],
        [
          [hx, -hz],
          [hx, hz],
        ],
        [
          [hx, hz],
          [-hx, hz],
        ],
        [
          [-hx, hz],
          [-hx, -hz],
        ],
      ])
        lines.push(
          new THREE.Vector3(b.x + a[0], y, mid + a[1]),
          new THREE.Vector3(b.x + c[0], y, mid + c[1]),
        );
    }
    const geo = mergePlanes(plates);
    const glow = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0xffe58b,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    glow.renderOrder = 3;
    w.scene.add(glow);
    w.springHighlights.push(glow);
    const rim = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(lines),
      new THREE.LineBasicMaterial({ color: 0xffdf52, transparent: true, opacity: 1, depthWrite: false }),
    );
    w.scene.add(rim);
    w.springRims.push(rim);
  }
  // The hot tub.
  const disc = new THREE.CircleGeometry(TUB.r + TUB.rim, 40);
  disc.rotateX(-Math.PI / 2);
  const pick = new THREE.Mesh(disc, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
  pick.position.set(TUB.x, TUB_WATER_Y + 0.05, TUB.z);
  pick.userData = { kind: "lane", lane: 3 };
  w.scene.add(pick);
  w.clickables.push(pick);
  const glow = new THREE.Mesh(
    disc,
    new THREE.MeshBasicMaterial({ color: 0xffe58b, transparent: true, opacity: 0, depthWrite: false }),
  );
  glow.position.set(TUB.x, TUB_WATER_Y + 0.03, TUB.z);
  glow.renderOrder = 3;
  w.scene.add(glow);
  w.springHighlights.push(glow);
  const pts = [];
  for (let k = 0; k <= 48; k++) {
    const a = (k / 48) * TAU;
    pts.push(
      new THREE.Vector3(TUB.x + Math.cos(a) * (TUB.r + 0.05), 0.08, TUB.z + Math.sin(a) * (TUB.r + 0.05)),
    );
  }
  const rim = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xffdf52, transparent: true, opacity: 1, depthWrite: false }),
  );
  w.scene.add(rim);
  w.springRims.push(rim);
}
// Two or more flat planes (already placed) into one geometry.
function mergePlanes(list) {
  const pos = [],
    idx = [];
  let base = 0;
  for (const g of list) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    const index = g.index ? Array.from(g.index.array) : [...Array(p.count).keys()];
    for (const i of index) idx.push(i + base);
    base += p.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
}
