// Senior Aqua Fit (16 October 2026, the creator: "impress me with this new premium environment… improve lighting, textures and 3D
// models"): a Victorian glass conservatory built round the pool, the first venue dressed with photographs and models rather than
// painted canvases. A travertine deck (assets/senior/travertine.jpg) round an art-deco fan mosaic pool (mosaic.jpg) with a marble
// coping, a frieze at the waterline and brass ladders; white cast-iron glazing on the far side and the far end with the garden
// beyond it (garden.jpg, a panorama for the Coach Cam, and beds of roses, lavender and box hedges right outside the glass for the
// overview); a cream stucco wall at the back with tall brass-and-glass doors (they open as a guest comes or goes, like the locker
// doors elsewhere: there are no lockers here) under an emerald-and-gold sign (sign.jpg). The waiting lounge is two Persian rugs
// (rug.jpg) either side of an emerald runner from the doors. A hydrotherapy spa that bubbles and steams, a pool hoist, a tea
// trolley (the loose dog's biscuits), a gramophone that floats a note now and then, a reading corner of cane armchairs and a brass
// lamp, loungers and monstera plants (Tripo models, props/*.glb, with stand-ins until they load). Golden late-afternoon sun comes
// in low through the far end's glass: its mullions and the roof's ribs (an unseen grid that only casts shadows) lay a window
// pattern across the deck, and slanting shafts of light with dust in them hang in the air. The glass roof itself, its ribs, cresting
// and brass pendant lamps are for the Coach Cam only (like every indoor hall). Nothing here moves gameplay: the bubbles, the steam,
// the notes and the motes are the picture's alone.
import { THREE } from "./kit.mjs";
import { buildPool, buildDeck } from "./pool.mjs";
import { mosaicTexture, plasterTexture, grassTexture, beamTexture } from "./textures.mjs";
import { rngOf, mergeGeos } from "./geom.mjs";
import {
  finRack,
  station,
  stationHit,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  treatsObject,
  woodMaterial,
} from "./props.mjs";
import { propModel } from "./prop-models.mjs";

const FLOOR = -1.95;
const EMERALD = 0x1f5c4a,
  DEEP = 0x143d33,
  BRASS = 0xc9a14a,
  CREAM = 0xf3ead8,
  IRON = 0xf7f4ec,
  STUCCO = 0xeee2cc,
  TERRACOTTA = 0xc8774f;
// The conservatory's lines: walls just outside the deck, the roof's eave and ridge (Coach Cam only), the sun's direction.
const WALL = { near: -15.1, far: 15.1, back: -16.0, end: 13.4 };
const ROOF = { eave: 5.2, ridge: 9.4 };
export const SUN = new THREE.Vector3(-6, 15, 21).normalize();

// A photograph from assets/senior, drawn into `texture` (a painted stand-in the material already holds) once it has loaded, so the
// scene is never waiting on it and a headless build keeps the stand-in. One request per file, shared by every texture that wants it.
const pictures = new Map();
function photo(texture, file, { repeat = [1, 1], wrap = THREE.RepeatWrapping, then } = {}) {
  if (typeof Image !== "function") return texture;
  if (!pictures.has(file))
    pictures.set(
      file,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = new URL("../assets/senior/" + file, import.meta.url).href;
      }).catch((error) => {
        console.warn("The picture " + file + " did not load; its stand-in stays.", error);
        pictures.delete(file);
        return null;
      }),
    );
  pictures.get(file).then((image) => {
    if (!image) return;
    texture.image = image;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = wrap;
    texture.repeat.set(...repeat);
    texture.needsUpdate = true;
    then?.(texture);
  });
  return texture;
}
// A one-colour stand-in for a photograph.
function swatch(w, color) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 4;
  const c = canvas.getContext("2d");
  c.fillStyle = color;
  c.fillRect(0, 0, 4, 4);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  w.textures.push(t);
  return t;
}
// Everything that glows (lamps, the spa, the sun's shafts) fades with the lights in a blackout.
const glowing = (ctx, material, key = "opacity") => {
  const base = key === "opacity" ? material.opacity : material[key];
  ctx.glows.push((f) => (material[key] = base * f));
  return material;
};
const live = (w, object) => {
  (w.liveProps ||= []).push(object); // (a model's stand-in gives way when it loads: never baked into a batch)
  return object;
};

export function buildSenior(w, venue) {
  const ctx = { w, venue, rand: rngOf(1926), ivy: [], columns: new Set(), glows: [] };
  deck(ctx);
  pool(ctx);
  outside(ctx);
  glazing(ctx);
  backWall(ctx);
  nearWall(ctx);
  lounge(ctx);
  for (const f of venue.furniture) {
    if (f.kind === "bench") gardenBench(ctx, f);
    if (f.kind === "spa") spa(ctx, f);
    if (f.kind === "hoist") hoist(ctx, f);
    if (f.kind === "trolley") teaTrolley(ctx, f);
    if (f.kind === "gramophone") gramophone(ctx, f);
    if (f.kind === "armchair") armchair(ctx, f);
    if (f.kind === "lounger") lounger(ctx, f);
    if (f.kind === "plant") monstera(ctx, f);
  }
  readingLamp(ctx);
  finRack(w, venue.stations.fins);
  station(w, "chlorine", venue.stations.chlorine, 0x2f6b55, "WATER CARE", -Math.PI / 2);
  station(w, "relief", venue.stations.relief, 0xe9e1cf, "EYE CARE", -Math.PI / 2);
  sanitationCorner(w, venue);
  rescueStations(w, venue);
  fishNetHook(w, venue.fixtures.fishNet);
  flashlightHolder(w, venue.fixtures.flashlight);
  fuseBox(w, venue.fixtures.fuseBox);
  ivy(ctx);
  roof(ctx);
  sunlight(ctx);
  w.dimmers.push((k) => {
    const f = Math.min(1, Math.max(0, k));
    for (const dim of ctx.glows) dim(f);
  });
}

