// What makes a hall feel lived in, from the ridge down: regatta flags hanging from the very top, bunting strung
// between the trusses, club banners, pendant lamps with pools of light on the deck, ceiling fans turning slowly,
// air ducts, signs and a spectators' gallery. Flags and cloth ripple on the GPU; everything else is static and
// batches away. Lamps and glass register with `w.dimmers`, so a power cut darkens the hall properly.
import { THREE } from "./kit.mjs";
import { glowTexture } from "./textures.mjs";
import { flagGeo, garland, mergeGeos, placed, rngOf, wind } from "./geom.mjs";
import {
  flagAtlas,
  flagCell,
  FLAG_COUNT,
  bannerTexture,
  signTexture,
  timingBoardTexture,
} from "./hall-art.mjs";
import { beam, tex, roofSpanAt } from "./hall-kit.mjs";
import { Crowd } from "./crowd.mjs";

export function dress(c) {
  ridgeFlags(c);
  bunting(c);
  banners(c);
  wallFlags(c);
  pendants(c);
  sconces(c);
  fans(c);
  ducts(c);
  signs(c);
  if (c.S.gallery) gallery(c);
  motes(c);
  for (const extra of c.S.extras || []) extra(c);
}

function cloth(c, extra = {}, tuning = {}) {
  return wind(
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85, ...extra }),
    c.w.wind,
    tuning,
  );
}
function addCloth(c, parts, material) {
  if (!parts.length) return null;
  const mesh = new THREE.Mesh(mergeGeos(parts), material);
  mesh.frustumCulled = false;
  c.live.add(mesh);
  return mesh;
}

// ---- flags and bunting -----------------------------------------------------------------------------------
// A row of regatta signal flags hangs from the ridge beam along the whole length of the hall.
function ridgeFlags(c) {
  const { S, mid } = c,
    atlas = tex(c, flagAtlas()),
    rand = rngOf(S.seed ?? 3),
    parts = [],
    step = S.ridgeFlagStep ?? 1.7,
    count = Math.floor((c.lenZ - 2.4) / step);
  for (let i = 0; i < count; i++) {
    const g = flagGeo(1.2, 0.8, {
      edge: "top",
      notch: 0.22,
      cols: 5,
      rows: 6,
      phase: rand() * 6.28,
      cell: flagCell((i * 5) % FLAG_COUNT),
    });
    parts.push(
      placed(g, {
        at: [mid, S.ridgeHang ?? S.ridge - 0.74, S.minZ + 1.6 + i * step],
        rot: [0, Math.PI / 2, 0],
      }),
    );
    g.dispose();
  }
  if (S.crownBeam !== undefined)
    c.w.box(0.7, 0.55, c.lenZ - 1, c.mats.metal, mid, S.crownBeam, c.midZ, 0.03, c.g);
  addCloth(c, parts, cloth(c, { map: atlas }, { amp: 0.24, speed: 2.1 }));
}

function stringGeometry(lines) {
  const points = [];
  for (const line of lines) for (let i = 0; i < line.length - 1; i++) points.push(line[i], line[i + 1]);
  return new THREE.BufferGeometry().setFromPoints(points);
}

// Triangular bunting: strings across the hall and along it between the trusses.
function bunting(c) {
  const { S, mid, roofY, line } = c,
    rise = S.ridge - S.eave,
    depth = S.buntingDrop ?? 1.15,
    rafterX = (y) => roofSpanAt(line, mid, y, depth),
    bays = S.stations.slice(1).map((z, i) => (z + S.stations[i]) / 2),
    flags = [],
    lines = [];
  let seed = 11;
  for (const z of bays)
    for (const f of [0.36, 0.66]) {
      const y = S.eave + rise * (S.buntingLevels?.[f < 0.5 ? 0 : 1] ?? f),
        xr = rafterX(y),
        g = garland([mid - xr, y, z], [mid + xr, y, z], {
          count: Math.round((xr * 2) / 0.78),
          size: 0.56,
          sag: f < 0.5 ? 1.5 : 1,
          colors: S.bunting,
          seed: seed++,
          drop: 1.2,
        });
      flags.push(g.flags);
      lines.push(g.line);
    }
  for (const dx of S.buntingX ?? [-6.5, 0, 6.5]) {
    const x = mid + dx,
      y = roofY(x) - depth - 0.45;
    for (let i = 0; i < S.stations.length - 1; i++) {
      const g = garland([x, y, S.stations[i] + 0.3], [x, y, S.stations[i + 1] - 0.3], {
        count: 7,
        size: 0.55,
        sag: 0.8,
        colors: S.bunting,
        seed: seed++,
        drop: 1.2,
      });
      flags.push(g.flags);
      lines.push(g.line);
    }
  }
  const mat = cloth(c, { vertexColors: true }, { amp: 0.16, speed: 2.8 });
  addCloth(c, flags, mat);
  const string = new THREE.LineSegments(
    stringGeometry(lines),
    new THREE.LineBasicMaterial({ color: 0x3a4650 }),
  );
  string.frustumCulled = false;
  c.g.add(string);
}

