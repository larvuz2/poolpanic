// Sunset Lagoon: a beach club on a lagoon, from golden hour into dusk. The floor plan is Splash Park's (so a shift plays
// the same here), dressed as a boardwalk with a thatched beach house, a tiki bar, torches and string lights, a
// bonfire, swaying palms and a beach with a volleyball net, a rowboat and a few crabs. Everything that moves (flames,
// palms, crabs, the bartender) runs off the world's `updaters`; everything that glows follows the hour.
import { THREE, COLORS } from "./kit.mjs";
import { buildPool, buildDeck } from "./pool.mjs";
import { sandTexture, thatchTexture, glowTexture, flameTexture } from "./textures.mjs";
import { poolSurround, stringLights, commonStations } from "./resort.mjs";
import { SCENERY } from "./sky.mjs";
import { mergeGeos, paint, placed, rngOf, wind, flagGeo, garland } from "./geom.mjs";
import { figure } from "./crowd.mjs";
import { signTexture } from "./hall-art.mjs";
import { bench, lifeguardTower, lockerBay, lounger, stripedCone, umbrella, woodMaterial } from "./props.mjs";

const TAU = Math.PI * 2;
const SAND = 0xecd2a0;

export function buildLagoon(w, venue) {
  const dynamic = { ...w.look.water, glow: Math.max(w.look.water.glow || 0, 0.001) };
  buildDeck(w, venue, {
    base: "#cf9660",
    grout: "#7a4d2a",
    planks: true,
    slab: 0x1f6f8b,
    rim: 0x58c7cf, // the slab under the deck shows through the water as the pool's bottom
    side: 0xe9c88f,
  });
  buildPool(w, venue, dynamic);
  poolSurround(w, venue, { base: "#e4b98a", grout: "#f6e8cc", seed: 63 });
  const live = new THREE.Group();
  live.name = "lagoon-live";
  w.scene.add(live);
  w.liveProps.push(live);
  const ctx = { w, venue, live, rand: rngOf(41), fronds: [] };
  beachClub(ctx);
  lockerBay(w, venue, -12, "HUT A", 0x2f9aa0, "resort");
  lockerBay(w, venue, 12, "HUT B", 0xee6a4a, "resort");
  railings(ctx);
  for (const f of venue.furniture) {
    if (f.kind === "bench") bench(w, f.x, f.z, f.angle);
    if (f.kind === "palm") swayPalm(ctx, f.x, f.z, 4.6, f.x + f.z);
    if (f.kind === "lounger") lounger(w, f.x, f.z, f.angle || 0, f.x < -12 ? 0x2f9aa0 : 0xee6a4a);
    if (f.kind === "umbrella") palapa(ctx, f.x, f.z);
    if (f.kind === "lifeguard-tower") lifeguardTower(w, f.x, f.z);
    if (f.kind === "kiosk") tikiBar(ctx, f.x, f.z);
  }
  // Beach towels and a ball on the deck.
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
  commonStations(w, venue, { tower: { blue: 0xee6a4a, white: 0xfff1d6, steps: 0xd9a066 } });
  beachGround(ctx);
  beach(ctx);
  torches(ctx);
  stringLights(w, venue, true);
  flagMast(ctx);
  finishPalms(ctx);
}

// ---- helpers ---------------------------------------------------------------------------------------------
function thatchMaterial(w, repeat = [4, 1]) {
  const t = thatchTexture();
  t.repeat.set(...repeat);
  w.textures.push(t);
  return new THREE.MeshStandardMaterial({ map: t, color: 0xffffff, roughness: 1 });
}
// Bamboo: a pole with darker joints.
function bamboo(w, x, z, height, parent = w.scene, r = 0.06, y0 = 0) {
  w.cyl(r, r * 1.08, height, 0xd8b568, x, y0 + height / 2, z, parent, 8);
  for (let y = 0.45; y < height; y += 0.6) w.cyl(r * 1.3, r * 1.3, 0.05, 0x9c7a3c, x, y0 + y, z, parent, 8);
}
function glowSprite(ctx, color, size, opacity = 0.7) {
  const m = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: (ctx.glow ||= ctx.w.textures[ctx.w.textures.push(glowTexture(64)) - 1]),
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  m.scale.setScalar(size);
  return m;
}
const hourOf = (w) => w.ambience?.glow ?? 0;