// ---------------------------------------------------------------------------------------------------------------------------
// The deck: travertine in metre slabs, an emerald-and-gold frieze round the pool, a brass strip at its edge.
function deck(ctx) {
  const { w, venue } = ctx;
  const top = buildDeck(w, venue, {
    base: "#e6dac2",
    grout: "#cbb895",
    slab: DEEP,
    rim: BRASS,
    side: 0xe7dcc6,
    openBasin: true,
  });
  top.material.color.set(0xffffff);
  photo(top.material.map, "travertine.jpg", {
    repeat: [1 / 3.4, 1 / 3.4],
    then: () => {
      top.material.bumpMap = null; // (the painted tiles' joints would not match the photograph's)
      top.material.roughness = 0.42;
      top.material.needsUpdate = true;
    },
  });
  // The frieze: the pool's own fan mosaic, small, in a band round the coping, edged in brass.
  const P = venue.pool,
    inner = 0.82,
    width = 0.42;
  const strip = (length, x, z, along) => {
    const t = mosaicTexture({ base: "#1f6f6a", grout: "#d8c58f", seed: 9, tiles: 4 });
    w.textures.push(t);
    photo(t, "mosaic.jpg", { repeat: [length / 1.1, 0.5] });
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(length, width),
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, envMapIntensity: 0.8 }),
    );
    m.rotation.set(-Math.PI / 2, 0, along ? Math.PI / 2 : 0);
    m.position.set(x, -0.012, z);
    m.receiveShadow = true;
    w.scene.add(m);
  };
  const ox = P.halfX + inner + width / 2,
    oz = P.halfZ + inner + width / 2,
    lx = ox * 2 + width,
    lz = oz * 2 - width;
  for (const s of [-1, 1]) {
    strip(lz, s * ox, 0, true);
    strip(lx, 0, s * oz, false);
  }
  const brass = w.mat(BRASS, { roughness: 0.28, metalness: 0.85 });
  for (const s of [-1, 1])
    for (const r of [-1, 1]) {
      w.box(0.04, 0.012, oz * 2 + width + 0.04, brass, s * (ox + (r * width) / 2), -0.006, 0, 0);
      w.box(ox * 2 + width + 0.04, 0.012, 0.04, brass, 0, -0.006, s * (oz + (r * width) / 2), 0);
    }
}

// The pool: the fan mosaic on the floor and the walls, marble coping, an emerald frieze at the waterline, brass ladders, and two
// marble steps across the near end with brass handrails (the seniors' way in).
function pool(ctx) {
  const { w, venue } = ctx,
    P = venue.pool;
  const floor = mosaicTexture({ base: "#2a9d9a", grout: "#eaf6f2", seed: 3 });
  floor.repeat.set((P.halfX * 2) / 2.4, (P.halfZ * 2) / 2.4);
  photo(floor, "mosaic.jpg", { repeat: [(P.halfX * 2) / 4.2, (P.halfZ * 2) / 4.9] });
  const walls = mosaicTexture({ base: "#23807e", grout: "#eaf6f2", seed: 17 });
  walls.repeat.set(8, 0.6);
  photo(walls, "mosaic.jpg", { repeat: [11, 0.65] });
  const marble = plasterTexture({ seed: 61, strength: 0.05 });
  marble.repeat.set(2, 2);
  buildPool(w, venue, w.look.water, {
    line: null,
    ropes: null,
    pennants: null,
    floorMap: floor,
    wallMap: walls,
    coping: { color: 0xf4efe6, map: marble, roughness: 0.22 },
    band: 0x17544a,
    ladders: { color: BRASS, metalness: 0.85, rung: 0xd8b25c },
  });
  // Marble steps along the near end, under the water, and a brass handrail at each side of the lanes' way in.
  const step = w.mat(0xf1ece2, { roughness: 0.25 });
  for (let i = 0; i < 2; i++)
    w.box(P.halfX * 2 - 0.1, 0.18, 0.5, step, 0, -0.62 - i * 0.32, -P.halfZ + 0.25 + i * 0.5, 0.03);
  const brass = w.mat(BRASS, { roughness: 0.22, metalness: 0.9 });
  for (const x of [-P.halfX + 0.35, P.halfX - 0.35]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 0.05, -P.halfZ - 0.55),
      new THREE.Vector3(x, 0.95, -P.halfZ - 0.35),
      new THREE.Vector3(x, 0.95, -P.halfZ + 0.35),
      new THREE.Vector3(x, -0.55, -P.halfZ + 1.1),
    ]);
    w.mesh(new THREE.TubeGeometry(curve, 24, 0.04, 8, false), brass);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// Outside the glass: a lawn, box hedges, roses and lavender close by (what the overview sees past the far wall), and the garden
// photograph all round at a distance (what the Coach Cam sees through the glass).
function outside(ctx) {
  const { w, venue, rand } = ctx,
    room = venue.room;
  const grass = grassTexture({ base: "#79a95a", seed: 33 });
  grass.repeat.set(120, 120);
  w.textures.push(grass);
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(480, 480),
    new THREE.MeshStandardMaterial({ map: grass, color: 0xc7dc9c, roughness: 1 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = FLOOR;
  lawn.receiveShadow = true;
  w.scene.add(lawn);
  // A gravel path round the conservatory.
  const gravel = w.mat(0xd9ccb0, { roughness: 1 });
  w.box(2.2, 0.06, room.maxZ - room.minZ + 6, gravel, room.maxX + 1.6, FLOOR + 0.03, -1.5, 0);
  w.box(room.maxX - room.minX + 5.4, 0.06, 2.2, gravel, 0, FLOOR + 0.03, room.maxZ + 1.6, 0);
  // Clipped box hedges, rose bushes in bloom and rows of lavender in the beds beyond the path.
  const hedge = w.mat(0x3f6b3a, { roughness: 0.95 });
  for (let z = room.minZ - 2; z < room.maxZ + 2; z += 2.6)
    w.box(1.1, 1.0, 2.4, hedge, room.maxX + 3.6, FLOOR + 0.5, z, 0.3);
  for (let x = room.minX - 1; x < room.maxX + 3; x += 2.6)
    w.box(2.4, 1.0, 1.1, hedge, x, FLOOR + 0.5, room.maxZ + 3.6, 0.3);
  const leaf = new THREE.SphereGeometry(1, 10, 8),
    bloom = new THREE.SphereGeometry(1, 8, 6),
    bushes = [],
    blooms = [],
    lavender = [];
  const bed = (x0, x1, z0, z1, n) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + rand() * (x1 - x0),
        z = z0 + rand() * (z1 - z0),
        s = 0.55 + rand() * 0.45;
      bushes.push([x, FLOOR + s * 0.7, z, s]);
      for (let k = 0; k < 7; k++) {
        const a = rand() * Math.PI * 2,
          up = rand() * 0.8;
        blooms.push([
          x + Math.cos(a) * s * 0.85,
          FLOOR + s * (0.75 + up * 0.6),
          z + Math.sin(a) * s * 0.85,
          0.09 + rand() * 0.05,
        ]);
      }
    }
    for (let i = 0; i < n * 3; i++)
      lavender.push([x0 + rand() * (x1 - x0), FLOOR + 0.3, z0 + rand() * (z1 - z0), 0.12 + rand() * 0.06]);
  };
  bed(room.maxX + 4.8, room.maxX + 9, room.minZ - 2, room.maxZ + 3, 22);
  bed(room.minX - 2, room.maxX + 3, room.maxZ + 4.8, room.maxZ + 9, 20);
  const dummy = new THREE.Object3D(),
    put = (geometry, material, list, shape = [1, 0.8, 1]) => {
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      list.forEach(([x, y, z, s], i) => {
        dummy.position.set(x, y, z);
        dummy.scale.set(s * shape[0], s * shape[1], s * shape[2]);
        dummy.rotation.y = i;
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      w.scene.add(mesh);
      return mesh;
    };
  put(leaf, w.mat(0x4f7f45, { roughness: 0.9 }), bushes);
  const roses = put(
    bloom,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    blooms,
    [1, 1, 1],
  );
  const palette = [0xf7a8b8, 0xfff2e6, 0xe2566e, 0xffd3a5, 0xf48fb1].map((c) => new THREE.Color(c));
  blooms.forEach((_, i) => roses.setColorAt(i, palette[i % palette.length]));
  roses.instanceColor.needsUpdate = true;
  put(
    new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6),
    w.mat(0x8c78c8, { roughness: 0.9 }),
    lavender,
    [1, 1, 1],
  );
  // The garden all round, far off: the photograph on a ring, unlit and out of the fog (it is the view, not the room).
  const garden = swatch(w, "#8fae6a");
  photo(garden, "garden.jpg", { repeat: [3, 1], wrap: THREE.MirroredRepeatWrapping });
  const radius = 46,
    height = 34;
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 72, 1, true),
    new THREE.MeshBasicMaterial({ map: garden, side: THREE.BackSide, fog: false }),
  );
  ring.position.set(2, FLOOR - 9 + height / 2, 0);
  ring.castShadow = ring.receiveShadow = false;
  w.scene.add(ring);
}

