// The main menu's stage (20 October 2026): a new venue, the Old Town Baths, at five to seven in the morning, a moment before
// the doors open. One static camera looks down the dark pool at the far wall: a painted wall (assets/menu/hall-wall.webp,
// generated), a real 3D deck in front of it where Coach Waters paces slowly right and left, light shafts from the windows,
// dust in them, and the pool in the foreground with a layer of black on it that still mirrors the wall and the coach. START,
// once the shift is chosen, has the coach walk to the doors and open them: the light floods in and the shift begins.
//
// Behind the doors (21 October 2026, the creator: "make this a reality"): the doorway is cut out of the painting and the first
// guests wait outside in the morning light, real characters (`GUESTS`: the five swimmers, the fish kid with his bucket, Marco
// and Karen) on their own waiting clips, shuffling, checking a watch, complaining at the door. Through the frosted glass they
// are only shadows: each frame the guests are drawn alone, black on white, into a small target from the camera (the mask), and
// the glass of the doors reads it blurred, dark where a guest stands. When the doors open they are there as they are.
//
// It draws with the game's own renderer (PoolWorld's), in place of the venue while the menu is up, and owns nothing of the
// game: no simulation, no state of a shift. Without the coach's model the stage plays without him.
import { THREE } from "./kit.mjs";
import { CLIPS, WALK_SPEED, RUN_SPEED } from "./coach-model.mjs";

