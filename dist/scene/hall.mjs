// The hall around an indoor venue: full-height walls, a roof of timber or steel trusses over boarded ceilings,
// clerestory windows and skylights with beams of light, and (in hall-dressing.mjs) flags, lamps, fans and banners.
// Only the Coach Cam sees any of it: the overview looks down on the room like a dollhouse, so the whole upper
// structure hides there (`hall.setCoach`). Nothing in the hall casts or receives shadow; the sun shines "through" it.
import { THREE } from "./kit.mjs";
import { plasterTexture, woodTexture, subwayTexture, beamTexture } from "./textures.mjs";
import { mergeGeos } from "./geom.mjs";
import { skylightTexture } from "./hall-art.mjs";
import { dress } from "./hall-dressing.mjs";
import { orient, archGeo, roofProfile, roofHeight, tex, beam, onRoof } from "./hall-kit.mjs";

export class Hall {
  constructor(w, spec) {
    this.w = w;
    this.S = spec;
    this.coach = false;
    this.animators = [];
    this.light = 1;
    this.glass = [];
    this.dimmers = w.dimmers;
    const g = (this.upper = new THREE.Group());
    g.name = "hall-upper";
    g.userData.batchOwner = true;
    w.scene.add(g);
    const live = (this.live = new THREE.Group());
    live.name = "hall-live";
    g.add(live);
    w.liveProps.push(live);
    const S = spec,
      line = roofProfile(S);
    this.ctx = {
      w,
      g,
      live,
      S,
      C: S.colors,
      mid: (S.minX + S.maxX) / 2,
      half: (S.maxX - S.minX) / 2,
      line,
      roofY: (x) => roofHeight(line, x, S.eave),
      midZ: (S.minZ + S.maxZ) / 2,
      lenZ: S.maxZ - S.minZ,
      hall: this,
      // Segments of the roof line with their tangent, inward normal and length.
      segs: line.slice(0, -1).map((a, i) => {
        const b = line[i + 1],
          t = b.clone().sub(a),
          length = t.length();
        t.normalize();
        return { a, b, t, n: new THREE.Vector2(t.y, -t.x), length, angle: Math.atan2(t.y, t.x) };
      }),
      mats: {},
    };
    this.build();
    g.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    w.hall = this;
  }

  build() {
    const c = this.ctx;
    materials(c);
    walls(c);
    roof(c);
    trusses(c);
    glass(c);
    dress(c);
  }
  setCoach(on) {
    this.coach = on;
    this.upper.visible = on;
  }
  update(time, dt, w, sim) {
    if (!this.coach) return;
    for (const f of this.animators) f(time, dt, w, sim);
  }
}