// ---------------------------------------------------------------------------------------------------------------------------
// The glass walls on the far side and the far end: a dwarf wall in cream brick with a brass cap, slender white cast-iron columns
// (fluted, with capitals) every bay, glass in iron glazing bars, a round-headed fanlight in every bay and hanging baskets of
// trailing flowers on the columns.
function glazing(ctx) {
  const { w, venue } = ctx,
    room = venue.room;
  const iron = w.mat(IRON, { roughness: 0.4, metalness: 0.15 }),
    brick = w.mat(0xe6d6bb, { roughness: 0.85 }),
    cap = w.mat(BRASS, { roughness: 0.3, metalness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xf2fbff,
    transparent: true,
    opacity: 0.1,
    roughness: 0.04,
    metalness: 0,
    envMapIntensity: 1.6,
    depthWrite: false,
  });
  const panes = [];
  // A run of glazing along x (the far end, at z) or along z (the far side, at x).
  const run = (from, to, at, alongZ) => {
    const length = to - from,
      bays = Math.max(1, Math.round(length / 3.2)),
      bay = length / bays,
      place = (u, y, d = 0) => (alongZ ? [at + d, y, u] : [u, y, at + d]),
      size = (l, h, t) => (alongZ ? [t, h, l] : [l, h, t]);
    // Dwarf wall and its cap.
    w.box(...size(length + 0.3, 0.75, 0.32), brick, ...place(from + length / 2, 0.375), 0.04);
    w.box(...size(length + 0.4, 0.08, 0.42), cap, ...place(from + length / 2, 0.79), 0.02);
    for (let i = 0; i <= bays; i++) {
      const u = from + i * bay;
      column(ctx, ...(alongZ ? [at, u] : [u, at]), ROOF.eave, iron);
      if (i < bays) {
        const mid = u + bay / 2,
          paneH = ROOF.eave - 0.95 - 0.5;
        // The glass of the bay and its bars: two mullions, a transom, a fanlight under the eave.
        panes.push(
          new THREE.BoxGeometry(...size(bay - 0.2, paneH, 0.03)).translate(...place(mid, 0.83 + paneH / 2)),
        );
        for (const k of [-1 / 3, 1 / 3])
          w.box(...size(0.05, paneH, 0.07), iron, ...place(mid + k * bay, 0.83 + paneH / 2), 0.01);
        w.box(...size(bay - 0.1, 0.06, 0.08), iron, ...place(mid, 3.0), 0.01);
        w.box(...size(bay - 0.1, 0.07, 0.1), iron, ...place(mid, 0.86), 0.01);
        const fan = w.torus(bay * 0.36, 0.035, iron, w.scene, Math.PI, 6, 24);
        fan.position.set(...place(mid, 3.05));
        fan.rotation.y = alongZ ? Math.PI / 2 : 0;
        for (let k = 1; k < 6; k++) {
          const a = (k / 6) * Math.PI,
            r = bay * 0.36;
          const ends = [place(mid, 3.05), place(mid - Math.cos(a) * r, 3.05 + Math.sin(a) * r)];
          w.rod(...ends, 0.018, IRON);
        }
        w.box(...size(bay - 0.1, 0.12, 0.16), iron, ...place(mid, ROOF.eave - 0.32), 0.02);
      }
    }
    // The eave beam with a gutter.
    w.box(...size(length + 0.3, 0.22, 0.26), iron, ...place(from + length / 2, ROOF.eave - 0.05), 0.03);
  };
  run(room.minZ + 0.7, WALL.end, WALL.far, true);
  run(WALL.near, WALL.far, WALL.end, false);
  // All the glass in one mesh, kept out of the batches (the storm darkens it: `windowGlass`).
  const sheet = new THREE.Mesh(mergeGeos(panes, ["position", "normal", "uv"]), glass);
  sheet.renderOrder = 3;
  w.scene.add(live(w, sheet));
  w.windowGlass = [sheet];
  // Hanging baskets on the far side's columns and the far end's.
  for (let z = -12; z <= 10; z += 6.4) basket(ctx, WALL.far - 0.55, z, [1, 0]);
  for (const x of [-9.6, 9.6]) basket(ctx, x, WALL.end - 0.55, [0, 1]);
}

function column(ctx, x, z, height, iron) {
  const { w } = ctx,
    key = x.toFixed(2) + "," + z.toFixed(2);
  if (ctx.columns.has(key)) return;
  ctx.columns.add(key);
  w.cyl(0.17, 0.2, 0.3, iron, x, 0.15, z, w.scene, 12);
  w.cyl(0.1, 0.12, height - 0.5, iron, x, height / 2, z, w.scene, 12);
  w.cyl(0.2, 0.11, 0.22, iron, x, height - 0.3, z, w.scene, 12);
  w.box(0.42, 0.08, 0.42, iron, x, height - 0.15, z, 0.02);
  ctx.ivy.push({ x, z, height: height - 0.6 });
}