// The painting: 2048 × 1152, its floor line at y = 1080, 5.8 m tall in the world, centred on x = 0, standing on the deck.
const IMG = { w: 2048, h: 1152, floor: 1080 };
const PX = 5.8 / IMG.h;
const wx = (x) => (x - IMG.w / 2) * PX;
const wy = (y) => (IMG.floor - y) * PX;
const WALL = { w: IMG.w * PX, top: wy(0), bottom: wy(IMG.h) };
// The doors' two leaves, measured on the painting, the glass in each (frosted, the guests' shadows on it) and the height of
// their push bars.
const LEAVES = { left: 786, split: 1023, right: 1260, top: 560, bottom: 1080 };
const GLASS = [
  [805, 580, 1002, 1030],
  [1042, 580, 1238, 1030],
];
const BAR_Y = 870;
// The windows the morning comes through (their glass), for the light shafts.
const WINDOWS = [
  { x0: 160, x1: 405, y0: 365, y1: 845, k: 1 },
  { x0: 1620, x1: 1860, y0: 365, y1: 845, k: 1 },
  { x0: 865, x1: 1135, y0: 85, y1: 390, k: 0.8 },
];
const HALL = { half: 5.6, deck: 2.9, water: -0.2, poolHalf: 4.3, far: 18, ceiling: WALL.top };
// The coach's walk: along the deck, a step in front of the doors.
const PACE = { z: 1.35, left: -2.7, right: 2.7, speed: 0.78 };
const DOOR_SPOT = { x: 0, z: 0.85 };
const COACH_SCALE = 1.08;
// The first guests, waiting outside for seven o'clock: who (a swimmer's id in swimmer-models.mjs, "kid" and "marco" its figures,
// "karen"), where (from the doors' middle, z behind them), facing (0: the doors), the clip they wait with (`idle`), the ones they
// play once now and then (`extras`), and the one a shuffle walks with. The clips are the ones they wait with in a shift's queue.
export const GUESTS = [
  { id: "woman", x: -0.9, z: -0.55, angle: 0.25, idle: "IdleScan", extras: ["IdleScratch"], walk: "Walk" },
  { id: "heavy-man", x: -0.48, z: -1.1, angle: 0.1, idle: "IdleScan", extras: ["IdleScratch"], walk: "Walk" },
  { id: "kid", x: -0.38, z: -0.32, angle: -0.15, idle: "CarryIdle", extras: [], walk: "CarryWalk" },
  { id: "boy", x: 0.22, z: -0.62, angle: -0.1, idle: "IdleScan", extras: ["IdleScratch"], walk: "Walk" },
  {
    id: "tall-woman",
    x: 0.68,
    z: -1.02,
    angle: -0.3,
    idle: "IdleScan",
    extras: ["IdleScratch"],
    walk: "Walk",
  },
  {
    id: "marco",
    x: 0.02,
    z: -1.55,
    angle: 0,
    idle: "IdleScan",
    extras: ["WaitWatch", "WaitWatch"],
    walk: "Walk",
  },
  {
    id: "karen",
    x: 0.92,
    z: -0.42,
    angle: -0.35,
    idle: "Idle",
    extras: ["Complain", "Point", "Complain"],
    walk: "Walk",
    scale: 0.97,
  },
];
// The doors' times once the coach is at them (seconds): they swing open, the guests step up, the light fills the screen.
const OPEN = { swing: 1.3, step: 0.45, flash: [1.75, 2.45], then: 2.5 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---- textures drawn here (no files) --------------------------------------------------------------------------------

function canvasTexture(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}
// A deterministic wobble, so every load draws the same tiles.
const jitter = (i) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
function tiles(g, x, y, w, h, size, base, grout, spread = 10) {
  g.fillStyle = grout;
  g.fillRect(x, y, w, h);
  let k = 0;
  for (let ty = y; ty < y + h; ty += size)
    for (let tx = x; tx < x + w; tx += size) {
      const v = (jitter(k++) - 0.5) * spread;
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v * 0.8})`;
      g.fillRect(tx + 2, ty + 2, size - 3, size - 3);
    }
}
// The deck: cream 30 cm tiles (the texture holds four by four).
const deckTexture = () =>
  canvasTexture(512, 512, (g, w, h) => tiles(g, 0, 0, w, h, 128, [214, 196, 166], "#9d8e78", 14));
// The side walls, floor to ceiling (1.2 m of wall a repeat): teal tiles to 1.7 m, a cream band, then cream tiles.
const sideTexture = () =>
  canvasTexture(256, 1280, (g, w, h) => {
    const m = h / HALL.ceiling; // pixels a metre
    const band = h - 1.7 * m;
    tiles(g, 0, 0, w, band, 42, [205, 196, 178], "#a39985", 8);
    g.fillStyle = "#cbbf9f";
    g.fillRect(0, band - 22, w, 22);
    tiles(g, 0, band, w, h - band, 64, [30, 104, 104], "#164946", 12);
  });

// ---- the painted wall's shader ---------------------------------------------------------------------------------------
// The painting as it is where it is bright (the windows, the doors' glow), shaded where it is not: darker up high and
// towards the corners, warmer and brighter round the doors (more so as they open).
const WALL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const WALL_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform float uOpen;
  uniform float uDim;
  uniform float uLeaf; // 0: the wall, with the doorway cut out; 1: a door leaf, its glass frosted
  uniform sampler2D tMask; // the guests from the camera, black on white
  uniform mat4 uMaskView; // the camera that drew it
  uniform vec2 uMaskTexel;
  uniform float uMasked; // 0 until there are guests to draw
  varying vec2 vUv;
  varying vec3 vWorld;
  float box(vec2 p, vec4 r, float soft) {
    vec2 a = smoothstep(r.xy, r.xy + soft, p) * (1.0 - smoothstep(r.zw - soft, r.zw, p));
    return a.x * a.y;
  }
  void main() {
    vec2 px = vec2(vUv.x * 2048.0, (1.0 - vUv.y) * 1152.0);
    if (uLeaf < 0.5 && px.x > 786.0 && px.x < 1260.0 && px.y > 560.0 && px.y < 1080.0) discard;
    vec3 tex = texture2D(map, vUv).rgb;
    float lum = dot(tex, vec3(0.299, 0.587, 0.114));
    float side = pow(clamp(abs(vWorld.x) / 5.2, 0.0, 1.0), 1.6);
    float high = clamp((vWorld.y - 2.6) / 3.0, 0.0, 1.0);
    float shade = 0.86 - 0.34 * side - 0.3 * high;
    vec2 d = vec2(vWorld.x / 2.4, (vWorld.y - 1.2) / 2.2);
    float halo = exp(-dot(d, d));
    shade += halo * (0.14 + 0.9 * uOpen);
    shade *= uDim;
    vec3 warm = vec3(1.0, 0.86, 0.68);
    vec3 lit = tex * shade * mix(vec3(1.0), warm, halo * (0.35 + 0.65 * uOpen));
    vec3 color = mix(lit, tex * (0.92 + 0.5 * uOpen), smoothstep(0.62, 0.86, lum));
    if (uLeaf > 0.5) {
      // Frosted glass lit from behind by the morning: the mask read where this point of the glass is on the screen, blurred
      // over a ring of taps, dark where a guest stands. Its colours are the painting's: a warm cream, more orange low down,
      // and the shadows a deep brown.
      float glass = max(box(px, vec4(805.0, 580.0, 1002.0, 1030.0), 3.0), box(px, vec4(1042.0, 580.0, 1238.0, 1030.0), 3.0));
      if (glass > 0.0) {
        vec4 clip = uMaskView * vec4(vWorld, 1.0);
        vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
        float m = 0.0;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 2.399963;
          float r = (0.35 + float(i) / 12.0) * 2.2;
          m += texture2D(tMask, suv + vec2(cos(a), sin(a)) * r * uMaskTexel).r;
        }
        m = mix(1.0, m / 12.0, uMasked);
        float h = clamp((px.y - 580.0) / 450.0, 0.0, 1.0);
        vec3 light = mix(vec3(0.955, 0.855, 0.61), vec3(0.87, 0.61, 0.305), h);
        vec3 shadow = light * vec3(0.27, 0.2, 0.17);
        float grain = fract(sin(dot(floor(px * 1.5), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        vec3 g = mix(shadow, light, smoothstep(0.18, 0.88, m)) * (1.0 + 0.05 * grain) * (1.0 + 0.3 * uOpen) * uDim;
        color = mix(color, g, glass);
      }
    }
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

// ---- the water ----------------------------------------------------------------------------------------------------
// A planar mirror (the hall drawn again from under the water, into a half-size target) seen through a layer of black: a
// slow, small swell bends it, the Fresnel term lets it show most at a glance, and the doors' light lies on it when they open.
const WATER_VERTEX = /* glsl */ `
  uniform mat4 uMirror;
  varying vec4 vMirror;
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vMirror = uMirror * w;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const WATER_FRAGMENT = /* glsl */ `
  uniform sampler2D tMirror;
  uniform float uTime;
  uniform float uOpen;
  uniform float uDim;
  uniform vec3 uDeep;
  uniform vec3 uSurface;
  varying vec4 vMirror;
  varying vec3 vWorld;
  vec2 swell(vec2 p, float t) {
    vec2 n = vec2(0.0);
    n += vec2(cos(p.x * 1.7 + t * 0.9), 0.0) * 0.5;
    n += vec2(0.0, cos(p.y * 2.3 - t * 0.7)) * 0.6;
    n += vec2(cos((p.x + p.y) * 3.1 + t * 1.3), cos((p.x - p.y) * 2.7 - t * 1.1)) * 0.28;
    n += vec2(cos(p.x * 7.0 - p.y * 5.0 + t * 2.1), cos(p.y * 6.3 + p.x * 3.0 + t * 1.7)) * 0.1;
    return n;
  }
  void main() {
    vec2 n = swell(vWorld.xz, uTime);
    vec3 view = normalize(cameraPosition - vWorld);
    vec3 normal = normalize(vec3(n.x * 0.05, 1.0, n.y * 0.05));
    float fresnel = 0.12 + 0.88 * pow(1.0 - max(dot(view, normal), 0.0), 4.0);
    vec2 uv = vMirror.xy / vMirror.w + normal.xz * 0.35 / max(1.0, vMirror.w * 0.25);
    vec3 mirror = texture2D(tMirror, uv).rgb;
    // A layer of black over the pool: deep near the camera, the mirror taking over towards the far end.
    float far = smoothstep(14.0, 3.0, vWorld.z);
    vec3 color = uDeep + mirror * mix(0.32, 0.7, fresnel) * (0.55 + 0.45 * far);
    // The faint sheen of the room on the swell, and a glint of the doors' light when they open.
    float glint = pow(max(dot(reflect(-view, normal), normalize(vec3(0.0, 0.35, -1.0))), 0.0), 60.0);
    color += uSurface * (0.03 + 0.04 * n.x) + vec3(1.0, 0.8, 0.55) * glint * (0.25 + 2.5 * uOpen);
    gl_FragColor = vec4(color * uDim, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ---- light shafts and dust ------------------------------------------------------------------------------------------
const SHAFT_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SHAFT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float across = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
    float along = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.05, vUv.y);
    float flicker = 0.85 + 0.15 * sin(uTime * 0.35 + vUv.x * 7.0) * sin(uTime * 0.21 + vUv.y * 3.0);
    gl_FragColor = vec4(uColor * across * along * flicker * uStrength, 1.0);
  }
`;
const DUST_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  attribute float seed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float t = uTime * (0.05 + seed * 0.05);
    p.x += sin(t * 2.0 + seed * 40.0) * 0.35;
    p.y += mod(t * 0.6 + seed * 9.0, 1.0) * 0.6 - 0.3;
    p.z += cos(t * 1.4 + seed * 17.0) * 0.3;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Brighter in the morning light, close to the windows and the doors.
    float lit = exp(-pow(p.z - 1.6, 2.0) / 6.0) * smoothstep(0.0, 1.2, p.y);
    vAlpha = (0.25 + 0.75 * lit) * (0.5 + 0.5 * sin(uTime * (0.6 + seed) + seed * 30.0));
    gl_PointSize = uScale * (0.6 + seed) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const DUST_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(c));
    gl_FragColor = vec4(uColor * a * vAlpha * uStrength, 1.0);
  }