// ---- the beach house along the back wall -----------------------------------------------------------------
function beachClub(ctx) {
  const { w, venue, live } = ctx,
    z0 = -16.35,
    room = venue.room,
    width = room.maxX - room.minX + 0.4,
    cx = (room.minX + room.maxX) / 2;
  const boards = woodMaterial(w, "#e9c48a", 21),
    thatch = thatchMaterial(w, [width / 2.4, 1]);
  w.box(width, 2.2, 0.45, w.mat(0x2aa7a0, { roughness: 0.75 }), cx, 1.0, z0, 0.1);
  w.box(width, 2.5, 0.45, boards, cx, 3.3, z0, 0.08);
  w.box(width + 0.2, 0.16, 0.6, 0xfff1d6, cx, 2.15, z0 + 0.05, 0.03);
  // Thatched canopy over the wall's top, a ridge roll, and a fringe of straw hanging from its lip.
  const canopy = w.box(width + 1, 0.4, 1.6, thatch, cx, 4.48, z0 + 0.75, 0.05);
  canopy.rotation.x = 0.26;
  const ridge = w.cyl(0.36, 0.36, width + 1, 0xc99a52, cx, 4.98, z0 + 0.15, w.scene, 10);
  ridge.rotation.z = Math.PI / 2;
  const fringe = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.1, 0.6, 5).rotateX(Math.PI),
    w.mat(0xc99a52, { roughness: 1 }),
    Math.floor(width / 0.2),
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < fringe.count; i++) {
    dummy.position.set(cx - width / 2 + 0.3 + i * 0.2, 4.02 + Math.sin(i * 1.7) * 0.05, z0 + 1.5);
    dummy.rotation.set(0, 0, Math.sin(i * 2.3) * 0.15);
    dummy.scale.set(1, 0.8 + Math.sin(i * 3.1) * 0.25, 1);
    dummy.updateMatrix();
    fringe.setMatrixAt(i, dummy.matrix);
  }
  fringe.castShadow = true;
  w.scene.add(fringe);
  // The neon sign: coral lettering on deep teal, with a glow that wakes at dusk and flickers now and then.
  const signZ = z0 + 0.32;
  w.box(7.9, 1.25, 0.16, 0x0f3f4f, cx, 3.35, signZ - 0.08, 0.1);
  const sign = w.textPlane(
    "SUNSET LAGOON",
    7.4,
    0.92,
    "#0f3f4f",
    "#ff9a6a",
    cx,
    3.35,
    signZ + 0.02,
    w.scene,
    92,
  );
  const halo = glowSprite(ctx, 0xff7a4a, 9, 0);
  halo.position.set(cx, 3.35, signZ + 0.3);
  halo.scale.set(10, 2.6, 1);
  w.scene.add(halo);
  w.updaters.push((time) => {
    const on = Math.min(1, Math.max(0, (hourOf(w) - 0.08) / 0.35)),
      flick = time % 7.3 > 7.05 ? 0.35 : 1;
    sign.material.color.setScalar((0.55 + 0.45 * on) * (on > 0.1 ? flick : 1));
    halo.material.opacity = 0.7 * on * flick;
  });
  w.dimmers.push((k) => (sign.visible = k > 0.4));
  // Portholes with the lights on inside, and surfboards leaning against the boards.
  for (const x of [-7.6, -3.8, 3.8, 7.6, 0.4 + 11.2]) {
    w.torus(0.5, 0.09, 0xfff1d6, w.scene).position.set(x, 1.55, z0 + 0.27);
    const glass = new THREE.Mesh(
      new THREE.CircleGeometry(0.44, 16),
      new THREE.MeshBasicMaterial({ color: 0xffc978 }),
    );
    glass.position.set(x, 1.55, z0 + 0.25);
    w.scene.add(glass);
  }
  const colors = [0xf4c849, 0xee6a4a, 0x2f9aa0, 0xfff1d6, 0xe45c8b, 0x6cb980, 0x529fd5];
  [-8.9, -7.6, -6.3, 2.2, 3.5, 4.8, 6.1].forEach((x, i) => {
    const board = new THREE.Mesh(
      paint(
        new THREE.SphereGeometry(1, 12, 10),
        (px, py, pz) => new THREE.Color(Math.abs(px) < 0.09 ? 0xfff6e4 : colors[i % colors.length]),
      ),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }),
    );
    board.scale.set(0.34, 1.55, 0.09);
    board.position.set(x, 1.65, z0 + 0.62);
    board.rotation.x = -0.13;
    board.rotation.z = Math.sin(i * 2.1) * 0.05;
    board.castShadow = true;
    w.scene.add(board);
    w.box(0.05, 0.28, 0.16, 0x2b3a4a, x, 0.28, z0 + 0.95, 0.02);
  });
  // Paper lanterns along the canopy lip: glowing orange orbs that sway in the evening breeze.
  const lanterns = [];
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xff9a4a });
  for (let x = -14.6; x <= 15.6; x += 3.4) {
    const g = w.group(x, 3.95, z0 + 1.45, live);
    w.rod([0, 0, 0], [0, 0.35, 0], 0.012, 0x3a2a1a, g);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), lanternMat);
    orb.scale.set(1, 1.18, 1);
    orb.position.y = -0.3;
    g.add(orb);
    const halo2 = glowSprite(ctx, 0xff8a3a, 2.4, 0);
    halo2.position.y = -0.3;
    g.add(halo2);
    lanterns.push({ g, halo: halo2, phase: x });
  }
  w.updaters.push((time) => {
    const on = Math.min(1, Math.max(0, (hourOf(w) - 0.06) / 0.3)) * (w.incidentLight ?? 1);
    lanternMat.color.setRGB(1, 0.6 + 0.1 * on, 0.29 * (0.4 + 0.6 * on)).multiplyScalar(0.55 + 0.45 * on);
    for (const l of lanterns) {
      l.g.rotation.z = Math.sin(time * 0.9 + l.phase) * 0.06;
      l.halo.material.opacity = 0.75 * on;
    }
  });
  w.dimmers.push((k) => (w.incidentLight = Math.min(1, k)));
}