function basket(ctx, x, z, [dx, dz]) {
  const { w, rand } = ctx;
  const g = w.group(x, 3.1, z);
  w.rod([0, 0.75, 0], [0, 0.0, 0], 0.012, 0x3a3a34, g);
  w.rod([0, 0.75, 0], [dx * 0.55, 0.75, dz * 0.55], 0.025, 0x2f3a36, g);
  const bowl = w.mesh(
    new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    w.mat(0x6b4a2e, { roughness: 0.9 }),
    0,
    0.05,
    0,
    g,
  );
  bowl.scale.y = 0.8;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    w.ball(0.11, i % 3 ? 0x5c9a52 : 0x6fae5f, Math.cos(a) * 0.24, 0.08, Math.sin(a) * 0.24, g);
    w.ball(
      0.065,
      [0xf06a8c, 0xffffff, 0xb070d0, 0xffb3c6][i % 4],
      Math.cos(a + 0.3) * 0.22,
      0.16,
      Math.sin(a + 0.3) * 0.22,
      g,
    );
    // Trailing stems.
    const len = 0.4 + rand() * 0.6;
    w.rod(
      [Math.cos(a) * 0.27, 0.02, Math.sin(a) * 0.27],
      [Math.cos(a) * 0.33, -len, Math.sin(a) * 0.33],
      0.018,
      0x4f8a46,
      g,
    );
    w.ball(0.05, 0x5c9a52, Math.cos(a) * 0.33, -len, Math.sin(a) * 0.33, g);
  }
}

// Ivy climbing the columns: one instanced mesh of small leaves in a loose spiral.
function ivy(ctx) {
  const { w, rand } = ctx,
    leaves = [];
  for (const c of ctx.ivy)
    for (let i = 0; i < 26; i++) {
      const t = i / 26,
        a = t * 9 + rand() * 0.8 + c.x;
      leaves.push([
        c.x + Math.cos(a) * 0.15,
        0.3 + t * c.height * (0.55 + rand() * 0.2),
        c.z + Math.sin(a) * 0.15,
        a,
      ]);
    }
  const geo = new THREE.SphereGeometry(0.09, 6, 4);
  const mesh = new THREE.InstancedMesh(geo, w.mat(0x3f7a3c, { roughness: 0.8 }), leaves.length);
  const dummy = new THREE.Object3D();
  leaves.forEach(([x, y, z, a], i) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0.4, a, 0.3);
    dummy.scale.set(1.1, 0.35, 0.8);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.castShadow = true;
  w.scene.add(mesh);
}

// ---------------------------------------------------------------------------------------------------------------------------
// The back wall: cream stucco with pilasters and a cornice, the sign over tall double doors of brass and glass (the guests' way in
// and out: `w.lockerDoors`), brass wall lamps either side and a porch light.
function backWall(ctx) {
  const { w, venue } = ctx,
    room = venue.room,
    door = venue.arrival,
    half = door.doorX * 2 + 0.02,
    z = WALL.back,
    height = 6.2;
  const stucco = plasterTexture({ seed: 77, strength: 0.06 });
  stucco.repeat.set(4, 2);
  w.textures.push(stucco);
  const wall = w.mat(STUCCO, { map: stucco, roughness: 0.9 }),
    trim = w.mat(0xfaf4e8, { roughness: 0.6 }),
    brass = w.mat(BRASS, { roughness: 0.25, metalness: 0.9 });
  const x0 = room.minX + 0.05,
    x1 = room.maxX - 0.05,
    gap = half + 0.18;
  // Wall either side of the doorway and over it.
  for (const s of [-1, 1]) {
    const a = s < 0 ? x0 : gap,
      b = s < 0 ? -gap : x1,
      mid = (a + b) / 2;
    w.box(Math.abs(b - a), height, 0.3, wall, mid, height / 2, z - 0.15, 0.03);
  }
  w.box(gap * 2, height - 3.25, 0.3, wall, 0, 3.25 + (height - 3.25) / 2, z - 0.15, 0.03);
  // Skirting, a dado rail in emerald tile, the cornice.
  w.box(x1 - x0, 0.22, 0.06, trim, 0, 0.11, z + 0.02, 0.01);
  w.box(x1 - x0, 0.9, 0.04, w.mat(EMERALD, { roughness: 0.25 }), 0, 0.68, z + 0.01, 0.01);
  w.box(x1 - x0, 0.06, 0.08, brass, 0, 1.16, z + 0.03, 0.01);
  w.box(x1 - x0 + 0.2, 0.3, 0.4, trim, 0, height - 0.1, z, 0.04);
  // Pilasters.
  for (const x of [-12.4, -8.4, -3.2, 3.2, 8.4, 12.4]) {
    w.box(0.62, height - 0.3, 0.16, trim, x, (height - 0.3) / 2, z + 0.08, 0.03);
    w.box(0.78, 0.22, 0.26, trim, x, height - 0.45, z + 0.1, 0.03);
  }
  // The door frame, the sign over it, the wall lamps.
  w.box(gap * 2 + 0.24, 0.24, 0.3, brass, 0, 3.15, z + 0.02, 0.03);
  for (const s of [-1, 1]) w.box(0.16, 3.15, 0.3, brass, s * (gap + 0.04), 1.575, z + 0.02, 0.02);
  const signTexture = swatch(w, "#1f5c4a");
  photo(signTexture, "sign.jpg");
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 1.4),
    new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.35, metalness: 0.2, emissive: 0x111111 }),
  );
  sign.position.set(0, 4.35, z + 0.06);
  w.scene.add(sign);
  w.box(4.4, 1.6, 0.08, brass, 0, 4.35, z + 0.01, 0.03);
  for (const s of [-1, 1]) sconce(ctx, s * (gap + 1.0), 2.5, z + 0.12);
  // The two leaves: brass frames round glass, a push bar, an etched band; hinged at the frame, opening into the room.
  const glass = new THREE.MeshStandardMaterial({
    color: 0xe6f6f2,
    transparent: true,
    opacity: 0.28,
    roughness: 0.05,
    envMapIntensity: 1.5,
    depthWrite: false,
  });
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * half, 0, z + 0.06);
    w.scene.add(hinge);
    const leafW = half - 0.04,
      cx = (-side * leafW) / 2;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.16, 2.7, 0.03), glass);
    pane.position.set(cx, 1.5, 0.02);
    hinge.add(pane);
    for (const y of [0.1, 2.9]) w.box(leafW, 0.12, 0.07, brass, cx, y, 0.02, 0.01, hinge);
    for (const x of [cx - leafW / 2 + 0.05, cx + leafW / 2 - 0.05])
      w.box(0.1, 2.9, 0.07, brass, x, 1.5, 0.02, 0.01, hinge);
    w.box(
      leafW - 0.18,
      0.1,
      0.05,
      w.mat(0xffffff, { transparent: true, opacity: 0.5 }),
      cx,
      2.35,
      0.03,
      0,
      hinge,
    );
    w.rod(
      [cx + side * (leafW / 2 - 0.25), 1.05, 0.1],
      [cx - side * (leafW / 2 - 0.4), 1.05, 0.1],
      0.025,
      BRASS,
      hinge,
    );
    w.lockerDoors.push({ side, hinge });
  }
}