// Tall club banners hang in two rows, each facing across the hall toward the middle.
function banners(c) {
  const { w, g, S, mid, roofY, mats } = c,
    bays = S.stations.slice(1).map((z, i) => (z + S.stations[i]) / 2),
    kinds = S.banners || [
      { color: "#118c94", trim: "#f4c849" },
      { color: "#ee8864", trim: "#fff6e4" },
      { color: "#2f5d9a", trim: "#f4c849" },
    ],
    height = S.bannerHeight ?? 5.1,
    offset = S.bannerX ?? 5.6,
    groups = kinds.map(() => []);
  for (const side of [-1, 1])
    bays.forEach((z, i) => {
      const x = mid + side * offset,
        top = roofY(x) - 1.35,
        k = (i + (side > 0 ? 1 : 0)) % kinds.length,
        geo = flagGeo(1.7, height, { edge: "top", notch: 0.45, cols: 5, rows: 9, phase: i * 1.7 + side });
      groups[k].push(placed(geo, { at: [x, top, z], rot: [0, -side * (Math.PI / 2), 0] }));
      geo.dispose();
      w.box(0.1, 0.1, 1.95, mats.dark, x, top + 0.04, z, 0.01, g);
    });
  kinds.forEach((kind, k) =>
    addCloth(
      c,
      groups[k],
      cloth(
        c,
        { map: tex(c, bannerTexture({ ...kind, ...(S.bannerText || {}) })) },
        { amp: 0.1, speed: 1.6 },
      ),
    ),
  );
}

// Big flags on the end walls and regatta flags on poles along the long walls.
function wallFlags(c) {
  const { w, g, S, mid, mats } = c,
    atlas = tex(c, flagAtlas()),
    parts = [],
    rand = rngOf((S.seed ?? 3) + 4);
  if (S.crest) {
    const sign = tex(c, signTexture({ ...S.crest, w: 1024, h: 576, font: 190 })),
      geo = flagGeo(S.crest.width ?? 6.6, S.crest.height ?? 3.5, { edge: "top", cols: 12, rows: 6 });
    const mesh = new THREE.Mesh(
      placed(geo, { at: [mid, S.crest.y ?? S.eave - 0.3, S.minZ + 0.14] }),
      cloth(c, { map: sign }, { amp: 0.06, speed: 1.3 }),
    );
    mesh.frustumCulled = false;
    c.live.add(mesh);
    geo.dispose();
    w.box(
      (S.crest.width ?? 6.6) + 0.3,
      0.14,
      0.14,
      mats.dark,
      mid,
      S.crest.y ?? S.eave - 0.3,
      S.minZ + 0.1,
      0.01,
      g,
    );
  }
  const n = S.windowCount ?? 6,
    pitch = (c.lenZ - 3.4) / (n - 1);
  for (const side of [-1, 1])
    for (let k = 0; k < n - 1; k++) {
      const z = S.minZ + 1.7 + k * pitch + pitch / 2,
        wall = side < 0 ? S.minX : S.maxX,
        y = S.eave - 0.95;
      w.box(2.2, 0.07, 0.07, mats.metal, wall - side * 1.1, y, z, 0.01, g);
      w.ball(0.09, 0xf4c849, wall - side * 2.2, y, z, g);
      const geo = flagGeo(1.7, 1.1, {
        edge: "top",
        cols: 7,
        rows: 4,
        phase: rand() * 6,
        cell: flagCell((k * 3 + (side > 0 ? 5 : 0)) % FLAG_COUNT),
      });
      parts.push(placed(geo, { at: [wall - side * 1.15, y - 0.03, z] }));
      geo.dispose();
    }
  addCloth(c, parts, cloth(c, { map: atlas }, { amp: 0.2, speed: 2.4 }));
}