// ---- rope railings and the beach grass at the open end ---------------------------------------------------
function railings(ctx) {
  const { w, venue } = ctx,
    d = venue.deck,
    room = venue.room;
  const ropes = [],
    rope = new THREE.MeshStandardMaterial({ color: 0xe8d3a6, roughness: 0.9 });
  for (const x of [d.minX - 0.5, d.maxX + 0.45]) {
    const length = room.maxZ - room.minZ - 1.8,
      z0 = room.minZ + 1.5,
      n = 10,
      step = length / n;
    for (let i = 0; i <= n; i++) {
      const z = z0 + i * step;
      bamboo(w, x, z, 1.25, w.scene, 0.07);
      w.ball(0.1, 0xc99a52, x, 1.3, z);
      if (i < n)
        for (const y of [1.1, 0.72]) {
          const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(x, y - 0.22, z + step / 2),
            new THREE.Vector3(x, y, z + step),
          );
          ropes.push(new THREE.TubeGeometry(curve, 8, 0.03, 5, false));
        }
    }
  }
  const mesh = new THREE.Mesh(mergeGeos(ropes), rope);
  mesh.castShadow = true;
  w.scene.add(mesh);
  // Beach grass clumps along the open end.
  const clump = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.11, 1.0, 4),
    w.mat(0x9db85a, { roughness: 1 }),
    120,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 120; i++) {
    dummy.position.set(
      room.minX + 0.4 + (i / 120) * (room.maxX - room.minX - 0.8) + Math.sin(i * 3.7) * 0.3,
      0.32,
      room.maxZ - 0.3 + Math.sin(i * 1.9) * 0.4,
    );
    dummy.rotation.set(Math.sin(i * 2.9) * 0.3, i, Math.sin(i * 4.3) * 0.3);
    dummy.scale.set(1, 0.7 + ((i * 7) % 5) * 0.14, 1);
    dummy.updateMatrix();
    clump.setMatrixAt(i, dummy.matrix);
  }
  clump.castShadow = true;
  w.scene.add(clump);
}