function materials(c) {
  const { C, S } = c;
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  const plaster = tex(c, plasterTexture({ seed: 61, strength: 0.09 }));
  plaster.repeat.set(0.25, 0.25);
  c.mats.wall = std(C.wall, { map: plaster });
  c.mats.trim = std(C.trim, { roughness: 0.7 });
  c.mats.dark = std(C.dark, { roughness: 0.6 });
  c.mats.metal = std(C.metal, { roughness: 0.4, metalness: 0.5 });
  c.mats.accent = std(C.accent, { roughness: 0.55 });
  // Dark walnut timbers against whitewashed boards; a little emissive lift stands in for light bouncing around
  // the hall, so the underside of the roof (which only sees the dark floor in the hemisphere light) is not muddy.
  const grain = tex(c, woodTexture({ base: C.woodBase || "#7d4f2c", seed: 5, planks: 3 }));
  grain.repeat.set(0.25, 0.5);
  c.mats.wood = std(0xffffff, { map: grain, roughness: 0.65, emissive: 0x6a4630, emissiveIntensity: 0.32 });
  const boards = tex(c, woodTexture({ base: "#fdf6e6", seed: 8, planks: 6 }));
  boards.repeat.set(Math.max(1, (S.maxX - S.minX) / 22), (S.maxZ - S.minZ) / 2.6);
  c.mats.boards = std(C.boards, {
    map: boards,
    roughness: 0.7,
    emissive: S.boardsEmissive ?? 0xffeed2,
    emissiveIntensity: S.boardsGlow ?? 0.34,
  });
  // Glass is brighter than white so it glows through the tone mapping like real sky seen from a dim room.
  c.mats.pane = new THREE.MeshBasicMaterial({
    map: tex(
      c,
      skylightTexture({ top: S.sky.top, bottom: S.sky.bottom, clouds: !S.night, stars: !!S.night }),
    ),
    side: THREE.DoubleSide,
    fog: false,
  });
  c.mats.skylight = new THREE.MeshBasicMaterial({
    map: tex(c, skylightTexture({ top: S.sky.top, bottom: S.sky.bottom, clouds: false })),
    side: THREE.DoubleSide,
    fog: false,
  });
  c.mats.pane.color.setScalar(S.glass?.[0] ?? 1.55);
  c.mats.skylight.color.setScalar(S.glass?.[1] ?? 1.7);
  c.mats.beam = new THREE.MeshBasicMaterial({
    map: tex(c, beamTexture()),
    color: S.shaftColor || 0xfff0c8,
    transparent: true,
    opacity: S.shaftOpacity ?? 0.1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
}

// ---- walls -----------------------------------------------------------------------------------------------
function tileBand(c, x, z, length, y0, y1, axis) {
  const { w, C } = c,
    t = tex(c, subwayTexture({ base: C.tile }));
  t.repeat.set(length / 2, (y1 - y0) / 0.5);
  const mat = new THREE.MeshStandardMaterial({ map: t, color: 0xffffff, roughness: 0.35 }),
    h = y1 - y0;
  if (axis === "x") w.box(0.07, h, length, mat, x, (y0 + y1) / 2, z, 0, c.g);
  else w.box(length, h, 0.07, mat, x, (y0 + y1) / 2, z, 0, c.g);
  w.box(
    axis === "x" ? 0.16 : length,
    0.14,
    axis === "x" ? length : 0.16,
    c.mats.trim,
    x,
    y1 + 0.07,
    z,
    0.02,
    c.g,
  );
}

// The outline of a gable end wall: straight up to the eaves, then along the roof line.
function gableGeometry(c, y0, zFrom, depth) {
  const { S, line } = c,
    shape = new THREE.Shape();
  shape.moveTo(S.minX - 0.6, y0);
  shape.lineTo(S.maxX + 0.6, y0);
  shape.lineTo(S.maxX + 0.6, S.eave);
  for (let i = line.length - 1; i >= 0; i--) shape.lineTo(line[i].x, line[i].y);
  shape.lineTo(S.minX - 0.6, S.eave);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, zFrom);
  return g;
}

function walls(c) {
  const { w, g, S, mats, midZ, lenZ, mid } = c;
  const thick = 0.6,
    wainscot = S.wainscot ?? 1.5;
  for (const side of [-1, 1]) {
    const x = side < 0 ? S.minX - thick / 2 : S.maxX + thick / 2,
      inner = side < 0 ? S.minX : S.maxX;
    w.box(thick, S.eave - S.floor, lenZ + thick * 2, mats.wall, x, (S.floor + S.eave) / 2, midZ, 0, g);
    // A tiled wainscot with a cream rail, and a heavy cornice under the roof.
    tileBand(c, inner - side * 0.03, midZ, lenZ, S.low, S.low + wainscot, "x");
    w.box(0.9, 0.5, lenZ + 0.2, mats.trim, inner - side * 0.05, S.eave - 0.25, midZ, 0.05, g);
    w.box(0.6, 0.18, lenZ + 0.2, mats.accent, inner - side * 0.14, S.eave - 0.65, midZ, 0.03, g);
  }
  // End walls. The club's rear wall already stands to `rearBase` (club.mjs); the front is built here.
  g.add(new THREE.Mesh(gableGeometry(c, S.rearBase ?? S.floor, S.minZ - 0.45, 0.45), mats.wall));
  g.add(new THREE.Mesh(gableGeometry(c, S.floor, S.maxZ, 0.45), mats.wall));
  tileBand(c, mid, S.maxZ - 0.03, S.maxX - S.minX, S.low, S.low + wainscot, "z");
  for (const z of [S.minZ + 0.05, S.maxZ - 0.05])
    w.box(S.maxX - S.minX + 0.4, 0.4, 0.6, mats.trim, mid, S.eave - 0.2, z, 0.04, g);
  w.box(S.maxX - S.minX, 0.2, 0.16, mats.accent, mid, (S.rearBase ?? S.low) + 0.5, S.minZ + 0.06, 0.02, g);
}

// ---- roof: boarded ceiling, purlins, the ridge ------------------------------------------------------------
function roof(c) {
  const { w, g, S, mats, segs, lenZ, midZ, mid } = c,
    zLen = lenZ + 1.6,
    fractions = S.profile === "arch" ? [0.5] : [0.2, 0.42, 0.64, 0.86];
  segs.forEach((s, i) => {
    const slab = w.box(
      s.length + 0.04,
      0.14,
      zLen,
      mats.boards,
      (s.a.x + s.b.x) / 2 + s.n.x * 0.07,
      (s.a.y + s.b.y) / 2 + s.n.y * 0.07,
      midZ,
      0,
      g,
    );
    slab.rotation.z = s.angle;
    for (const f of fractions) {
      const p = onRoof(c, i, f, 0.29),
        purlin = w.box(0.2, 0.3, zLen, mats.wood, p.x, p.y, midZ, 0.02, g);
      purlin.rotation.z = s.angle;
    }
  });
  // The ridge: a heavy beam along the top, under a long glowing skylight strip.
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(S.profile === "arch" ? 3.4 : 1.7, lenZ - 0.6),
    mats.skylight,
  );
  strip.rotation.x = Math.PI / 2;
  strip.position.set(mid, S.ridge - 0.06, midZ);
  g.add(strip);
  c.hall.glass.push(strip);
  if (S.profile !== "arch") w.box(0.5, 0.55, lenZ, mats.wood, mid, S.ridge - 0.42, midZ, 0.03, g);
}