function sconce(ctx, x, y, z) {
  const { w } = ctx;
  const brass = w.mat(BRASS, { roughness: 0.25, metalness: 0.9 });
  w.box(0.16, 0.36, 0.05, brass, x, y, z, 0.02);
  w.rod([x, y, z], [x, y + 0.1, z + 0.28], 0.02, BRASS);
  const lit = glowing(
    ctx,
    w.mat(0xfff1d0, { emissive: 0xffd89a, emissiveIntensity: 0.9 }),
    "emissiveIntensity",
  );
  const shade = w.cyl(0.08, 0.15, 0.24, lit, x, y + 0.22, z + 0.3);
  shade.castShadow = false;
  const glow = w.decal(w.glowMap, 1.4, 1.4, 0xffd8a0, 0.35, true);
  glowing(ctx, glow.material);
  glow.position.set(x, y + 0.3, z + 0.08);
  w.scene.add(glow);
}

// The near side: only a low wall with a brass rail and planters of flowers on it, so the overview looks over it.
function nearWall(ctx) {
  const { w, venue } = ctx,
    room = venue.room;
  const brick = w.mat(0xe6d6bb, { roughness: 0.85 }),
    cap = w.mat(BRASS, { roughness: 0.3, metalness: 0.8 });
  const length = WALL.end - (room.minZ + 0.7),
    mid = (WALL.end + room.minZ + 0.7) / 2;
  w.box(0.32, 0.75, length, brick, WALL.near, 0.375, mid, 0.04);
  w.box(0.42, 0.08, length + 0.1, cap, WALL.near, 0.79, mid, 0.02);
  const iron = w.mat(IRON, { roughness: 0.4, metalness: 0.15 });
  column(ctx, WALL.near, room.minZ + 0.7, ROOF.eave, iron);
  // Terracotta troughs of geraniums along the top, between the kit on the wall.
  const kit = [
    venue.sanitation.rack.z,
    ...venue.ringMounts.filter((r) => r.x < 0 && Math.abs(r.angle) > 1).map((r) => r.z),
  ];
  for (let z = room.minZ + 2.2; z < WALL.end - 1; z += 2.4) {
    if (kit.some((k) => Math.abs(k - z) < 2.4)) continue;
    w.box(0.36, 0.26, 1.6, w.mat(TERRACOTTA, { roughness: 0.8 }), WALL.near, 0.96, z, 0.04);
    for (let i = 0; i < 6; i++) {
      w.ball(0.13, 0x4f8a46, WALL.near + ((i % 2) - 0.5) * 0.12, 1.14, z - 0.65 + i * 0.26);
      w.ball(
        0.07,
        i % 2 ? 0xe2384f : 0xff8fa3,
        WALL.near + ((i % 2) - 0.5) * 0.12,
        1.25,
        z - 0.62 + i * 0.26,
      );
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// The waiting lounge: a Persian rug either side of an emerald runner with brass stair-rods, from the doors to the pool.
function lounge(ctx) {
  const { w, venue } = ctx,
    q = venue.queue,
    row = q.perRow ?? 4;
  const inner = q.outerX - (row - 1) * q.stepX,
    x0 = inner - 0.75,
    x1 = q.outerX + 0.75,
    z1 = q.startZ + 0.8,
    z0 = venue.deck.minZ + 0.05;
  for (const s of [-1, 1]) {
    const t = swatch(w, "#a7a27e");
    photo(t, "rug.jpg");
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, z1 - z0),
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set((s * (x0 + x1)) / 2, 0.006, (z0 + z1) / 2);
    rug.receiveShadow = true;
    w.scene.add(rug);
  }
  const runnerW = 1.5,
    z2 = -9.0;
  w.box(
    runnerW,
    0.012,
    z2 - WALL.back,
    w.mat(0x1d5a45, { roughness: 0.95 }),
    0,
    0.004,
    (z2 + WALL.back) / 2,
    0,
  );
  for (const x of [-runnerW / 2, runnerW / 2])
    w.box(
      0.05,
      0.016,
      z2 - WALL.back,
      w.mat(BRASS, { roughness: 0.3, metalness: 0.85 }),
      x,
      0.006,
      (z2 + WALL.back) / 2,
      0,
    );
}

// A teak garden bench with cast-iron scroll ends (the rescue bench).
function gardenBench(ctx, f) {
  const { w } = ctx;
  const g = w.group(f.x, 0, f.z, w.scene, f.angle || 0);
  const teak = woodMaterial(w, "#a8743f", 41),
    iron = w.mat(0x26342f, { roughness: 0.5, metalness: 0.4 });
  for (const x of [-1.5, 1.5]) {
    w.box(0.08, 0.5, 0.08, iron, x, 0.25, 0.22, 0.01, g);
    w.box(0.08, 1.0, 0.08, iron, x, 0.5, -0.3, 0.01, g);
    w.box(0.08, 0.06, 0.6, iron, x, 0.62, -0.03, 0.01, g);
    const scroll = w.torus(0.12, 0.025, iron, g, Math.PI * 1.5, 6, 14);
    scroll.position.set(x, 0.72, 0.24);
    scroll.rotation.y = Math.PI / 2;
  }
  for (let k = 0; k < 4; k++) w.box(3.2, 0.05, 0.12, teak, 0, 0.55, -0.24 + k * 0.15, 0.015, g);
  for (let k = 0; k < 3; k++) {
    const slat = w.box(3.2, 0.12, 0.04, teak, 0, 0.72 + k * 0.17, -0.33, 0.015, g);
    slat.rotation.x = -0.12;
  }
  w.box(3.24, 0.06, 0.1, teak, 0, 1.22, -0.36, 0.015, g);
}

// The hydrotherapy spa: a round tub in travertine with a brass rail, glowing water, bubbles and steam (the picture's alone).
function spa(ctx, f) {
  const { w, rand } = ctx,
    r = Math.min(f.hx, f.hz);
  // The tub: a lathe from the floor up the outside, over a rounded marble lip and down inside to the water.
  const profile = [
    [r + 0.05, 0],
    [r + 0.02, 0.56],
    [r + 0.08, 0.6],
    [r + 0.08, 0.68],
    [r - 0.06, 0.7],
    [r - 0.18, 0.66],
    [r - 0.18, 0.3],
    [0.01, 0.3],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const tub = w.mesh(new THREE.LatheGeometry(profile, 48), w.mat(0xf1eadc, { roughness: 0.3 }), f.x, 0, f.z);
  tub.receiveShadow = true;
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(r - 0.17, 40),
    new THREE.MeshStandardMaterial({
      color: 0x2bb3ad,
      emissive: 0x0b6b6c,
      emissiveIntensity: 0.6,
      roughness: 0.12,
      metalness: 0,
      envMapIntensity: 0.9,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(f.x, 0.58, f.z);
  w.scene.add(water);
  const glow = w.decal(w.glowMap, r * 3, r * 3, 0x7ff0e8, 0.25, true);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(f.x, 0.6, f.z);
  w.scene.add(glow);
  glowing(ctx, glow.material);
  glowing(ctx, water.material, "emissiveIntensity");
  const rail = w.torus(
    r - 0.05,
    0.03,
    w.mat(BRASS, { roughness: 0.22, metalness: 0.9 }),
    w.scene,
    Math.PI * 0.7,
    8,
    28,
  );
  rail.rotation.x = -Math.PI / 2;
  rail.position.set(f.x, 1.05, f.z);
  for (const a of [0, Math.PI * 0.7])
    w.rod(
      [f.x + Math.cos(a) * (r - 0.05), 0.66, f.z - Math.sin(a) * (r - 0.05)],
      [f.x + Math.cos(a) * (r - 0.05), 1.05, f.z - Math.sin(a) * (r - 0.05)],
      0.03,
      BRASS,
    );
  // Bubbles: an instanced field that rises and pops, and steam: soft puffs that climb and fade.
  const count = 46,
    bubbles = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.028, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0xf2ffff, roughness: 0.1, transparent: true, opacity: 0.85 }),
      count,
    ),
    seeds = Array.from({ length: count }, () => ({
      a: rand() * Math.PI * 2,
      d: Math.sqrt(rand()) * (r - 0.3),
      p: rand(),
      s: 0.6 + rand() * 0.8,
    }));
  bubbles.position.set(f.x, 0.58, f.z);
  w.scene.add(live(w, bubbles));
  const steam = [];
  for (let i = 0; i < 7; i++) {
    const puff = w.decal(w.glowMap, 1.2, 1.2, 0xffffff, 0, false);
    puff.userData.seed = i / 7;
    w.scene.add(live(w, puff));
    steam.push(puff);
  }
  const dummy = new THREE.Object3D();
  w.updaters.push((time, dt, world) => {
    const still = world.reducedMotion?.matches;
    seeds.forEach((b, i) => {
      const t = still ? b.p : (time * b.s * 0.5 + b.p) % 1;
      dummy.position.set(
        Math.cos(b.a + t) * b.d,
        0.01 + Math.sin(t * Math.PI) * 0.05,
        Math.sin(b.a + t) * b.d,
      );
      dummy.scale.setScalar(0.6 + t * 0.8);
      dummy.updateMatrix();
      bubbles.setMatrixAt(i, dummy.matrix);
    });
    bubbles.instanceMatrix.needsUpdate = true;
    for (const puff of steam) {
      const t = still ? puff.userData.seed : (time * 0.12 + puff.userData.seed) % 1;
      puff.position.set(
        f.x + Math.sin(puff.userData.seed * 9 + t * 2) * 0.5,
        0.8 + t * 2.0,
        f.z + Math.cos(puff.userData.seed * 7) * 0.4,
      );
      puff.scale.setScalar(0.6 + t * 1.4);
      puff.material.opacity = Math.sin(t * Math.PI) * 0.16;
      if (world.camera) puff.quaternion.copy(world.camera.quaternion);
    }
  });
}

// The pool hoist at the side: its seat hangs over the water (the model's arm reaches toward its -z).
function hoist(ctx, f) {
  const { w } = ctx;
  const g = live(w, w.group(f.x, 0, f.z, w.scene, -Math.PI / 2));
  g.add(
    propModel("hoist", { height: 2.1 }, (s) => {
      w.cyl(0.32, 0.36, 0.08, 0xd8dcdc, 0, 0.04, 0, s, 20);
      w.cyl(0.07, 0.07, 2.0, 0xe9ecec, 0, 1.0, 0, s, 10);
      w.rod([0, 1.95, 0], [0, 1.95, -1.0], 0.05, 0xe9ecec, s);
      w.box(0.5, 0.06, 0.45, 0x25343a, 0, 0.75, -1.0, 0.02, s);
    }),
  );
}

// The tea trolley: the dog treats are the biscuits in the tin on its top tier.
function teaTrolley(ctx, f) {
  const { w } = ctx;
  const g = live(w, w.group(f.x, 0, f.z, w.scene, Math.PI / 2));
  g.add(
    propModel("trolley", { height: 0.98 }, (s) => {
      for (const y of [0.25, 0.78]) w.box(0.95, 0.04, 0.55, 0x6b3d22, 0, y, 0, 0.01, s);
      for (const x of [-0.44, 0.44])
        for (const z of [-0.24, 0.24]) w.cyl(0.015, 0.015, 0.8, BRASS, x, 0.42, z, s, 6);
      w.ball(0.12, 0xffffff, 0.1, 0.92, 0, s);
    }),
  );
  const tin = treatsObject(w);
  tin.scale.setScalar(0.7);
  tin.position.set(f.x - 0.18, 1.05, f.z + 0.3);
  w.scene.add(tin);
  stationHit(w, { kind: "fixture", item: "treats" }, f, 1.3, 1.6);
  w.labels.push({
    text: "E · DOG TREATS",
    x: f.x,
    y: 2.2,
    z: f.z,
    when: (s) => !!s.dog && s.dog.stage !== "gone",
  });
}

// The gramophone on a mahogany side table, playing: a gold note rises from the horn now and then.
function gramophone(ctx, f) {
  const { w } = ctx;
  w.cyl(0.4, 0.4, 0.05, woodMaterial(w, "#5b2c1a", 13), f.x, 0.7, f.z, w.scene, 24);
  w.cyl(0.05, 0.08, 0.68, 0x4a2414, f.x, 0.35, f.z, w.scene, 10);
  w.cyl(0.26, 0.3, 0.04, 0x4a2414, f.x, 0.02, f.z, w.scene, 16);
  const g = live(w, w.group(f.x, 0.73, f.z, w.scene, (Math.PI * 3) / 4));
  g.add(
    propModel("gramophone", { height: 0.8 }, (s) => {
      w.box(0.36, 0.18, 0.36, 0x6b2e1a, 0, 0.09, 0, 0.02, s);
      w.cyl(0.04, 0.2, 0.5, BRASS, 0.1, 0.45, 0, s, 12).rotation.z = -0.8;
    }),
  );
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const c = canvas.getContext("2d");
  c.fillStyle = "#f2cf6b";
  c.font = "bold 52px serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("♪", 32, 34);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  w.textures.push(map);
  const notes = [0, 1, 2].map((i) => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false }),
    );
    s.scale.setScalar(0.32);
    s.userData.seed = i / 3;
    w.scene.add(live(w, s));
    return s;
  });
  w.updaters.push((time, dt, world) => {
    for (const n of notes) {
      const t = world.reducedMotion?.matches ? 0 : (time * 0.22 + n.userData.seed) % 1;
      n.position.set(
        f.x - 0.2 - t * 0.5,
        1.45 + t * 1.3,
        f.z - 0.2 + Math.sin(t * 9 + n.userData.seed * 6) * 0.15,
      );
      n.material.opacity = Math.sin(t * Math.PI) * 0.9;
    }
  });
}