// ---- tiki bar in place of the snack kiosk ----------------------------------------------------------------
function tikiBar(ctx, x, z) {
  const { w, live } = ctx,
    g = w.group(x, 0, z, w.scene, -Math.PI / 2),
    thatch = thatchMaterial(w, [2, 1]);
  w.box(2.4, 1.15, 2.0, woodMaterial(w, "#c98f5a", 7), 0, 0.58, 0, 0.1, g);
  w.box(2.6, 0.12, 2.2, 0x6b4426, 0, 1.2, 0, 0.05, g);
  // Bamboo posts and a pyramid of thatch over the bar.
  for (const xx of [-1.15, 1.15]) for (const zz of [-0.9, 0.95]) bamboo(w, xx, zz, 2.5, g, 0.07, 1.2 - 0.05);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.25, 4).rotateY(Math.PI / 4), thatch);
  roof.position.set(0, 4.15, 0.05);
  roof.scale.set(1.25, 1, 1.05);
  roof.castShadow = true;
  g.add(roof);
  w.cyl(0.1, 0.1, 0.5, 0xc99a52, 0, 4.9, 0.05, g, 8);
  // A shelf of bottles behind the counter, glasses with little umbrellas in front.
  w.box(2.1, 0.08, 0.3, 0x6b4426, 0, 1.95, -0.85, 0.02, g);
  [0xe0513f, 0x6cb980, 0xf4c849, 0x529fd5, 0xee6a4a, 0xe45c8b, 0x6cb980].forEach((c, i) =>
    w.cyl(0.075, 0.075, 0.42, c, -0.9 + i * 0.3, 2.2, -0.85, g, 8),
  );
  [0xee6a4a, 0xf4c849, 0xe45c8b].forEach((c, i) => {
    w.cyl(0.1, 0.07, 0.24, 0xe9f7f4, -0.5 + i * 0.5, 1.38, 0.55, g, 10);
    w.cyl(0.085, 0.085, 0.1, c, -0.5 + i * 0.5, 1.5, 0.55, g, 10);
    w.rod([-0.5 + i * 0.5, 1.5, 0.55], [-0.42 + i * 0.5, 1.75, 0.55], 0.008, 0x3a2a1a, g);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.08, 8), w.mat(c, { roughness: 0.6 }));
    cone.position.set(-0.42 + i * 0.5, 1.76, 0.55);
    g.add(cone);
  });
  w.textPlane("SUNSET BAR", 1.7, 0.36, "#6b4426", "#ffd08a", 0, 0.75, 1.01, g, 52);
  // String of bulbs under the roof.
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (let i = 0; i < 7; i++) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bulbMat);
    bulb.position.set(-1.1 + i * 0.37, 3.55 - Math.sin((i / 6) * Math.PI) * 0.18, 1.1);
    g.add(bulb);
  }
  // The bartender shakes a cocktail every few seconds.
  const bartender = figure(w, live, { suit: 0xff8a3d, hat: 0xfff1d6, scale: 1.05 });
  bartender.group.position.set(x + 1.2, 0, z);
  bartender.group.rotation.y = -Math.PI / 2;
  w.updaters.push((time) => {
    const cycle = time % 6,
      shaking = cycle < 1.8,
      s = shaking ? Math.sin(time * 22) : 0;
    bartender.arms[0].rotation.x = shaking ? -1.6 + s * 0.35 : -0.25 + Math.sin(time * 1.2) * 0.05;
    bartender.arms[1].rotation.x = shaking ? -1.6 - s * 0.35 : -0.15;
    bartender.arms[0].rotation.z = 0.2;
    bartender.arms[1].rotation.z = -0.2;
    bartender.root.position.y = shaking ? Math.abs(s) * 0.03 : 0;
    bartender.head.rotation.z = Math.sin(time * 0.8) * 0.07;
  });
}

// A straw parasol on a wooden pole.
function palapa(ctx, x, z) {
  const { w } = ctx,
    g = w.group(x, 0, z);
  bamboo(w, 0, 0, 2.7, g, 0.06);
  w.cyl(0.35, 0.4, 0.12, 0xb9a282, 0, 0.06, 0, g, 12);
  const canopy = stripedCone(w, 1.6, 0.6, 12, 0xd9b26a, 0xbf8f45);
  canopy.position.y = 2.6;
  g.add(canopy);
  w.ball(0.08, 0xc99a52, 0, 2.95, 0, g);
}