// ---- lamps -----------------------------------------------------------------------------------------------
// One shared glow for every halo, so the whole hall's lamps are three draw calls.
function haloPoints(c, positions, size, color, opacity) {
  const geo = new THREE.BufferGeometry().setFromPoints(positions),
    map = tex(c, glowTexture(64)),
    material = new THREE.PointsMaterial({
      map,
      size,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
    }),
    points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  c.g.add(points);
  return material;
}

function pendants(c) {
  const { w, g, S, mid, roofY, mats } = c,
    C = S.colors,
    xs = S.lampX ?? [-7.5, 0, 7.5],
    top = S.lampTop ?? 9.6,
    shadeGeo = new THREE.CylinderGeometry(0.28, 1.05, 0.72, 22, 1, true),
    shadeMat = new THREE.MeshStandardMaterial({ color: C.accent, roughness: 0.45, side: THREE.DoubleSide }),
    discs = [],
    pools = [],
    halos = [];
  const collarY = S.eave + (S.ridge - S.eave) * 0.62 - 1.3 - 0.3;
  for (const z of S.stations)
    for (const dx of xs) {
      const x = mid + dx,
        attach = S.trusses === "lattice" ? roofY(x) - 2.2 : dx === 0 ? collarY : roofY(x) - 1.3;
      w.box(0.05, attach - top, 0.05, mats.dark, x, (attach + top) / 2, z, 0, g);
      const shade = new THREE.Mesh(shadeGeo, shadeMat);
      shade.position.set(x, top - 0.36, z);
      g.add(shade);
      discs.push(
        placed(new THREE.CircleGeometry(0.98, 20), { at: [x, top - 0.7, z], rot: [Math.PI / 2, 0, 0] }),
      );
      pools.push(
        placed(new THREE.CircleGeometry(S.lampPool ?? 4.4, 28), {
          at: [x, 0.045, z],
          rot: [-Math.PI / 2, 0, 0],
        }),
      );
      halos.push(new THREE.Vector3(x, top - 0.8, z));
    }
  const lamp = new THREE.MeshBasicMaterial({ color: C.lamp ?? 0xffe1a0 }),
    lampBase = lamp.color.clone();
  g.add(new THREE.Mesh(mergeGeos(discs), lamp));
  const poolMat = new THREE.MeshBasicMaterial({
    map: tex(c, glowTexture(96)),
    color: C.lamp ?? 0xffe1a0,
    transparent: true,
    opacity: S.poolLight ?? 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const poolMesh = new THREE.Mesh(mergeGeos(pools), poolMat);
  poolMesh.renderOrder = 1;
  g.add(poolMesh);
  const haloMat = haloPoints(c, halos, 7, C.lamp ?? 0xffe1a0, 0.5);
  c.hall.dimmers.push((k) => {
    const f = Math.min(1, Math.max(0, k));
    lamp.color.copy(lampBase).multiplyScalar(f);
    poolMat.opacity = (S.poolLight ?? 0.16) * f;
    haloMat.opacity = 0.5 * f;
  });
}

function sconces(c) {
  const { w, g, S, mats } = c,
    n = S.sconceCount ?? 6;
  if (n < 2) return;
  const positions = [],
    globes = [];
  for (const side of [-1, 1]) {
    const wall = side < 0 ? S.minX : S.maxX;
    for (let k = 0; k < n; k++) {
      const z = S.minZ + 2.4 + (k * (c.lenZ - 4.8)) / (n - 1);
      w.box(0.16, 0.5, 0.2, mats.metal, wall - side * 0.1, S.sconceY ?? 3.2, z, 0.03, g);
      globes.push(
        placed(new THREE.SphereGeometry(0.2, 10, 8), {
          at: [wall - side * 0.32, (S.sconceY ?? 3.2) + 0.28, z],
        }),
      );
      positions.push(new THREE.Vector3(wall - side * 0.32, (S.sconceY ?? 3.2) + 0.28, z));
    }
  }
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe6b0 }),
    base = mat.color.clone();
  g.add(new THREE.Mesh(mergeGeos(globes), mat));
  const halo = haloPoints(c, positions, 2.6, 0xffc878, 0.55);
  c.hall.dimmers.push((k) => {
    const f = Math.min(1, Math.max(0, k));
    mat.color.copy(base).multiplyScalar(f);
    halo.opacity = 0.55 * f;
  });
}