// A cane armchair (the model faces its +x).
function armchair(ctx, f) {
  const { w } = ctx;
  const g = live(w, w.group(f.x, 0, f.z, w.scene, (f.angle || 0) - Math.PI / 2));
  g.add(
    propModel("armchair", { height: 1.0 }, (s) => {
      w.box(0.7, 0.42, 0.75, 0xb7864a, 0, 0.21, 0, 0.06, s);
      w.box(0.12, 0.9, 0.75, 0xb7864a, -0.32, 0.45, 0, 0.05, s);
      w.box(0.6, 0.12, 0.65, 0xd9cbb0, 0.03, 0.46, 0, 0.05, s);
    }),
  );
}

// The brass standard lamp between the armchairs, its silk shade lit, and a small table with a book and a teacup.
function readingLamp(ctx) {
  const { w, venue } = ctx;
  const chairs = venue.furniture.filter((f) => f.kind === "armchair");
  if (!chairs.length) return;
  const x = chairs[0].x + 0.35,
    z = chairs.reduce((a, f) => a + f.z, 0) / chairs.length;
  w.cyl(0.18, 0.2, 0.04, BRASS, x, 0.02, z, w.scene, 16);
  w.cyl(0.022, 0.022, 1.55, w.mat(BRASS, { roughness: 0.25, metalness: 0.9 }), x, 0.8, z, w.scene, 8);
  const silk = glowing(
    ctx,
    w.mat(0xf6e3bd, { emissive: 0xffc77a, emissiveIntensity: 0.75, roughness: 0.9 }),
    "emissiveIntensity",
  );
  const shade = w.cyl(0.18, 0.28, 0.32, silk, x, 1.62, z);
  shade.castShadow = false;
  const glow = w.decal(w.glowMap, 2.0, 2.0, 0xffcf8a, 0.3, true);
  glowing(ctx, glow.material);
  glow.position.set(x - 0.1, 1.55, z);
  glow.rotation.y = -Math.PI / 2;
  w.scene.add(glow);
  const pool = w.decal(w.glowMap, 2.4, 2.4, 0xffcf8a, 0.18, true);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(x - 0.5, 0.02, z);
  w.scene.add(pool);
  glowing(ctx, pool.material);
}