// ---- palms whose fronds sway ------------------------------------------------------------------------------
function frondGeometry(rand) {
  const geo = new THREE.SphereGeometry(1, 8, 6);
  geo.scale(0.36, 0.09, 1.25);
  geo.translate(0, 0, 1.1);
  const pos = geo.attributes.position,
    flex = new Float32Array(pos.count),
    tint = rand() < 0.5 ? 0x4f9a5b : 0x68b267;
  for (let i = 0; i < pos.count; i++) flex[i] = Math.max(0, Math.min(1, pos.getZ(i) / 2.3));
  geo.setAttribute("aFlex", new THREE.BufferAttribute(flex, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(pos.count), 1));
  paint(geo, (x, y, z) => new THREE.Color(tint).lerp(new THREE.Color(0x9bcf6a), Math.max(0, z) / 3));
  return geo;
}
export function swayPalm(ctx, x, z, height = 4.4, seed = 0, y0 = 0) {
  const { w, fronds } = ctx,
    g = w.group(x, y0, z);
  w.cyl(0.62, 0.5, 0.62, 0xd9906a, 0, 0.31, 0, g);
  w.cyl(0.54, 0.54, 0.05, 0x6f7d4a, 0, 0.63, 0, g);
  const lean = 0.22 + (seed % 3) * 0.06;
  let prev = [0, 0.6, 0];
  for (let i = 1; i <= 6; i++) {
    const t = i / 6,
      next = [Math.sin(seed) * lean * t * t * 2, 0.6 + height * t, Math.cos(seed) * lean * t * t * 2];
    w.rod(prev, next, 0.13 - t * 0.03, i % 2 ? 0x9b7650 : 0x8a6644, g);
    prev = next;
  }
  for (let i = 0; i < 3; i++)
    w.ball(0.12, 0x7a5a36, Math.cos(i * 2.1) * 0.14, prev[1] - 0.14, Math.sin(i * 2.1) * 0.14, g);
  const rand = rngOf(Math.floor(Math.abs(seed) * 1000) + 5);
  for (let i = 0; i < 8; i++) {
    const geo = frondGeometry(rand),
      phase = rand() * TAU,
      ph = geo.attributes.aPhase;
    for (let k = 0; k < ph.count; k++) ph.setX(k, phase);
    fronds.push(
      placed(geo, {
        at: [x + prev[0], y0 + prev[1] + 0.05, z + prev[2]],
        rot: [0.42 + rand() * 0.25, (i / 8) * TAU + seed, 0],
        scale: 0.85 + rand() * 0.3,
      }),
    );
    geo.dispose();
  }
  return g;
}
function finishPalms(ctx) {
  const { w, live, fronds } = ctx;
  if (!fronds.length) return;
  const mesh = new THREE.Mesh(
    mergeGeos(fronds),
    wind(
      new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75 }),
      w.wind,
      {
        amp: 0.3,
        speed: 1.5,
      },
    ),
  );
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  live.add(mesh);
}

// ---- torches and the flagpole ----------------------------------------------------------------------------
function torches(ctx) {
  const { w, venue, live } = ctx,
    d = venue.deck,
    flame = flameTexture();
  w.textures.push(flame);
  const list = [];
  const spots = [];
  for (const x of [d.minX - 1.1, d.maxX + 1.05]) for (const z of [-12, -6, 0, 6, 12]) spots.push([x, z]);
  spots.push([-8.5, 14.6], [8.5, 14.6], [-19.5, -9], [-19.5, 9]);
  for (const [x, z] of spots) {
    bamboo(w, x, z, 2.1, w.scene, 0.06);
    w.cyl(0.16, 0.1, 0.22, 0x4a3018, x, 2.16, z, w.scene, 8);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flame,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    sprite.position.set(x, 2.62, z);
    live.add(sprite);
    const halo = glowSprite(ctx, 0xff9a3a, 3.6, 0);
    halo.position.set(x, 2.62, z);
    live.add(halo);
    list.push({ sprite, halo, phase: x * 1.7 + z });
  }
  w.updaters.push((time) => {
    const on = Math.min(1, Math.max(0, (hourOf(w) - 0.05) / 0.2)) * (w.incidentLight ?? 1),
      rest = 0.18;
    for (const t of list) {
      const flick = 0.85 + Math.sin(time * 11 + t.phase) * 0.12 + Math.sin(time * 23 + t.phase * 2) * 0.06;
      t.sprite.visible = on > 0.02;
      t.sprite.scale.set(0.55 * flick * (0.4 + 0.6 * on), 0.95 * flick * (0.4 + 0.6 * on), 1);
      t.sprite.position.y = 2.36 + 0.28 * flick * (0.4 + 0.6 * on);
      t.halo.material.opacity = 0.55 * on * flick;
    }
    void rest;
  });
}