// ---- machinery: fans and ducts ---------------------------------------------------------------------------
function fans(c) {
  const { w, S, mid, mats } = c,
    bays = S.stations.slice(1).map((z, i) => (z + S.stations[i]) / 2),
    hubY = S.fanY ?? S.ridge - 5.2,
    top = S.ridge - 0.7;
  const pick = S.fans ?? [1, 3];
  for (const b of pick) {
    if (bays[b] === undefined) continue;
    const g = new THREE.Group();
    g.position.set(mid, hubY, bays[b]);
    c.live.add(g);
    w.box(0.1, top - hubY, 0.1, mats.dark, 0, (top - hubY) / 2, 0, 0, g);
    w.cyl(0.36, 0.44, 0.26, mats.dark, 0, 0, 0, g, 16);
    const rotor = new THREE.Group();
    g.add(rotor);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = (i * Math.PI) / 2;
      rotor.add(arm);
      const blade = w.box(2.5, 0.05, 0.55, mats.wood, 1.7, -0.02, 0, 0.02, arm);
      blade.rotation.z = 0.08;
      w.box(0.6, 0.06, 0.12, mats.dark, 0.5, 0, 0, 0.01, arm);
    }
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe9b8 }),
    );
    dome.position.y = -0.14;
    g.add(dome);
    const speed = 0.9 + (b % 2) * 0.25;
    c.hall.animators.push((time) => (rotor.rotation.y = time * speed));
  }
}

function ducts(c) {
  const { w, g, S, mid, roofY, mats, midZ, lenZ } = c;
  if (S.noDucts) return;
  for (const side of [-1, 1]) {
    const x = mid + side * (S.ductX ?? 9.5),
      y = roofY(x) - (S.ductDrop ?? 2.2);
    const duct = w.cyl(0.42, 0.42, lenZ - 1, mats.metal, x, y, midZ, g, 18);
    duct.rotation.x = Math.PI / 2;
    for (let z = S.minZ + 2; z < S.maxZ - 1; z += 4.5) {
      const ring = w.cyl(0.5, 0.5, 0.14, mats.dark, x, y, z, g, 18);
      ring.rotation.x = Math.PI / 2;
    }
    for (const z of S.stations) w.box(0.07, 1, 0.5, mats.dark, x, y + 0.8, z, 0.01, g);
  }
}

// ---- signs -----------------------------------------------------------------------------------------------
function signPlane(c, texture, width, height, at, rotY, frame = true) {
  const { w, g, mats } = c,
    mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
  mesh.position.set(...at);
  mesh.rotation.y = rotY;
  g.add(mesh);
  if (frame) {
    const back = w.box(width + 0.16, height + 0.16, 0.08, mats.dark, at[0], at[1], at[2], 0.02, g);
    back.rotation.y = rotY;
    const fwd = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY)).multiplyScalar(0.05);
    back.position.sub(fwd);
  }
  return mesh;
}

function signs(c) {
  const { S, mid } = c;
  for (const sign of S.signs || []) {
    const t = tex(c, sign.timing ? timingBoardTexture(sign.timing) : signTexture(sign));
    signPlane(c, t, sign.width, sign.height, sign.at, sign.ry ?? 0);
  }
  void mid;
}