function lounger(ctx, f) {
  const { w } = ctx;
  const g = live(w, w.group(f.x, 0, f.z, w.scene, f.x < 0 ? 0 : Math.PI));
  g.add(
    propModel("lounger", { size: 2.0 }, (s) => {
      w.box(1.9, 0.12, 0.62, 0x8a5a33, 0, 0.3, 0, 0.03, s);
      w.box(1.4, 0.08, 0.58, 0xe8e3d4, 0.2, 0.4, 0, 0.03, s);
      w.box(0.55, 0.08, 0.58, 0xe8e3d4, -0.75, 0.62, 0, 0.03, s).rotation.z = -0.6;
    }),
  );
}

function monstera(ctx, f) {
  const { w } = ctx;
  const g = live(w, w.group(f.x, 0, f.z, w.scene, f.x * 0.7 + f.z));
  g.add(
    propModel("monstera", { height: 1.75 }, (s) => {
      w.cyl(0.32, 0.24, 0.48, TERRACOTTA, 0, 0.24, 0, s, 16);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        w.ball(
          0.32,
          0x2f6b3a,
          Math.cos(a) * 0.35,
          1.0 + (i % 2) * 0.3,
          Math.sin(a) * 0.35,
          s,
          [1.2, 0.3, 0.9],
        );
      }
    }),
  );
}