function flagMast(ctx) {
  const { w, live, venue } = ctx,
    x = venue.room.maxX + 1.4,
    z = -13.6,
    height = 10.5;
  w.cyl(0.13, 0.19, height, 0xfff1d6, x, height / 2, z, w.scene, 10);
  w.cyl(0.32, 0.4, 0.4, 0x8a5a35, x, 0.2, z, w.scene, 10);
  w.ball(0.2, 0xf4c849, x, height + 0.15, z);
  const flagTex = signTexture({
    text: "LAGOON",
    sub: "SUNSET SWIM CLUB",
    bg: "#ee6a4a",
    fg: "#fff6e4",
    w: 512,
    h: 320,
    font: 120,
  });
  w.textures.push(flagTex);
  const flag = new THREE.Mesh(
    placed(flagGeo(3.4, 2.1, { edge: "left", cols: 10, rows: 5 }), {
      at: [x, height - 1.4, z + 0.05],
      rot: [0, -Math.PI / 2, 0],
    }),
    wind(new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.85 }), w.wind, {
      amp: 0.32,
      speed: 2,
    }),
  );
  flag.frustumCulled = false;
  live.add(flag);
  // Bunting down to the roof of the beach house.
  const strings = garland([x, height - 0.4, z], [venue.room.maxX - 6, 4.5, -16.1], {
    count: 20,
    size: 0.6,
    sag: 1.4,
    colors: [0xee6a4a, 0xf4c849, 0x2f9aa0, 0xfff1d6, 0xe45c8b],
    seed: 5,
  });
  const mesh = new THREE.Mesh(
    strings.flags,
    wind(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide }), w.wind, {
      amp: 0.16,
      speed: 2.8,
    }),
  );
  mesh.frustumCulled = false;
  live.add(mesh);
  w.scene.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(strings.line),
      new THREE.LineBasicMaterial({ color: 0x3a4650 }),
    ),
  );
}

// ---- the beach itself ------------------------------------------------------------------------------------
function beachGround(ctx) {
  const { w, venue } = ctx,
    shore = SCENERY[venue.scenery].shoreX + 3.4,
    width = 300 - shore,
    sand = sandTexture();
  sand.repeat.set(width / 4, 150);
  w.textures.push(sand);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 600),
    new THREE.MeshStandardMaterial({ map: sand, color: 0xffffff, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((shore + 300) / 2, -1.95, 0);
  floor.receiveShadow = true;
  w.scene.add(floor);
}

function beach(ctx) {
  const { w, venue, live, rand } = ctx,
    shore = SCENERY[venue.scenery].shoreX;
  // Dunes ringing the lagoon (never on the sea side) with tufts of grass on top.
  for (let i = 0; i < 26; i++) {
    const a = rand() * TAU,
      r = 30 + rand() * 46,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (x < shore + 14) continue;
    const s = 5 + rand() * 8;
    w.ball(1, SAND, x, -1.95 - 0.3, z, w.scene, [s, 0.9 + rand() * 1.6, s * (0.7 + rand() * 0.5)]);
  }
  // Volleyball net, rowboat, sandcastle, a surf shack, umbrellas and a scatter of palms.
  volleyball(ctx, -26, 1);
  rowboat(ctx, -29.5, -7, 0.5);
  sandcastle(ctx, -21.6, 15);
  surfShack(ctx, -27.5, -15.5);
  for (const [x, z, c] of [
    [-22.5, -3, 0xee6a4a],
    [-22.5, 6, 0x2f9aa0],
    [-24.5, 9.5, 0xf4c849],
  ]) {
    umbrella(w, x, z, c);
    lounger(w, x - 0.9, z + 1.2, Math.PI / 2, c);
  }
  for (const [x, z, h] of [
    [-19.5, -16, 4.8],
    [-20.5, -6.5, 5.2],
    [-19.8, 12, 5],
    [-21, 20, 4.6],
    [-18.5, -24, 5.4],
    [-30, 8, 5.4],
    [-31, -22, 5],
    [24, -14, 5.2],
    [24, 10, 4.8],
    [19, 21, 5],
    [-8, 20, 4.6],
    [8, 22, 5.2],
  ])
    swayPalm(ctx, x, z, h, x * 0.37 + z * 0.11, -1.95);
  bonfire(ctx, -25.5, 14);
  crabs(ctx);
  void live;
}

function volleyball(ctx, x, z) {
  const { w } = ctx;
  for (const zz of [-3.4, 3.4]) bamboo(w, x, z + zz, 2.6, w.scene, 0.07, -1.95);
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  g.strokeStyle = "rgba(255,250,235,0.9)";
  g.lineWidth = 2;
  for (let i = 0; i <= 64; i++) {
    g.beginPath();
    g.moveTo(i * 4, 0);
    g.lineTo(i * 4, 64);
    g.stroke();
  }
  for (let j = 0; j <= 16; j++) {
    g.beginPath();
    g.moveTo(0, j * 4);
    g.lineTo(256, j * 4);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  w.textures.push(t);
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 1.0),
    new THREE.MeshBasicMaterial({
      map: t,
      transparent: true,
      alphaTest: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  net.rotation.y = Math.PI / 2;
  net.position.set(x, -1.95 + 2.1, z);
  w.scene.add(net);
  w.box(0.06, 0.14, 6.8, 0xfff6e4, x, -1.95 + 2.6, z, 0.02);
  const ball = w.ball(0.28, 0xfff1d6, x + 4.5, -1.95 + 0.3, z + 1.2);
  ball.castShadow = true;
}

function rowboat(ctx, x, z, ry) {
  const { w } = ctx,
    hull = paint(
      new THREE.SphereGeometry(1, 18, 10, 0, TAU, Math.PI / 2, Math.PI / 2),
      (px, py) => new THREE.Color(py > -0.18 ? 0xfff1d6 : 0xd9503f),
    );
  const m = new THREE.Mesh(
    hull,
    new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }),
  );
  m.scale.set(2.0, 0.85, 0.95);
  const g = w.group(x, -1.95 + 0.6, z, w.scene, ry);
  g.rotation.z = 0.08;
  m.castShadow = true;
  g.add(m);
  for (const xx of [-0.7, 0.5]) w.box(0.16, 0.08, 1.75, 0xc99a52, xx, 0.1, 0, 0.02, g);
  w.rod([-0.3, 0.6, -0.5], [1.4, 0.95, -1.7], 0.035, 0x8a5a35, g);
  w.rod([-0.3, 0.6, 0.5], [1.3, 1.0, 1.7], 0.035, 0x8a5a35, g);
}

function sandcastle(ctx, x, z) {
  const { w } = ctx,
    y = -1.95,
    sand = 0xe3c58c;
  w.cyl(1.1, 1.3, 0.55, sand, x, y + 0.28, z, w.scene, 14);
  w.cyl(0.8, 0.9, 0.6, sand, x, y + 0.85, z, w.scene, 14);
  for (const [dx, dz] of [
    [1.05, 0],
    [-1.05, 0],
    [0, 1.05],
    [0, -1.05],
  ]) {
    w.cyl(0.32, 0.36, 0.95, sand, x + dx, y + 0.5, z + dz, w.scene, 10);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.5, 10), w.mat(0xf4c849, { roughness: 0.7 }));
    cone.position.set(x + dx, y + 1.22, z + dz);
    cone.castShadow = true;
    w.scene.add(cone);
  }
  w.rod([x, y + 1.15, z], [x, y + 2.0, z], 0.025, 0x8a5a35);
  w.box(0.34, 0.22, 0.02, 0xe0513f, x + 0.2, y + 1.9, z, 0.005);
}

