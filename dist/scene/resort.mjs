// Splash Park (the resort venue): an open-air five-lane pool with cabanas, palms, a snack kiosk and a trampoline tower
// whose splash zone lands in the last lane. Same toy palette as the club, warmer and sunnier.
import { THREE, COLORS } from "./kit.mjs";
import { buildPool, buildDeck } from "./pool.mjs";
import { plasterTexture, grassTexture, glowTexture, mosaicTexture } from "./textures.mjs";
import { SCENERY } from "./sky.mjs";
import {
  bench,
  station,
  finRack,
  lockerBay,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  medkitCabinet,
  lifeguardTower,
  trampolineTower,
  kiosk,
  palm,
  lounger,
  umbrella,
  treatsObject,
  stationHit,
} from "./props.mjs";

export function buildResort(w, venue, lighting = "day") {
  buildDeck(w, venue, {
    base: "#d9b287",
    grout: "#a98661",
    pavers: true,
    slab: 0x3f9a8f,
    rim: 0xc49a6c,
    side: 0xd9b787,
  });
  buildPool(w, venue, w.look.water);
  poolSurround(w, venue);
  facade(w, venue);
  lockerBay(w, venue, -12, "CABANA A", 0x2f9aa0, "resort");
  lockerBay(w, venue, 12, "CABANA B", 0xe0513f, "resort");
  balustrades(w, venue);
  for (const f of venue.furniture) {
    if (f.kind === "bench") bench(w, f.x, f.z, f.angle);
    if (f.kind === "palm") palm(w, f.x, f.z, 4.4, f.x + f.z);
    if (f.kind === "lounger") lounger(w, f.x, f.z, f.angle || 0, f.x < -12 ? 0x2f9aa0 : 0xe0513f);
    if (f.kind === "umbrella") umbrella(w, f.x, f.z, 0xe0513f);
    if (f.kind === "lifeguard-tower") lifeguardTower(w, f.x, f.z);
    if (f.kind === "kiosk") kiosk(w, f.x, f.z);
  }
  // Towels and a beach ball add life to the deck.
  w.box(0.7, 0.06, 1.5, 0xf4c849, -11.4, 0.52, 10.1, 0.03);
  w.box(0.7, 0.06, 1.5, 0xfff4dc, -13.2, 0.52, 10.3, 0.03);
  const ball = w.group(-10.2, 0.34, 11.6);
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 12, 8, (i * Math.PI) / 3, Math.PI / 3),
      w.mat([0xe0513f, 0xfff4dc, 0x3593c1, 0xfff4dc, 0xf4c849, 0xfff4dc][i], { roughness: 0.4 }),
    );
    seg.castShadow = true;
    ball.add(seg);
  }
  commonStations(w, venue);
  lawn(w, venue);
  stringLights(w, venue, lighting === "night" || lighting === "sunset");
}

// The gear every resort-plan venue shares: fin rack, water and eye care, the cleanup corner, rescue and blackout kit,
// the trampoline, the snack jar for the loose dog, and the lane 5 warning painted on the deck. `tower` recolours the
// trampoline tower.
export function commonStations(w, venue, { tower } = {}) {
  finRack(w, venue.stations.fins);
  station(w, "chlorine", venue.stations.chlorine, COLORS.yellow, "WATER CARE", -Math.PI / 2);
  station(w, "relief", venue.stations.relief, 0xddf3d7, "EYE CARE", -Math.PI / 2);
  sanitationCorner(w, venue);
  rescueStations(w, venue);
  fishNetHook(w, venue.fixtures.fishNet);
  flashlightHolder(w, venue.fixtures.flashlight);
  fuseBox(w, venue.fixtures.fuseBox);
  medkitCabinet(w, venue.fixtures.medkit);
  trampolineTower(w, venue.trampoline, tower);
  kioskTreats(w, venue.fixtures.treats);
  w.textPlane(
    "NO DIVING · SPLASH ZONE LANE 5",
    5.2,
    0.42,
    "#f6ead2",
    "#c2412f",
    12.35,
    0.025,
    -9.4,
    w.scene,
    46,
  ).rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
}