// ---- spectators' gallery ---------------------------------------------------------------------------------
function gallery(c) {
  const { w, g, S, mid, mats } = c,
    G = S.gallery,
    width = S.maxX - S.minX,
    z1 = S.maxZ,
    z0 = S.maxZ - G.depth;
  w.box(width, 0.3, G.depth, mats.wood, mid, G.y - 0.15, (z0 + z1) / 2, 0.02, g);
  w.box(width, 0.7, 0.24, mats.trim, mid, G.y - 0.35, z0 - 0.02, 0.03, g);
  w.box(width, G.height ?? 2.7, 0.12, mats.wood, mid, G.y + (G.height ?? 2.7) / 2, z1 - 0.06, 0.02, g);
  // Balustrade: posts, a wooden rail and two thin bars.
  for (let x = S.minX + 0.4; x <= S.maxX - 0.3; x += 1.3)
    w.box(0.1, 1.1, 0.1, mats.trim, x, G.y + 0.55, z0 + 0.1, 0.01, g);
  w.box(width, 0.1, 0.2, mats.wood, mid, G.y + 1.12, z0 + 0.1, 0.02, g);
  for (const y of [0.35, 0.72]) w.box(width, 0.04, 0.04, mats.metal, mid, G.y + y, z0 + 0.1, 0, g);
  // Columns under the gallery, and double doors in the wall behind.
  for (const dx of G.columns ?? [-10.2, -4.6, 4.6, 10.2]) {
    w.cyl(0.3, 0.3, G.y - 0.3, mats.trim, mid + dx, (G.y - 0.3) / 2, z0 + 0.4, g, 14);
    w.box(0.8, 0.22, 0.8, mats.trim, mid + dx, G.y - 0.42, z0 + 0.4, 0.03, g);
  }
  for (const dx of G.doors ?? [-7.4, 7.4]) {
    w.box(2.9, 3.5, 0.14, mats.trim, mid + dx, 1.75, z1 - 0.1, 0.03, g);
    for (const s of [-1, 1]) {
      w.box(1.28, 3.3, 0.1, mats.wood, mid + dx + s * 0.68, 1.65, z1 - 0.2, 0.02, g);
      w.box(0.14, 0.14, 0.08, mats.metal, mid + dx + s * 0.16, 1.5, z1 - 0.28, 0.04, g);
    }
  }
  // Spectators along the rail and two rows behind it.
  const seats = [],
    rand = rngOf((S.seed ?? 3) + 9);
  for (let row = 0; row < 2; row++)
    for (let x = S.minX + 1.1 + row * 0.6; x < S.maxX - 0.8; x += 1.25 + rand() * 0.5) {
      if (rand() < 0.22) continue;
      seats.push({ x, y: G.y, z: z0 + 0.62 + row * 1.15, ry: Math.PI + (rand() - 0.5) * 0.3 });
    }
  if (seats.length) {
    const crowd = new Crowd(c.w, c.live, seats, { seed: (S.seed ?? 3) + 2, waveAxis: "x" });
    c.hall.crowds = [crowd];
    c.hall.animators.push((time) => crowd.update(time, c.w.cheer || 0));
  }
}

// ---- dust in the sunbeams --------------------------------------------------------------------------------
function motes(c) {
  const { S } = c,
    n = S.motes ?? 110,
    rand = rngOf((S.seed ?? 3) + 21),
    base = new Float32Array(n * 3),
    seeds = [];
  for (let i = 0; i < n; i++) {
    base.set(
      [
        S.minX + 1 + rand() * (S.maxX - S.minX - 2),
        1.5 + rand() * (S.eave - 2),
        S.minZ + 1 + rand() * (S.maxZ - S.minZ - 2),
      ],
      i * 3,
    );
    seeds.push(rand() * 6.28);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
  const material = new THREE.PointsMaterial({
    map: tex(c, glowTexture(32)),
    size: 0.2,
    color: 0xfff2d0,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  c.live.add(points);
  c.hall.dimmers.push((k) => (material.opacity = 0.55 * Math.min(1, Math.max(0, k))));
  const p = geo.attributes.position;
  c.hall.animators.push((time) => {
    for (let i = 0; i < n; i++)
      p.setXYZ(
        i,
        base[i * 3] + Math.sin(time * 0.13 + seeds[i]) * 1.6,
        base[i * 3 + 1] + Math.sin(time * 0.21 + seeds[i] * 2) * 0.9,
        base[i * 3 + 2] + Math.cos(time * 0.11 + seeds[i]) * 1.6,
      );
    p.needsUpdate = true;
  });
}

export { beam };