function surfShack(ctx, x, z) {
  const { w } = ctx,
    g = w.group(x, -1.95, z, w.scene, Math.PI / 2 - 0.2);
  w.box(3.4, 2.4, 2.6, woodMaterial(w, "#e9c48a", 13), 0, 1.2, 0, 0.08, g);
  w.box(1.0, 1.7, 0.1, 0x2aa7a0, 0.6, 0.85, 1.32, 0.03, g);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 1.3, 4).rotateY(Math.PI / 4),
    thatchMaterial(w, [2, 1]),
  );
  roof.position.y = 3.05;
  roof.scale.set(1.15, 1, 1);
  roof.castShadow = true;
  g.add(roof);
  w.textPlane("SURF SCHOOL", 2.4, 0.5, "#0f3f4f", "#ffd08a", -0.6, 1.9, 1.32, g, 56);
  [0xf4c849, 0xee6a4a, 0x2f9aa0].forEach((c, i) => {
    const b = new THREE.Mesh(
      paint(new THREE.SphereGeometry(1, 10, 8), (px) => new THREE.Color(Math.abs(px) < 0.1 ? 0xfff6e4 : c)),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }),
    );
    b.scale.set(0.3, 1.5, 0.08);
    b.position.set(-1.3 + i * 0.5, 1.5, 1.6);
    b.rotation.x = -0.17;
    b.castShadow = true;
    g.add(b);
  });
}