// A band of blue-and-white mosaic frames the basin between the gutter and the walkway.
export function poolSurround(w, venue, { base = "#3f8fb5", grout = "#e9f2ec", seed = 41 } = {}) {
  const P = venue.pool,
    inner = 0.72,
    outer = 1.42;
  const shape = new THREE.Shape();
  shape.moveTo(-P.halfX - outer, -P.halfZ - outer);
  shape.lineTo(P.halfX + outer, -P.halfZ - outer);
  shape.lineTo(P.halfX + outer, P.halfZ + outer);
  shape.lineTo(-P.halfX - outer, P.halfZ + outer);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-P.halfX - inner, -P.halfZ - inner);
  hole.lineTo(-P.halfX - inner, P.halfZ + inner);
  hole.lineTo(P.halfX + inner, P.halfZ + inner);
  hole.lineTo(P.halfX + inner, -P.halfZ - inner);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position,
    uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2, pos.getZ(i) / 2);
  const tex = mosaicTexture({ seed, base, grout, tiles: 6 });
  w.textures.push(tex);
  const band = new THREE.Mesh(geo, w.mat(0xffffff, { map: tex, roughness: 0.45 }));
  band.position.y = -0.008;
  band.receiveShadow = true;
  w.scene.add(band);
}

function facade(w, venue) {
  const z0 = -16.35,
    room = venue.room,
    width = room.maxX - room.minX + 0.4,
    cx = (room.minX + room.maxX) / 2;
  const plaster = plasterTexture({ seed: 77, strength: 0.1 });
  plaster.repeat.set(9, 2);
  w.textures.push(plaster);
  w.box(width, 4.6, 0.45, w.mat(0xf6ecd8, { map: plaster, roughness: 0.9 }), cx, 2.2, z0, 0.12);
  // Terracotta roof tiles.
  for (let i = 0; i < Math.ceil(width / 0.55); i++) {
    const x = room.minX - 0.2 + i * 0.55 + 0.27;
    const tile = w.cyl(0.19, 0.19, 1.3, 0xc9643f, x, 4.72, z0 + 0.35, w.scene, 8);
    tile.rotation.x = Math.PI / 2 + 0.45;
  }
  w.box(width, 0.18, 1.1, 0xa94f33, cx, 4.52, z0 + 0.25, 0.05);
  // Arched windows with teal shutters.
  for (const x of [-7.2, -2.4, 2.4, 7.2]) {
    w.box(1.5, 1.7, 0.08, 0x9fd6e1, x, 2.75, z0 + 0.25, 0.2);
    w.box(1.66, 0.14, 0.2, 0xfff6ea, x, 1.84, z0 + 0.3, 0.03);
    for (const s of [-1, 1]) {
      const shutter = w.box(0.72, 1.7, 0.06, 0x2f9aa0, x + s * 1.15, 2.75, z0 + 0.3, 0.03);
      for (let k = 0; k < 6; k++)
        w.box(0.64, 0.035, 0.08, 0x267f86, x + s * 1.15, 2.1 + k * 0.26, z0 + 0.34, 0);
      shutter.castShadow = true;
    }
  }
  w.box(6.6, 1.05, 0.2, 0xfff6ea, 0, 3.85, z0 + 0.34, 0.12);
  w.textPlane("SPLASH PARK", 6.2, 0.62, "#fff6ea", "#2f9aa0", 0, 3.95, z0 + 0.45, w.scene, 84);
  w.textPlane("SUN · SEA · SPLASH", 4.6, 0.24, "#fff6ea", "#e0513f", 0, 3.5, z0 + 0.46, w.scene, 32);
  // Bougainvillea planters along the facade.
  for (const x of [-15.2, -5.6, 5.6, 15.4]) {
    w.box(1.4, 0.55, 0.6, 0xd9906a, x, 0.28, z0 + 0.6, 0.1);
    for (let k = 0; k < 5; k++)
      w.ball(
        0.28,
        k % 2 ? 0xe45c8b : 0x5f9e57,
        x - 0.5 + k * 0.25,
        0.72 + (k % 2) * 0.12,
        z0 + 0.6,
        w.scene,
        [1, 0.8, 0.9],
      );
  }
}