// ---------------------------------------------------------------------------------------------------------------------------
// The glass roof (Coach Cam only): two slopes of glass on white iron ribs from the eaves to a ridge with cast-iron cresting and
// finials, a fan of glazing bars in the far end's gable, and brass pendant lamps on chains. A grid of the same ribs that nobody
// sees stays in every view and only casts the roof's shadow, so the overview has the window pattern on its deck too.
function roof(ctx) {
  const { w, venue } = ctx,
    room = venue.room;
  const upper = new THREE.Group();
  upper.name = "conservatory-roof";
  upper.userData.batchOwner = true;
  w.scene.add(upper);
  const iron = w.mat(IRON, { roughness: 0.4, metalness: 0.15 }),
    brass = w.mat(BRASS, { roughness: 0.25, metalness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xeaf7f4,
    transparent: true,
    opacity: 0.14,
    roughness: 0.05,
    envMapIntensity: 1.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const z0 = WALL.back,
    z1 = WALL.end,
    lenZ = z1 - z0,
    midZ = (z0 + z1) / 2,
    rise = ROOF.ridge - ROOF.eave;
  const caster = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const shadowGrid = new THREE.Group();
  shadowGrid.name = "roof-shadow";
  w.scene.add(shadowGrid);
  const slab = (parent, material, sx, sy, sz, x, y, z, tilt) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    m.position.set(x, y, z);
    m.rotation.z = tilt;
    parent.add(m);
    return m;
  };
  for (const s of [-1, 1]) {
    const edge = s < 0 ? WALL.near : WALL.far,
      run = Math.abs(edge),
      slope = Math.hypot(run, rise),
      tilt = s * -Math.atan2(rise, run),
      cx = edge / 2,
      cy = (ROOF.eave + ROOF.ridge) / 2;
    const pane = slab(upper, glass, slope, 0.03, lenZ, cx, cy, midZ, tilt);
    pane.renderOrder = 3;
    // Rafters every 1.6 m and three purlins down each slope: real ribs above, unseen casters for the shadow.
    for (let z = z0; z <= z1 + 0.01; z += lenZ / Math.round(lenZ / 1.6)) {
      slab(upper, iron, slope, 0.14, 0.08, cx, cy - 0.06, z, tilt);
      const c = slab(shadowGrid, caster, slope, 0.14, 0.1, cx, cy - 0.06, z, tilt);
      c.castShadow = true;
    }
    for (const k of [0.25, 0.5, 0.75]) {
      const x = edge * (1 - k),
        y = ROOF.eave + rise * k;
      slab(upper, iron, 0.08, 0.12, lenZ, x, y - 0.08, midZ, 0);
      const c = slab(shadowGrid, caster, 0.08, 0.12, lenZ, x, y - 0.08, midZ, 0);
      c.castShadow = true;
    }
  }
  // Ridge, cresting and finials.
  slab(upper, iron, 0.3, 0.24, lenZ + 0.3, 0, ROOF.ridge, midZ, 0);
  for (let z = z0; z <= z1; z += 0.5) {
    slab(upper, iron, 0.03, 0.34, 0.03, 0, ROOF.ridge + 0.28, z, 0);
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 4, 10, Math.PI), iron);
    curl.position.set(0, ROOF.ridge + 0.32, z + 0.25);
    curl.rotation.y = Math.PI / 2;
    upper.add(curl);
  }
  for (const z of [z0, z1]) {
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 10), brass);
    finial.position.set(0, ROOF.ridge + 0.55, z);
    upper.add(finial);
  }
  // The far end's gable: glass with a fan of bars from a half-moon at its foot.
  const gable = new THREE.Shape();
  gable.moveTo(WALL.near, 0);
  gable.lineTo(WALL.far, 0);
  gable.lineTo(0, rise);
  gable.closePath();
  const gableGlass = new THREE.Mesh(new THREE.ShapeGeometry(gable), glass);
  gableGlass.position.set(0, ROOF.eave, z1);
  upper.add(gableGlass);
  for (let k = 1; k < 10; k++) {
    const a = (k / 10) * Math.PI,
      r = 14;
    const end = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * (rise / 15), 0);
    const len = end.length();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, len, 0.06), iron);
    bar.position.set(end.x / 2, ROOF.eave + end.y / 2, z1);
    bar.rotation.z = Math.atan2(-end.x, end.y);
    upper.add(bar);
  }
  // The back gable: stucco.
  const back = new THREE.Mesh(
    new THREE.ShapeGeometry(gable),
    w.mat(STUCCO, { roughness: 0.9, side: THREE.DoubleSide }),
  );
  back.position.set(0, ROOF.eave + 1.0, z0 - 0.02);
  back.scale.y = (rise - 1.0) / rise;
  upper.add(back);
  // Brass pendant lamps on chains down the middle.
  const globe = glowing(
    ctx,
    new THREE.MeshStandardMaterial({
      color: 0xfff4dc,
      emissive: 0xffd9a0,
      emissiveIntensity: 1.1,
      roughness: 0.3,
    }),
    "emissiveIntensity",
  );
  for (const z of [-9, -2, 5]) {
    for (const x of [-4.8, 4.8]) {
      const top = ROOF.eave + rise * (1 - Math.abs(x) / 15) - 0.1;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, top - 4.4, 4), brass);
      chain.position.set(x, (top + 4.4) / 2, z);
      upper.add(chain);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 14), brass);
      cap.position.set(x, 4.38, z);
      upper.add(cap);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), globe);
      ball.position.set(x, 4.18, z);
      upper.add(ball);
      const glow = w.decal(w.glowMap, 1.6, 1.6, 0xffd9a0, 0.35, true);
      glow.position.set(x, 4.18, z);
      upper.add(glow);
      glowing(ctx, glow.material);
    }
  }
  upper.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = false;
  });
  upper.visible = false;
  w.hall = {
    upper,
    coach: false,
    setCoach(on) {
      this.coach = on;
      upper.visible = on && !w.tune?.has("nohall");
    },
    update() {},
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// The late sun: slanting shafts through the far end's glass with motes of dust turning in them.
function sunlight(ctx) {
  const { w, rand } = ctx;
  const beam = beamTexture();
  w.textures.push(beam);
  w.lightShafts = [];
  const top = ROOF.eave - 0.6,
    reach = top / SUN.y,
    floorZ = WALL.end - 0.3 - reach * SUN.z,
    length = Math.hypot(top, WALL.end - 0.3 - floorZ),
    tilt = Math.atan2(SUN.z, SUN.y);
  for (let x = -12.8; x <= 12.8; x += 3.2) {
    const shaft = w.decal(beam, 2.4, length, 0xffe2b0, 0.075, true);
    shaft.position.set(x - (SUN.x / SUN.y) * (top / 2), top / 2, (WALL.end - 0.3 + floorZ) / 2);
    shaft.rotation.x = tilt; // (its bright end, the plane's +y, up towards the sun)
    shaft.material.side = THREE.DoubleSide;
    glowing(ctx, shaft.material);
    w.scene.add(shaft);
    w.lightShafts.push(shaft);
  }
  // Dust in the light.
  const count = 160,
    positions = new Float32Array(count * 3),
    seeds = [];
  for (let i = 0; i < count; i++) {
    seeds.push([
      -13 + rand() * 26,
      0.4 + rand() * 4.2,
      floorZ - 2 + rand() * (WALL.end - floorZ + 1.5),
      rand() * 6.28,
    ]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const motes = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      map: w.glowMap,
      color: 0xffe7b8,
      size: 0.09,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  motes.frustumCulled = false;
  glowing(ctx, motes.material);
  w.scene.add(live(w, motes));
  w.updaters.push((time, dt, world) => {
    const t = world.reducedMotion?.matches ? 0 : time;
    seeds.forEach(([x, y, z, p], i) => {
      positions[i * 3] = x + Math.sin(t * 0.13 + p) * 0.4;
      positions[i * 3 + 1] = y + Math.sin(t * 0.09 + p * 2) * 0.3;
      positions[i * 3 + 2] = z + Math.cos(t * 0.11 + p) * 0.4;
    });
    geo.attributes.position.needsUpdate = true;
  });
}