// A bonfire on the sand: a ring of stones, crossed logs, layered flames that dance and embers that rise.
function bonfire(ctx, x, z) {
  const { w, live } = ctx,
    y = -1.95,
    flame = flameTexture();
  w.textures.push(flame);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    w.ball(
      0.26,
      i % 2 ? 0x8a8f96 : 0x6f757c,
      x + Math.cos(a) * 1.05,
      y + 0.12,
      z + Math.sin(a) * 1.05,
      w.scene,
      [1, 0.7, 1],
    );
  }
  for (let i = 0; i < 4; i++) {
    const log = w.cyl(0.12, 0.12, 1.5, 0x5a3a20, x, y + 0.25, z, w.scene, 8);
    log.rotation.set(1.3, (i / 4) * Math.PI, 0);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.5,
      seat = w.cyl(
        0.32,
        0.32,
        1.7,
        0x8a5a35,
        x + Math.cos(a) * 2.5,
        y + 0.34,
        z + Math.sin(a) * 2.5,
        w.scene,
        10,
      );
    seat.rotation.set(Math.PI / 2, 0, -a);
  }
  const sprites = [0, 1, 2].map((k) => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flame,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    s.position.set(x, y + 0.9, z);
    live.add(s);
    return s;
  });
  const halo = glowSprite(ctx, 0xff7a2a, 8, 0.5);
  halo.position.set(x, y + 1.2, z);
  live.add(halo);
  const n = 26,
    base = new Float32Array(n * 3),
    embers = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        map: ctx.glow || glowTexture(64),
        size: 0.22,
        color: 0xffa040,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
  embers.geometry.setAttribute("position", new THREE.BufferAttribute(base, 3));
  embers.frustumCulled = false;
  live.add(embers);
  w.updaters.push((time) => {
    const on = 0.5 + 0.5 * Math.min(1, hourOf(w) * 2.2);
    sprites.forEach((s, k) => {
      const f = 0.9 + Math.sin(time * (9 + k * 3) + k * 2) * 0.16;
      s.scale.set((1.5 - k * 0.3) * f * on, (2.5 - k * 0.5) * f * on, 1);
      s.position.set(x + Math.sin(time * 3 + k) * 0.1, y + 1 + k * 0.1, z + Math.cos(time * 2.7 + k) * 0.1);
    });
    halo.material.opacity = (0.32 + 0.4 * hourOf(w)) * (0.9 + 0.1 * Math.sin(time * 13));
    const p = embers.geometry.attributes.position;
    for (let i = 0; i < n; i++) {
      const life = (time * 0.5 + i / n) % 1;
      p.setXYZ(
        i,
        x + Math.sin(i * 12.9 + time * 0.6) * 0.5 * (1 + life),
        y + 0.8 + life * 3.6,
        z + Math.cos(i * 7.3 + time * 0.5) * 0.5 * (1 + life),
      );
    }
    p.needsUpdate = true;
    embers.material.opacity = 0.35 + 0.6 * hourOf(w);
  });
}

// Four red crabs scuttling sideways on the sand.
function crabs(ctx) {
  const { w, live, venue } = ctx,
    shore = SCENERY[venue.scenery].shoreX,
    list = [];
  const shell = new THREE.MeshStandardMaterial({ color: 0xe0513f, roughness: 0.5 }),
    dark = new THREE.MeshBasicMaterial({ color: 0x1d2a30 });
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), shell);
    body.scale.set(1.4, 0.7, 1);
    body.castShadow = true;
    g.add(body);
    for (const s of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), dark);
      stalk.position.set(s * 0.14, 0.22, 0.2);
      g.add(stalk);
      const claw = new THREE.Group();
      claw.position.set(s * 0.42, 0.06, 0.2);
      const pincer = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), shell);
      pincer.scale.set(1, 0.8, 1.2);
      pincer.position.z = 0.12;
      claw.add(pincer);
      g.add(claw);
      g.userData[s < 0 ? "left" : "right"] = claw;
      for (let k = 0; k < 3; k++) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.04), shell);
        leg.position.set(s * 0.4, -0.04, -0.12 + k * 0.12);
        leg.rotation.z = s * 0.4;
        g.add(leg);
      }
    }
    g.userData.base = { x: shore + 10 + i * 5.5, z: -18 + i * 9.5 };
    g.userData.phase = i * 1.9;
    live.add(g);
    list.push(g);
  }
  void w;
  w.updaters.push((time) => {
    for (const g of list) {
      const u = g.userData,
        t = time * 0.35 + u.phase,
        moving = Math.sin(t * 3) > -0.2;
      g.position.set(u.base.x + Math.sin(t) * 3.4, -1.95 + 0.2, u.base.z + Math.sin(t * 0.7) * 0.8);
      g.rotation.y = (Math.PI / 2) * (Math.cos(t) > 0 ? 1 : -1);
      const scuttle = moving ? Math.sin(time * 18 + u.phase) * 0.05 : 0;
      g.position.y += Math.abs(scuttle);
      u.left.rotation.x = Math.sin(time * 4 + u.phase) * 0.5;
      u.right.rotation.x = Math.cos(time * 4 + u.phase) * 0.5;
    }
  });
}

export { COLORS };