// Low stucco walls with glass balustrades on the long sides and hedges on the open end.
function balustrades(w, venue) {
  const d = venue.deck,
    room = venue.room;
  const glass = new THREE.MeshStandardMaterial({
    color: 0xcdeef2,
    transparent: true,
    opacity: 0.28,
    roughness: 0.05,
    metalness: 0.1,
  });
  for (const x of [d.minX - 0.5, d.maxX + 0.45]) {
    const length = room.maxZ - room.minZ - 1.8,
      cz = (room.maxZ + room.minZ) / 2 + 0.6;
    w.box(0.34, 0.55, length, 0xf1e4c8, x, 0.28, cz, 0.08);
    w.box(0.46, 0.1, length, 0xd6a45c, x, 0.58, cz, 0.03);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, length), glass);
    pane.position.set(x, 1.02, cz);
    w.scene.add(pane);
    w.box(0.1, 0.07, length, 0xf4f1e2, x, 1.44, cz, 0.02);
  }
  for (let x = room.minX + 0.6; x < room.maxX - 0.4; x += 1.1) {
    w.ball(0.55, x % 2.2 < 1.1 ? 0x5f9e57 : 0x6fae5f, x, 0.45, room.maxZ - 0.35, w.scene, [1.1, 0.85, 0.8]);
  }
}

export function kioskTreats(w, p) {
  const jar = treatsObject(w);
  jar.position.set(p.x + 0.55, 1.45, p.z);
  jar.rotation.y = -Math.PI / 2;
  w.scene.add(jar);
  stationHit(w, { kind: "fixture", item: "treats" }, p, 1.4, 1.8);
  w.labels.push({
    text: "E · DOG TREATS",
    x: p.x,
    y: 2.4,
    z: p.z,
    when: (s) => !!s.dog && s.dog.stage !== "gone",
  });
}

function lawn(w, venue) {
  const grass = grassTexture();
  // The ground runs out to the horizon; on a coast it stops at the beach, where the Sky's sand and sea begin.
  const shore = SCENERY[venue.scenery]?.sea ? SCENERY[venue.scenery].shoreX + 3.4 : -300,
    width = 300 - shore;
  grass.repeat.set(width / 4, 150);
  w.textures.push(grass);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 600),
    new THREE.MeshStandardMaterial({ map: grass, color: 0xb9d98f, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((shore + 300) / 2, -1.95, 0);
  floor.receiveShadow = true;
  w.scene.add(floor);
  // Distant palms frame the tabletop.
  const room = venue.room;
  for (const [x, z, s] of [
    [room.minX - 3, -8, 1.1],
    [room.minX - 4.5, 6, 1.25],
    [room.maxX + 3.5, -2, 1.15],
    [room.maxX + 3, 9, 1.3],
    [-8, room.maxZ + 4, 1.2],
    [9, room.maxZ + 4.5, 1.1],
  ]) {
    const g = palm(w, x, z, 4.6 * s, x * z);
    g.position.y = -1.95;
  }
}

export function stringLights(w, venue, on) {
  const d = venue.deck;
  const bulbs = new THREE.Group();
  bulbs.name = "string-lights";
  const glow = glowTexture(64);
  w.textures.push(glow);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
  const halo = new THREE.SpriteMaterial({
    map: glow,
    color: 0xffd27a,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  for (const x of [d.minX - 0.5, d.maxX + 0.45]) {
    for (let i = 0; i <= 12; i++) {
      const z = d.minZ + 2 + i * ((d.maxZ - d.minZ - 3) / 12);
      const sag = 2.3 - Math.sin((i % 3) * (Math.PI / 3)) * 0.18;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bulbMat);
      bulb.position.set(x, sag, z);
      bulbs.add(bulb);
      const s = new THREE.Sprite(halo);
      s.position.copy(bulb.position);
      s.scale.setScalar(0.7);
      bulbs.add(s);
    }
    for (let i = 0; i < 4; i++)
      w.cyl(0.04, 0.04, 2.4, 0xf4f1e2, x, 1.2, d.minZ + 2 + i * ((d.maxZ - d.minZ - 3) / 3), w.scene, 6);
  }
  bulbs.visible = on;
  w.scene.add(bulbs);
  w.stringLights = bulbs;
}