// ---- trusses ---------------------------------------------------------------------------------------------
function trusses(c) {
  for (const z of c.S.stations) (c.S.trusses === "lattice" ? latticeTruss : timberTruss)(c, z);
}

function timberTruss(c, z) {
  const { w, g, S, mats, segs, roofY, mid, half } = c,
    rise = S.ridge - S.eave;
  // Rafters follow the roof line, 0.75 m under it.
  segs.forEach((s, i) => {
    const p = onRoof(c, i, 0.5, 0.75),
      r = w.box(s.length + 0.5, 0.62, 0.36, mats.wood, p.x, p.y, z, 0.03, g);
    r.rotation.z = s.angle;
  });
  // Collar beam, king post, and the big braces that sweep from the walls up to the rafters.
  const collarY = S.eave + rise * 0.62 - 1.3,
    xr = half * (1 - (collarY + 1.2 - S.eave) / rise),
    postTop = S.ridge - 1.25;
  w.box(xr * 2 + 0.4, 0.55, 0.4, mats.wood, mid, collarY, z, 0.03, g);
  w.box(0.4, postTop - (collarY + 0.28), 0.4, mats.wood, mid, (postTop + collarY + 0.28) / 2, z, 0.03, g);
  for (const side of [-1, 1]) {
    const wallX = mid + side * (half - 0.15),
      kneeY = S.eave - 2.6,
      rx = mid + side * (half - 5.9);
    beam(c, mats.wood, [wallX, kneeY, z], [rx, roofY(rx) - 1.15, z], 0.36, 0.52, 0.03);
    w.box(0.7, 0.7, 0.55, mats.wood, wallX, kneeY - 0.1, z, 0.04, g);
    w.box(0.06, 0.8, 0.5, mats.dark, wallX - side * 0.02, kneeY, z, 0.01, g);
    const sx = mid + side * 3.2;
    beam(c, mats.wood, [mid + side * 0.2, collarY + 0.4, z], [sx, roofY(sx) - 1.1, z], 0.3, 0.36, 0.02);
  }
}