`;
const DUST_LAYER = 2; // (not drawn into the water's mirror)

// A sheet of light from the edge of a window (y, from x0 to x1) along `dir`, `length` metres.
function shaftSheet(x0, x1, y, dir, length) {
  const g = new THREE.BufferGeometry();
  const a = new THREE.Vector3(x0, y, 0.03),
    b = new THREE.Vector3(x1, y, 0.03),
    c = a.clone().addScaledVector(dir, length),
    d = b.clone().addScaledVector(dir, length);
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [...a, ...b, ...c, ...d].flatMap((v) => v),
      3,
    ),
  );
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  return g;
}

export class MenuStage {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05090b);
    this.camera = new THREE.PerspectiveCamera(37, 16 / 9, 0.1, 60);
    this.camera.layers.enable(DUST_LAYER);
    this.mirrorCamera = new THREE.PerspectiveCamera();
    this.mirrorMatrix = new THREE.Matrix4();
    this.mirrorTarget = null;
    this.clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -HALL.water)];
    this.time = 0;
    this.exposure = 1.05;
    this.brightness = 1;
    // How far the view is slid right (a share of the screen's width) to leave the menu's column the left: the app says how
    // far (`framing`), the camera glides there (and back to the middle when the doors open).
    this.framing = 0;
    this.slide = 0;
    this.open = null; // the doors opening: {t, then, stage}
    this.coach = null;
    this.guests = [];
    this.mask = null; // the guests' mask target, sized on the first draw
    this.maskScene = new THREE.Scene();
    this.maskMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.maskView = new THREE.Matrix4();
    this.ready = false;
    this.disposables = [this.maskMaterial];
  }

  // Fetches the painting and, when it is loaded, uses the coach's model (`coachTemplate`, from coach-model.mjs). Resolves when
  // the stage can be drawn; the guests come as their models arrive (`addGuest`).
  async load(coachTemplate = null) {
    const loader = new THREE.TextureLoader();
    const base = new URL("../assets/menu/", import.meta.url).href;
    const get = (name) =>
      loader.loadAsync(base + name).then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        this.disposables.push(t);
        return t;
      });
    const wall = await get("hall-wall.webp");
    this.build(wall);
    if (coachTemplate) this.addCoach(coachTemplate);
    this.ready = true;
    return this;
  }

  own(x) {
    this.disposables.push(x);
    return x;
  }

  build(wallTexture) {
    const s = this.scene;
    // The painted wall, standing on the deck at z = 0, the doorway cut out of it; the doors' leaves share its painting and its
    // light (the uniforms are the same objects) and frost their glass.
    const shared = {
      map: { value: wallTexture },
      uOpen: { value: 0 },
      uDim: { value: 1 },
      tMask: { value: null },
      uMaskView: { value: this.maskView },
      uMaskTexel: { value: new THREE.Vector2(1 / 256, 1 / 256) },
      uMasked: { value: 0 },
    };
    this.shared = shared;
    this.wallMaterial = this.own(
      new THREE.ShaderMaterial({
        uniforms: { ...shared, uLeaf: { value: 0 } },
        vertexShader: WALL_VERTEX,
        fragmentShader: WALL_FRAGMENT,
      }),
    );
    this.leafMaterial = this.own(
      new THREE.ShaderMaterial({
        uniforms: { ...shared, uLeaf: { value: 1 } },
        vertexShader: WALL_VERTEX,
        fragmentShader: WALL_FRAGMENT,
      }),
    );
    const wallGeo = this.own(new THREE.PlaneGeometry(WALL.w, WALL.top - WALL.bottom));
    const wall = new THREE.Mesh(wallGeo, this.wallMaterial);
    wall.position.set(0, (WALL.top + WALL.bottom) / 2, 0);
    s.add(wall);

    // The deck, the side decks and the pool's edge.
    const deckMap = this.own(deckTexture());
    const deckMat = this.own(
      new THREE.MeshStandardMaterial({ map: deckMap, roughness: 0.32, metalness: 0, color: 0xe6dccb }),
    );
    const deckGeo = this.own(new THREE.PlaneGeometry(HALL.half * 2, HALL.deck));
    deckMap.repeat.set((HALL.half * 2) / 1.2, HALL.deck / 1.2);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(0, 0, HALL.deck / 2);
    deck.receiveShadow = true;
    s.add(deck);
    const sideW = HALL.half - HALL.poolHalf,
      sideL = HALL.far - HALL.deck;
    for (const sign of [-1, 1]) {
      const sideMap = this.own(deckTexture());
      sideMap.repeat.set(sideW / 1.2, sideL / 1.2);
      const side = new THREE.Mesh(
        this.own(new THREE.PlaneGeometry(sideW, sideL)),
        this.own(new THREE.MeshStandardMaterial({ map: sideMap, roughness: 0.4, color: 0xd8cdbb })),
      );
      side.rotation.x = -Math.PI / 2;
      side.position.set(sign * (HALL.poolHalf + sideW / 2), 0, HALL.deck + sideL / 2);
      side.receiveShadow = true;
      s.add(side);
    }
    const stone = this.own(new THREE.MeshStandardMaterial({ color: 0xece3d2, roughness: 0.5 }));
    const coping = new THREE.Mesh(
      this.own(new THREE.BoxGeometry(HALL.poolHalf * 2 + 0.3, 0.08, 0.32)),
      stone,
    );
    coping.position.set(0, 0.0, HALL.deck + 0.12);
    coping.receiveShadow = true;
    s.add(coping);
    for (const sign of [-1, 1]) {
      const rim = new THREE.Mesh(this.own(new THREE.BoxGeometry(0.3, 0.08, sideL)), stone);
      rim.position.set(sign * (HALL.poolHalf + 0.0), 0.0, HALL.deck + sideL / 2);
      s.add(rim);
    }
    // The tiled face of the pool's end wall, between the coping and the water.
    const tileFace = new THREE.Mesh(
      this.own(new THREE.PlaneGeometry(HALL.poolHalf * 2, -HALL.water + 0.05)),
      this.own(new THREE.MeshStandardMaterial({ color: 0x2c7c80, roughness: 0.3 })),
    );
    tileFace.position.set(0, HALL.water / 2 - 0.02, HALL.deck + 0.28);
    s.add(tileFace);

    // The side walls and the ceiling: tiles in the half-dark.
    for (const sign of [-1, 1]) {
      const map = this.own(sideTexture());
      map.repeat.set(HALL.far / 1.2, 1);
      const wallSide = new THREE.Mesh(
        this.own(new THREE.PlaneGeometry(HALL.far, HALL.ceiling)),
        this.own(new THREE.MeshStandardMaterial({ map, roughness: 0.55, color: 0x9aa2a0 })),
      );
      wallSide.rotation.y = -sign * (Math.PI / 2);
      wallSide.position.set(sign * HALL.half, HALL.ceiling / 2, HALL.far / 2);
      wallSide.receiveShadow = true;
      s.add(wallSide);
    }
    const ceiling = new THREE.Mesh(
      this.own(new THREE.PlaneGeometry(HALL.half * 2, HALL.far)),
      this.own(new THREE.MeshStandardMaterial({ color: 0x1b2a2c, roughness: 0.9 })),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, HALL.ceiling, HALL.far / 2);
    s.add(ceiling);
    // Where the painted wall meets the side walls and the ceiling: a pilaster and a beam hide the seams.
    const trim = this.own(new THREE.MeshStandardMaterial({ color: 0x23484a, roughness: 0.6 }));
    for (const sign of [-1, 1]) {
      const pilaster = new THREE.Mesh(this.own(new THREE.BoxGeometry(0.5, HALL.ceiling, 0.4)), trim);
      pilaster.position.set(sign * (HALL.half - 0.25), HALL.ceiling / 2, 0.2);
      pilaster.castShadow = pilaster.receiveShadow = true;
      s.add(pilaster);
    }

    // The lane ropes: three, floating, beads of blue and cream, red for the last five metres.
    const bead = this.own(new THREE.SphereGeometry(0.075, 10, 6));
    bead.scale(1, 0.75, 1.5);
    const beadMat = this.own(new THREE.MeshStandardMaterial({ roughness: 0.35 }));
    const ropeX = [-HALL.poolHalf / 2, 0, HALL.poolHalf / 2];
    const perRope = Math.floor((HALL.far - HALL.deck - 0.4) / 0.2);
    this.ropes = new THREE.InstancedMesh(bead, beadMat, ropeX.length * perRope);
    this.ropes.receiveShadow = true;
    this.ropeBeads = [];
    const m = new THREE.Matrix4(),
      color = new THREE.Color();
    let i = 0;
    for (const x of ropeX)
      for (let k = 0; k < perRope; k++) {
        const z = HALL.deck + 0.45 + k * 0.2;
        this.ropeBeads.push({ x, z, k });
        m.makeTranslation(x, HALL.water + 0.03, z);
        this.ropes.setMatrixAt(i, m);
        const red = z < HALL.deck + 5;
        color.set(red ? (k % 2 ? 0xc8443a : 0xe9e2d2) : k % 2 ? 0x2c6fa8 : 0xe9e2d2);
        this.ropes.setColorAt(i, color);
        i++;
      }
    s.add(this.ropes);

    // The water: the mirror's target is sized on the first draw.
    this.waterMaterial = this.own(
      new THREE.ShaderMaterial({
        uniforms: {
          tMirror: { value: null },
          uMirror: { value: this.mirrorMatrix },
          uTime: { value: 0 },
          uOpen: { value: 0 },
          uDim: { value: 1 },
          uDeep: { value: new THREE.Color(0x020708).convertSRGBToLinear() },
          uSurface: { value: new THREE.Color(0x3a6c72).convertSRGBToLinear() },
        },
        vertexShader: WATER_VERTEX,
        fragmentShader: WATER_FRAGMENT,
      }),
    );
    this.water = new THREE.Mesh(
      this.own(new THREE.PlaneGeometry(HALL.poolHalf * 2, HALL.far)),
      this.waterMaterial,
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, HALL.water, HALL.deck + HALL.far / 2);
    s.add(this.water);

    // The doors: two leaves cut from the painting, on hinges at their outer edges, glass both sides, a brass push bar across
    // each; and the morning behind them, where the guests wait (`buildOutside`).
    const leafDepth = 0.05;
    const gold = this.own(
      new THREE.MeshStandardMaterial({ color: 0x9a7a3a, roughness: 0.4, metalness: 0.6 }),
    );
    const brass = this.own(
      new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.3, metalness: 0.85 }),
    );
    const leafHeight = wy(LEAVES.top);
    this.leaves = [];
    for (const [from, to, hinge] of [
      [LEAVES.left, LEAVES.split, LEAVES.left],
      [LEAVES.split, LEAVES.right, LEAVES.right],
    ]) {
      const width = (to - from) * PX;
      const geo = this.own(new THREE.BoxGeometry(width, leafHeight, leafDepth));
      const uv = geo.attributes.uv;
      const u0 = from / IMG.w,
        u1 = to / IMG.w,
        v0 = 1 - LEAVES.bottom / IMG.h,
        v1 = 1 - LEAVES.top / IMG.h;
      for (let j = 16; j < 24; j++) uv.setXY(j, u0 + uv.getX(j) * (u1 - u0), v0 + uv.getY(j) * (v1 - v0));
      uv.needsUpdate = true;
      const leaf = new THREE.Mesh(geo, [gold, gold, gold, gold, this.leafMaterial, this.leafMaterial]);
      const pivot = new THREE.Group();
      const left = hinge === from;
      pivot.position.set(wx(hinge), 0, leafDepth / 2 + 0.012);
      leaf.position.set(((left ? 1 : -1) * width) / 2, leafHeight / 2, 0);
      pivot.add(leaf);
      // The push bar, across the glass on both faces, on two little posts.
      const [gx0, , gx1] = GLASS[left ? 0 : 1];
      const barLength = (gx1 - gx0) * PX - 0.04,
        barX = (wx((gx0 + gx1) / 2) - wx(hinge)) * 1,
        barY = wy(BAR_Y);
      for (const side of [1, -1]) {
        const bar = new THREE.Mesh(this.own(new THREE.CylinderGeometry(0.016, 0.016, barLength, 10)), brass);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(barX, barY, side * (leafDepth / 2 + 0.05));
        pivot.add(bar);
        for (const end of [-1, 1]) {
          const post = new THREE.Mesh(this.own(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8)), brass);
          post.rotation.x = Math.PI / 2;
          post.position.set(barX + (end * barLength) / 2.3, barY, side * (leafDepth / 2 + 0.025));
          pivot.add(post);
        }
      }
      pivot.userData.sign = left ? -1 : 1;
      s.add(pivot);
      this.leaves.push(pivot);
    }
    this.buildOutside(leafHeight);

    // Light: a cool, dim room; warm morning from behind the doors and through the windows.
    this.ambient = new THREE.HemisphereLight(0x8fb4c0, 0x1c1814, 0.55);
    s.add(this.ambient);
    this.fill = new THREE.DirectionalLight(0x9cc4e0, 0.55);
    this.fill.position.set(-3, 5, 14);
    s.add(this.fill);
    // The morning behind the doors: it lights the guests from behind (their shadows on the glass) and, through the doorway,
    // the deck. When the doors open a warm fill from the hall shows the guests' faces.
    this.doorSpot = new THREE.SpotLight(0xffc98a, 30, 16, 0.95, 0.85, 1.6);
    this.doorSpot.position.set(0, 2.9, -3.4);
    this.doorSpot.target.position.set(0, 0, 4.5);
    this.doorSpot.castShadow = true;
    this.doorSpot.shadow.mapSize.set(1024, 1024);
    this.doorSpot.shadow.bias = -0.0004;
    this.doorSpot.shadow.radius = 4;
    s.add(this.doorSpot, this.doorSpot.target);
    this.guestFill = new THREE.SpotLight(0xffe6c8, 0, 9, 0.55, 0.7, 1.4);
    this.guestFill.position.set(0, 2.3, 2.2);
    this.guestFill.target.position.set(0, 1.0, -1.0);
    s.add(this.guestFill, this.guestFill.target);
    this.windowSpots = [];
    for (const w of WINDOWS.slice(0, 2)) {
      const spot = new THREE.SpotLight(0xffb98a, 9, 12, 0.7, 0.9, 1.6);
      const x = wx((w.x0 + w.x1) / 2);
      spot.position.set(x, wy(w.y0), -0.8);
      spot.target.position.set(x * 1.05, 0, 3.6);
      s.add(spot, spot.target);
      this.windowSpots.push(spot);
    }
    // The light that leaks under the doors and lies on the deck in front of them.
    const pool = canvasTexture(256, 256, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, h);
      r.addColorStop(0, "rgba(255,214,150,1)");
      r.addColorStop(0.35, "rgba(255,190,120,0.35)");
      r.addColorStop(1, "rgba(255,180,110,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, w, h);
    });
    pool.wrapS = pool.wrapT = THREE.ClampToEdgeWrapping;
    this.own(pool);
    this.floorGlow = new THREE.Mesh(
      this.own(new THREE.PlaneGeometry(4.2, 2.6)),
      this.own(
        new THREE.MeshBasicMaterial({
          map: pool,
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      ),
    );
    this.floorGlow.rotation.x = -Math.PI / 2;
    this.floorGlow.position.set(0, 0.004, 1.3);
    s.add(this.floorGlow);

    // The shafts from the windows: low morning sun, coming in towards the pool and down.
    const dir = new THREE.Vector3(0.08, -0.42, 1).normalize();
    this.shaftMaterial = this.own(
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0xffc690) },
          uStrength: { value: 0.16 },
          uTime: { value: 0 },
        },
        vertexShader: SHAFT_VERTEX,
        fragmentShader: SHAFT_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    for (const w of WINDOWS) {
      const x0 = wx(w.x0),
        x1 = wx(w.x1);
      for (const y of [wy(w.y0) - 0.15, wy(w.y1) + 0.1]) {
        const reach = y / 0.42 + 1.2;
        const sheet = new THREE.Mesh(this.own(shaftSheet(x0, x1, y, dir, reach)), this.shaftMaterial);
        sheet.renderOrder = 2;
        s.add(sheet);
      }
    }

    // Dust in the air.
    const n = 520,
      pos = new Float32Array(n * 3),
      seed = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      pos[k * 3] = (jitter(k + 1) - 0.5) * 9;
      pos[k * 3 + 1] = 0.2 + jitter(k + 1000) * 4.6;
      pos[k * 3 + 2] = 0.2 + jitter(k + 2000) * 7;
      seed[k] = jitter(k + 3000);
    }
    const dustGeo = this.own(new THREE.BufferGeometry());
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dustGeo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    this.dustMaterial = this.own(
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 60 },
          uColor: { value: new THREE.Color(0xffe2b8) },
          uStrength: { value: 0.55 },
        },
        vertexShader: DUST_VERTEX,
        fragmentShader: DUST_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.dust = new THREE.Points(dustGeo, this.dustMaterial);
    this.dust.layers.set(DUST_LAYER);
    this.dust.frustumCulled = false;
    s.add(this.dust);
  }

  // ---- behind the doors ------------------------------------------------------------------------------------------
  // The doorway's reveal, the paving outside and the morning: a bright sky over the town, drawn here, past the light's reach.
  buildOutside(leafHeight) {
    const out = (this.outside = new THREE.Group());
    this.scene.add(out);
    const paving = this.own(
      canvasTexture(512, 512, (g, w, h) => tiles(g, 0, 0, w, h, 128, [196, 182, 160], "#8f826e", 18), [4, 4]),
    );
    const floor = new THREE.Mesh(
      this.own(new THREE.PlaneGeometry(8, 7)),
      this.own(new THREE.MeshStandardMaterial({ map: paving, roughness: 0.7, color: 0xe8dcc6 })),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -3.5);
    floor.receiveShadow = true;
    out.add(floor);
    const reveal = this.own(new THREE.MeshStandardMaterial({ color: 0xd8ccb2, roughness: 0.6 })),
      depth = 0.32;
    for (const x of [wx(LEAVES.left) - 0.06, wx(LEAVES.right) + 0.06]) {
      const jamb = new THREE.Mesh(this.own(new THREE.BoxGeometry(0.12, leafHeight + 0.14, depth)), reveal);
      jamb.position.set(x, (leafHeight + 0.14) / 2, -depth / 2 - 0.002);
      out.add(jamb);
    }
    const lintel = new THREE.Mesh(
      this.own(new THREE.BoxGeometry((LEAVES.right - LEAVES.left) * PX + 0.24, 0.14, depth)),
      reveal,
    );
    lintel.position.set(wx((LEAVES.left + LEAVES.right) / 2), leafHeight + 0.07, -depth / 2 - 0.002);
    out.add(lintel);
    const sky = this.own(
      canvasTexture(512, 512, (g, w, h) => {
        const v = g.createLinearGradient(0, 0, 0, h);
        v.addColorStop(0, "#ffe9c9");
        v.addColorStop(0.55, "#fff5e3");
        v.addColorStop(0.7, "#fffaf0");
        v.addColorStop(1, "#f3dcb8");
        g.fillStyle = v;
        g.fillRect(0, 0, w, h);
        const sun = g.createRadialGradient(w * 0.55, h * 0.62, 0, w * 0.55, h * 0.62, w * 0.35);
        sun.addColorStop(0, "rgba(255,255,250,1)");
        sun.addColorStop(1, "rgba(255,250,235,0)");
        g.fillStyle = sun;
        g.fillRect(0, 0, w, h);
        // The far roofs of the town, faint in the haze.
        g.fillStyle = "rgba(214,178,140,0.45)";
        let x = 0;
        for (let k = 0; x < w; k++) {
          const bw = 30 + jitter(k + 50) * 60,
            bh = 40 + jitter(k + 90) * 70;
          g.fillRect(x, h * 0.7 - bh, bw, bh);
          x += bw + 4;
        }
      }),
    );
    sky.wrapS = sky.wrapT = THREE.ClampToEdgeWrapping;
    this.skyMaterial = this.own(new THREE.MeshBasicMaterial({ map: sky, toneMapped: false }));
    const backdrop = new THREE.Mesh(this.own(new THREE.PlaneGeometry(18, 10)), this.skyMaterial);
    backdrop.position.set(0, 3.4, -7);
    out.add(backdrop);
    this.guestGroup = new THREE.Group();
    out.add(this.guestGroup);
  }
  // A guest whose model has arrived (`template`: {scene, clips, clone}, as swimmer-models.mjs and coach-model.mjs keep them).
  addGuest(spec, template) {
    if (!this.ready || !template?.scene || this.guests.some((g) => g.spec.id === spec.id)) return null;
    const model = template.clone(template.scene);
    const root = new THREE.Group();
    root.scale.setScalar(COACH_SCALE * (spec.scale || 1));
    root.add(model);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false; // (until the doors open: frosted glass casts no sharp shadows)
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const name of new Set([spec.idle, spec.walk, ...spec.extras])) {
      const clip = template.clips[name];
      if (!clip) continue;
      const action = mixer.clipAction(clip);
      if (spec.extras.includes(name)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      actions[name] = action;
    }
    if (!actions[spec.idle]) return null;
    const g = {
      spec,
      root,
      model,
      mixer,
      actions,
      clip: null,
      x: spec.x,
      z: spec.z,
      angle: spec.angle,
      look: spec.angle,
      mode: "idle",
      wait: 1 + Math.random() * 4,
      speed: 0,
      target: null,
    };
    this.playGuest(g, spec.idle, 0);
    // (not all in step: each starts its loop at a moment of its own)
    actions[spec.idle].time = Math.random() * actions[spec.idle].getClip().duration;
    root.position.set(g.x, 0, g.z);
    root.rotation.y = g.angle;
    this.guestGroup.add(root);
    this.guests.push(g);
    if (this.open?.started) this.guestEnters(g, this.guests.length);
    return g;
  }
  playGuest(g, name, fade = 0.35, rate = 1) {
    const next = g.actions[name] || g.actions[g.spec.idle];
    const key = g.actions[name] ? name : g.spec.idle;
    if (g.clip !== key) {
      const prev = g.actions[g.clip];
      next.reset();
      next.enabled = true;
      next.setEffectiveWeight(1);
      next.play();
      if (prev && fade > 0) next.crossFadeFrom(prev, fade, false);
      else if (prev) prev.stop();
      g.clip = key;
    }
    next.setEffectiveTimeScale(rate);
  }
  // Waiting impatiently: the waiting clip, now and then one of their own (a scratch, a look at the watch, a complaint at the
  // door), a shuffle of a step or two and back, a look round. Math.random: the menu replays nothing.
  updateGuest(g, dt) {
    const s = g.spec;
    if (g.mode === "idle") {
      g.wait -= dt;
      if (g.wait <= 0) {
        const roll = Math.random();
        if (roll < 0.45 && s.extras.length) {
          g.mode = "once";
          this.playGuest(g, s.extras[Math.floor(Math.random() * s.extras.length)], 0.3);
        } else if (roll < 0.75 && g.actions[s.walk]) {
          g.mode = "shuffle";
          g.target = {
            x: s.x + (Math.random() - 0.5) * 0.5,
            z: s.z + (Math.random() - 0.5) * 0.3,
            speed: 0.42,
          };
        } else {
          g.look = s.angle + (Math.random() - 0.5) * 1.1;
          g.wait = 2 + Math.random() * 3;
        }
      }
    } else if (g.mode === "once") {
      const a = g.actions[g.clip];
      if (!a || a.time >= a.getClip().duration - 0.3) {
        g.mode = "idle";
        g.wait = 2.5 + Math.random() * 4.5;
        this.playGuest(g, s.idle, 0.4);
      }
    } else if (g.mode === "shuffle" || g.mode === "enter") {
      if (g.delay > 0) {
        g.delay -= dt;
      } else {
        const t = g.target,
          dx = t.x - g.x,
          dz = t.z - g.z,
          dist = Math.hypot(dx, dz);
        g.look = Math.atan2(dx, dz);
        g.speed += ((dist < 0.03 ? 0 : t.speed) - g.speed) * Math.min(1, dt * 5);
        const move = Math.min(dist, g.speed * dt);
        if (dist > 1e-4) {
          g.x += (dx / dist) * move;
          g.z += (dz / dist) * move;
        }
        this.playGuest(g, s.walk, 0.25, clamp(g.speed / 1.15, 0.4, 1.4));
        if (dist < 0.03) {
          const entered = g.mode === "enter";
          g.speed = 0;
          g.look = entered ? 0 : s.angle + (Math.random() - 0.5) * 0.4;
          g.mode = "idle";
          g.wait = entered ? 99 : 2.5 + Math.random() * 3.5;
          this.playGuest(g, s.idle, 0.35);
        }
      }
    }
    g.angle += clamp(wrapAngle(g.look - g.angle), -dt * 2.2, dt * 2.2);
    g.root.position.set(g.x, 0, g.z);
    g.root.rotation.y = g.angle;
    g.mixer.update(dt);
  }
  // The doors open: everyone turns to them and steps up, a moment apart, and casts a shadow into the hall now.
  guestEnters(g, i) {
    g.mode = "enter";
    g.delay = OPEN.step + i * 0.07 + Math.random() * 0.1;
    g.target = { x: g.x * 0.85, z: g.spec.z + (g.spec.z > -0.8 ? 0.45 : 0.3), speed: 0.9 };
    g.model.traverse((o) => o.isMesh && (o.castShadow = true));
  }
  // The guests alone, black on white, from the camera, into a half-size target: what the frosted glass shows.
  renderMask(renderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(64, Math.round(size.x / 2)),
      h = Math.max(36, Math.round(size.y / 2));
    if (!this.mask) {
      this.mask = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
      this.shared.tMask.value = this.mask.texture;
    } else if (this.mask.width !== w || this.mask.height !== h) this.mask.setSize(w, h);
    this.shared.uMaskTexel.value.set(1 / w, 1 / h);
    this.maskView.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.shared.uMasked.value = this.guests.length ? 1 : 0;
    const before = renderer.getRenderTarget(),
      clear = renderer.getClearColor(new THREE.Color()),
      alpha = renderer.getClearAlpha();
    this.maskScene.add(this.guestGroup);
    this.maskScene.overrideMaterial = this.maskMaterial;
    renderer.setRenderTarget(this.mask);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear();
    if (this.guests.length) renderer.render(this.maskScene, this.camera);
    renderer.setRenderTarget(before);
    renderer.setClearColor(clear, alpha);
    this.outside.add(this.guestGroup);
  }

  // ---- Coach Waters, pacing --------------------------------------------------------------------------------------
  addCoach(template) {
    const model = template.clone(template.scene);
    // (He is drawn at the game's own size: the stage's metres are the game's units.)
    const root = new THREE.Group();
    root.scale.setScalar(COACH_SCALE);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });
    root.add(model);
    this.scene.add(root);
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const key of ["idle", "scratch", "walk", "run"]) {
      const clip = template.clips[CLIPS[key]];
      if (!clip) continue;
      const action = mixer.clipAction(clip);
      if (key === "scratch") {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      actions[key] = action;
    }
    this.coach = {
      root,
      mixer,
      actions,
      clip: null,
      x: PACE.left + 0.4,
      z: PACE.z,
      angle: Math.PI / 2,
      // What he is doing: walking to a spot, turning to an angle, or standing for a while.
      plan: [],
      step: null,
      wait: 0,
      speed: 0,
      rate: 1,
      look: 0,
    };
    this.play("idle", 0);
    this.coach.root.position.set(this.coach.x, 0, this.coach.z);
    this.coach.root.rotation.y = this.coach.angle;
  }
  play(name, fade = 0.35, rate = 1) {
    const c = this.coach,
      next = c.actions[name] || c.actions.idle;
    if (c.clip !== name) {
      const prev = c.actions[c.clip];
      next.reset();
      next.enabled = true;
      next.setEffectiveWeight(1);
      next.play();
      if (prev && fade > 0) next.crossFadeFrom(prev, fade, false);
      else if (prev) prev.stop();
      c.clip = name;
    }
    next.setEffectiveTimeScale(rate);
  }
  // The next few things he does, chosen with Math.random (the menu is not part of any shift and replays nothing).
  planPace() {
    const c = this.coach;
    const toRight = c.x < 0;
    const end = toRight ? PACE.right - Math.random() * 0.5 : PACE.left + Math.random() * 0.5;
    const plan = [];
    // Now and then he stops at the doors on the way and looks at them (and at the clock) for a moment.
    if (Math.random() < 0.35) {
      const mid = (Math.random() - 0.5) * 0.6;
      plan.push({ kind: "walk", x: mid, z: PACE.z });
      plan.push({ kind: "turn", angle: Math.PI + (Math.random() - 0.5) * 0.4 });
      plan.push({ kind: "stand", time: 2.4 + Math.random() * 2 });
    }
    plan.push({ kind: "walk", x: end, z: PACE.z });
    // At the end of the walk he turns to look over the pool, waits, sometimes scratches his head.
    plan.push({ kind: "turn", angle: (toRight ? -1 : 1) * (0.25 + Math.random() * 0.45) });
    plan.push({ kind: "stand", time: 2.6 + Math.random() * 3, scratch: Math.random() < 0.4 });
    c.plan = plan;
  }
  updateCoach(dt) {
    const c = this.coach;
    if (!c) return;
    if (c.planDelay > 0) {
      c.planDelay -= dt;
      c.mixer.update(dt);
      return;
    }
    if (!c.step) {
      if (!c.plan.length) this.planPace();
      c.step = c.plan.shift();
      c.wait = c.step.time || 0;
      c.scratched = false;
    }
    const step = c.step;
    if (step.kind === "walk" || step.kind === "run") {
      const dx = step.x - c.x,
        dz = step.z - c.z,
        dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      const turn = wrapAngle(want - c.angle);
      c.angle += clamp(turn, -dt * 3.2, dt * 3.2);
      const top = step.speed || (step.kind === "run" ? 2.6 : PACE.speed);
      const target = dist < 0.05 ? 0 : top * clamp(dist / 0.45, 0.35, 1) * (Math.abs(turn) > 1.2 ? 0.3 : 1);
      c.speed += (target - c.speed) * Math.min(1, dt * 4);
      const move = Math.min(dist, c.speed * dt);
      if (dist > 1e-4) {
        c.x += (dx / dist) * move;
        c.z += (dz / dist) * move;
      }
      if (step.kind === "run" && c.speed > 1.4) this.play("run", 0.2, clamp(c.speed / RUN_SPEED, 0.6, 1.6));
      else this.play("walk", 0.3, clamp(c.speed / WALK_SPEED, 0.45, 1.6));
      if (dist < 0.05) {
        c.speed = 0;
        c.step = null;
      }
    } else if (step.kind === "turn") {
      const turn = wrapAngle(step.angle - c.angle);
      c.angle += clamp(turn, -dt * 2.4, dt * 2.4);
      this.play("walk", 0.3, 0.45);
      if (Math.abs(turn) < 0.03) c.step = null;
    } else if (step.kind === "stand") {
      c.wait -= dt;
      if (step.scratch && !c.scratched && c.wait < (step.time || 3) - 0.8 && c.actions.scratch) {
        c.scratched = true;
        this.play("scratch", 0.3);
      } else if (c.clip === "scratch") {
        const a = c.actions.scratch;
        if (a.time >= a.getClip().duration - 0.35) this.play("idle", 0.4);
      } else this.play("idle", 0.4);
      if (c.wait <= 0 && c.clip !== "scratch") c.step = null;
    }
    c.root.position.set(c.x, 0, c.z);
    c.root.rotation.y = c.angle;
    c.mixer.update(dt);
  }

  // ---- the doors -----------------------------------------------------------------------------------------------
  // The coach walks (or runs) to the doors and they swing open; `then` is called as the light fills the screen (the app
  // starts the shift behind it). `flash(level)` is told how white the screen should be (0 to 1). Returns false when the
  // stage cannot play it (not loaded), so the app goes straight on.
  openDoors({ then, flash = () => {}, sound = () => {} } = {}) {
    if (!this.ready || this.open) return false;
    this.open = { t: 0, then, flash, sound, phase: "walk", called: false, at: 0 };
    const c = this.coach;
    if (c) {
      const far = Math.hypot(c.x - DOOR_SPOT.x, c.z - DOOR_SPOT.z);
      c.plan = [
        { kind: far > 1.4 ? "run" : "walk", x: DOOR_SPOT.x, z: DOOR_SPOT.z },
        { kind: "turn", angle: Math.PI },
        { kind: "stand", time: 99 },
      ];
      c.step = null;
    } else this.open.phase = "doors";
    return true;
  }
  // Straight to the light (a click or a key during the walk).
  hurry() {
    if (this.open && this.open.phase === "walk") {
      this.open.phase = "doors";
      this.open.at = this.open.t;
    }
  }
  updateDoors(dt) {
    const o = this.open;
    if (!o) return;
    o.t += dt;
    if (o.phase === "walk") {
      const c = this.coach;
      const there = c && c.step?.kind === "stand" && c.plan.length === 0;
      if (!c || there || o.t > 4) {
        o.phase = "doors";
        o.at = o.t;
      }
      return;
    }
    if (o.phase === "doors" && !o.started) {
      o.started = true;
      o.sound("doors");
      this.guests.forEach((g, i) => this.guestEnters(g, i));
      // The coach steps aside to let them in, and turns to welcome them.
      const c = this.coach;
      if (c) {
        c.plan = [
          { kind: "walk", x: 1.55, z: 1.05, speed: 1.3 },
          { kind: "turn", angle: -Math.PI * 0.72 },
          { kind: "stand", time: 99 },
        ];
        c.step = null;
        c.planDelay = 0.35;
      }
    }
    const t = o.t - o.at;
    const swing = ease(t / OPEN.swing);
    for (const leaf of this.leaves) leaf.rotation.y = leaf.userData.sign * swing * 1.85;
    const open = clamp(t / OPEN.swing, 0, 1);
    this.shared.uOpen.value = open;
    this.waterMaterial.uniforms.uOpen.value = open;
    this.skyMaterial.color.setScalar(1 + open * 0.15);
    this.doorSpot.intensity = 30 + open * 110;
    this.guestFill.intensity = open * 34;
    this.floorGlow.material.opacity = 0.32 + open * 1.3;
    this.shaftMaterial.uniforms.uStrength.value = 0.16 + open * 0.25;
    o.flash(clamp((t - OPEN.flash[0]) / (OPEN.flash[1] - OPEN.flash[0]), 0, 1));
    if (t > OPEN.then && !o.called) {
      o.called = true;
      o.then?.();
    }
  }
  // Back to the morning before the doors open (the menu shown again after a shift).
  reset() {
    this.open = null;
    if (!this.ready) return;
    for (const leaf of this.leaves) leaf.rotation.y = 0;
    this.shared.uOpen.value = 0;
    this.waterMaterial.uniforms.uOpen.value = 0;
    this.skyMaterial.color.setScalar(1);
    this.doorSpot.intensity = 30;
    this.guestFill.intensity = 0;
    for (const g of this.guests) {
      Object.assign(g, {
        x: g.spec.x,
        z: g.spec.z,
        angle: g.spec.angle,
        look: g.spec.angle,
        mode: "idle",
        speed: 0,
      });
      g.wait = 1 + Math.random() * 4;
      g.model.traverse((o) => o.isMesh && (o.castShadow = false));
      this.playGuest(g, g.spec.idle, 0);
    }
    this.floorGlow.material.opacity = 0.32;
    this.shaftMaterial.uniforms.uStrength.value = 0.16;
    const c = this.coach;
    if (c) {
      c.plan = [];
      c.step = null;
      c.x = PACE.left + 0.4 + Math.random() * 1.5;
      c.z = PACE.z;
      c.angle = Math.PI / 2;
      c.speed = 0;
    }
  }

  // ---- drawing ---------------------------------------------------------------------------------------------------
  // The one camera: a little above the far end of the pool, looking down it at the doors. A narrow (portrait) screen gets
  // a wider lens so the coach's walk still fits.
  frame(width, height) {
    const cam = this.camera,
      aspect = width / Math.max(1, height);
    cam.aspect = aspect;
    let fov = 37;
    const need = 7.2, // metres of the coach's walk that must show, at his distance
      distance = 12.4 - PACE.z;
    const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect;
    if (2 * distance * tanH < need)
      fov = THREE.MathUtils.radToDeg(2 * Math.atan(need / (2 * distance) / aspect));
    cam.fov = Math.min(fov, 75);
    cam.position.set(0, 2.6, 12.4);
    cam.lookAt(0, 1.2, 0);
    if (this.slide > 0.001) cam.setViewOffset(width, height, -this.slide * width, 0, width, height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }
  updateMirror(renderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(2, Math.round(size.x / 2)),
      h = Math.max(2, Math.round(size.y / 2));
    if (!this.mirrorTarget) {
      this.mirrorTarget = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
      this.waterMaterial.uniforms.tMirror.value = this.mirrorTarget.texture;
    } else if (this.mirrorTarget.width !== w || this.mirrorTarget.height !== h)
      this.mirrorTarget.setSize(w, h);
    // The camera reflected in the water's plane (as three's Reflector does it).
    const cam = this.camera,
      mc = this.mirrorCamera,
      y = HALL.water;
    mc.position.set(cam.position.x, 2 * y - cam.position.y, cam.position.z);
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).add(cam.position);
    look.y = 2 * y - look.y;
    mc.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    mc.up.y = -mc.up.y;
    mc.lookAt(look);
    mc.projectionMatrix.copy(cam.projectionMatrix);
    mc.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
    mc.updateMatrixWorld();
    this.mirrorMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.mirrorMatrix.multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);
    // Draw it without the water, without the dust, and only what is above the water.
    const before = renderer.getRenderTarget(),
      clipping = renderer.clippingPlanes;
    this.water.visible = false;
    renderer.clippingPlanes = this.clip;
    renderer.setRenderTarget(this.mirrorTarget);
    renderer.clear();
    renderer.render(this.scene, mc);
    renderer.setRenderTarget(before);
    renderer.clippingPlanes = clipping;
    this.water.visible = true;
  }
  update(dt) {
    if (!this.ready) return;
    this.time += dt;
    const framing = this.open ? 0 : this.framing;
    this.slide += (framing - this.slide) * Math.min(1, dt * (this.open ? 1.6 : 2.5));
    this.updateCoach(dt);
    this.updateDoors(dt);
    for (const g of this.guests) this.updateGuest(g, dt);
    this.waterMaterial.uniforms.uTime.value = this.time;
    this.shaftMaterial.uniforms.uTime.value = this.time;
    this.dustMaterial.uniforms.uTime.value = this.time;
    // The ropes ride the swell.
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.ropeBeads.length; i++) {
      const b = this.ropeBeads[i];
      const lift =
        Math.sin(b.z * 1.3 + this.time * 0.9 + b.x) * 0.012 + Math.cos(b.z * 2.3 - this.time * 0.7) * 0.008;
      m.makeTranslation(b.x, HALL.water + 0.03 + lift, b.z);
      this.ropes.setMatrixAt(i, m);
    }
    this.ropes.instanceMatrix.needsUpdate = true;
  }
  render(renderer) {
    if (!this.ready) return;
    const size = renderer.getSize(new THREE.Vector2());
    this.frame(size.x, size.y);
    this.dustMaterial.uniforms.uScale.value = 60 * renderer.getPixelRatio() * (size.y / 900);
    const exposure = renderer.toneMappingExposure;
    renderer.toneMappingExposure = this.exposure * this.brightness;
    const dim = 0.75 + 0.25 * this.brightness;
    this.shared.uDim.value = dim;
    this.renderMask(renderer);
    this.updateMirror(renderer);
    renderer.render(this.scene, this.camera);
    renderer.toneMappingExposure = exposure;
  }
  dispose() {
    this.mirrorTarget?.dispose();
    this.mask?.dispose();
    for (const d of this.disposables) d.dispose?.();
    this.disposables = [];
    this.ready = false;
  }
}

// For checks: the stage's numbers (where the doors are on the painting and in the world).
export const STAGE = { IMG, PX, LEAVES, GLASS, BAR_Y, WINDOWS, HALL, PACE, DOOR_SPOT, OPEN, wx, wy };