// Steel lattice: two chords following the roof line with zig-zag webs between them.
function latticeTruss(c, z) {
  const { w, g, S, mats, segs } = c,
    chord = (a, b, t = 0.34) => beam(c, mats.metal, [a.x, a.y, z], [b.x, b.y, z], t, t, 0.03);
  segs.forEach((s, i) => {
    const up = onRoof(c, i, 0, 0.55),
      up2 = onRoof(c, i, 1, 0.55),
      lo = onRoof(c, i, 0, S.trussDepth ?? 1.9),
      lo2 = onRoof(c, i, 1, S.trussDepth ?? 1.9);
    chord(up, up2);
    chord(lo, lo2);
    if (i % 2) chord(up, lo2, 0.18);
    else chord(lo, up2, 0.18);
    chord(up, lo, 0.16);
    if (i === segs.length - 1) chord(up2, lo2, 0.16);
  });
  for (const side of [-1, 1]) {
    const x = side < 0 ? S.minX + 0.35 : S.maxX - 0.35;
    w.box(0.7, S.eave - S.floor, 0.7, mats.metal, x, (S.eave + S.floor) / 2, z, 0.03, g);
  }
}

// ---- glass: clerestory windows and skylights -------------------------------------------------------------
function glass(c) {
  const { w, g, S, mats, segs, lenZ, mid } = c;
  const panes = [],
    frames = [],
    sky = [],
    shafts = [],
    sunDir = new THREE.Vector3(...w.look.sun[2]).normalize().negate(),
    dir3 = (v) => new THREE.Vector3(v.x, v.y, 0);
  const face = (pos, normal) => pos.clone().add(normal);
  if (!S.noWindows) {
    // Arched clerestory windows down both long walls, with pilasters between them.
    const n = S.windowCount ?? 6,
      pitch = (lenZ - 3.4) / (n - 1),
      wy = S.windowY ?? S.eave - 4.2,
      wh = S.windowHeight ?? 3.2,
      ww = S.windowWidth ?? 2.5,
      pilasterLow = S.low + (S.wainscot ?? 1.5),
      pilasterHigh = S.eave - 0.7;
    for (const side of [-1, 1]) {
      const wallX = side < 0 ? S.minX : S.maxX,
        into = new THREE.Vector3(-side, 0, 0);
      for (let k = 0; k < n; k++) {
        const z = S.minZ + 1.7 + k * pitch,
          pos = new THREE.Vector3(wallX + side * -0.02, wy, z);
        panes.push(orient(archGeo(ww, wh), pos, face(pos, into)));
        frames.push(
          orient(
            archGeo(ww + 0.36, wh + 0.18),
            pos.clone().add(new THREE.Vector3(side * 0.03, -0.09, 0)),
            face(pos, into),
          ),
        );
        w.box(0.08, wh - 0.3, 0.1, mats.trim, wallX + side * -0.05, wy + wh / 2 - 0.15, z, 0.01, g);
        w.box(0.1, 0.1, ww, mats.trim, wallX + side * -0.06, wy + wh * 0.42, z, 0.01, g);
        w.box(0.42, 0.14, ww + 0.5, mats.trim, wallX + side * -0.16, wy - 0.16, z, 0.03, g);
        if (k < n - 1)
          w.box(
            0.3,
            pilasterHigh - pilasterLow,
            0.42,
            mats.trim,
            wallX + side * -0.15,
            (pilasterHigh + pilasterLow) / 2,
            z + pitch / 2,
            0.03,
            g,
          );
        if (side < 0 && k % 2 === 0 && S.wallShafts !== false)
          shafts.push([new THREE.Vector3(wallX + 0.1, wy + wh * 0.5, z), 2.1]);
      }
    }
    // Round windows high in both gables.
    if (S.oculus) {
      for (const z of [S.minZ + 0.03, S.maxZ - 0.03]) {
        const normal = new THREE.Vector3(0, 0, z < 0 ? 1 : -1),
          r = S.oculus,
          pos = new THREE.Vector3(mid, S.oculusY ?? S.eave + (S.ridge - S.eave) * 0.4, z);
        panes.push(orient(new THREE.CircleGeometry(r, 28), pos, face(pos, normal)));
        frames.push(orient(new THREE.TorusGeometry(r + 0.12, 0.12, 6, 32), pos, face(pos, normal)));
        for (let s = 0; s < 4; s++) {
          const bar = new THREE.BoxGeometry(r * 2, 0.1, 0.1).rotateZ((s * Math.PI) / 4);
          frames.push(orient(bar, pos, face(pos, normal)));
          bar.dispose();
        }
      }
    }
  }
  // Skylights set into the roof between the trusses.
  if (S.skylights) {
    const bays = S.stations.slice(1).map((z, i) => (z + S.stations[i]) / 2),
      indices =
        S.profile === "arch"
          ? segs.map((_, i) => i).filter((i) => i % 2 === 1 && i > 1 && i < segs.length - 2)
          : [0, 1],
      shaftSegments = S.shaftSegments ?? [0];
    for (const i of indices) {
      const s = segs[i],
        p = onRoof(c, i, 0.5, 0.2),
        size = S.skylightSize || [3.2, Math.min(3, s.length * 0.7)];
      for (const z of bays) {
        const pos = new THREE.Vector3(p.x, p.y, z),
          look = new THREE.Vector3(p.x + s.n.x, p.y + s.n.y, z);
        sky.push(orient(new THREE.PlaneGeometry(size[0], size[1]), pos, look));
        frames.push(
          orient(
            new THREE.PlaneGeometry(size[0] + 0.3, size[1] + 0.3),
            pos.clone().addScaledVector(dir3(s.n), -0.035),
            look,
          ),
        );
        if (shaftSegments.includes(i)) shafts.push([pos.clone().addScaledVector(dir3(s.n), 0.3), 2.7]);
      }
    }
  }
  const frameMat = new THREE.MeshStandardMaterial({
    color: S.colors.trim,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const addGlass = (list, material) => {
    if (!list.length) return;
    const m = new THREE.Mesh(mergeGeos(list), material);
    g.add(m);
    (w.windowGlass ||= []).push(m);
    c.hall.glass.push(m);
  };
  addGlass(panes, mats.pane);
  addGlass(sky, mats.skylight);
  if (frames.length) g.add(new THREE.Mesh(mergeGeos(frames), frameMat));
  // Light shafts: two crossed additive quads, from the glass down to the deck along the light's own direction.
  const beams = [],
    down = new THREE.Vector3(0, -1, 0);
  for (const [from, width] of shafts) {
    const length = Math.min(from.y / Math.max(0.25, -sunDir.y), S.shaftLength ?? 26),
      quad = new THREE.PlaneGeometry(width, length),
      center = from.clone().addScaledVector(sunDir, length / 2);
    for (const roll of [0, Math.PI / 2]) {
      const q = new THREE.Quaternion().setFromUnitVectors(down, sunDir);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll));
      beams.push(
        quad.clone().applyMatrix4(new THREE.Matrix4().compose(center, q, new THREE.Vector3(1, 1, 1))),
      );
    }
    quad.dispose();
  }
  if (beams.length) {
    const m = new THREE.Mesh(mergeGeos(beams), mats.beam);
    m.renderOrder = 3;
    g.add(m);
    const base = mats.beam.opacity;
    c.hall.dimmers.push((k) => (c.hall.light = Math.min(1, k)));
    c.hall.animators.push(
      (time) => (mats.beam.opacity = base * c.hall.light * (0.88 + 0.12 * Math.sin(time * 0.6))),
    );
  }
}
