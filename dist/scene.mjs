// Presentation layer: builds a venue with Three.js and mirrors simulation state every frame. Rendering never
// advances gameplay; cosmetic motion (bobbing, flapping, wagging) never feeds back into the simulation.
import { THREE, SceneKit, COLORS, disposeScene } from "./scene/kit.mjs";
import { glowTexture, gradientTexture } from "./scene/textures.mjs";
import { buildClub } from "./scene/club.mjs";
import { buildResort } from "./scene/resort.mjs";
import { buildLagoon } from "./scene/lagoon.mjs";
import { buildArena } from "./scene/arena.mjs";
import { Sky, SCENERY } from "./scene/sky.mjs";
import { windUniforms } from "./scene/geom.mjs";
import { dayLook, moodLook, DAY_TIMES } from "./scene/daylight.mjs";
import { character } from "./scene/actors.mjs";
import { attachCoachModel, dropCoachModel, planIntro, introAt, activeChoice } from "./scene/coach-model.mjs";
import { attachSwimmerModel, dropSwimmerModel, setQueasy } from "./scene/swimmer-models.mjs";
import { finsObject, lifeRingObject, skimmerObject, pooObject, bucket } from "./scene/props.mjs";
import { IncidentView } from "./scene/incident-view.mjs";
import { annoyPose } from "./scene/karen-view.mjs";
import { readTuning } from "./tuning.mjs";
import { CoachCam, COACH_CAM } from "./scene/coach-cam.mjs";
import { waitingInWater, heldInWater } from "./rescue.mjs";
import { bumpLean } from "./deck-physics.mjs";
import { CLUB, doorOpening } from "./spatial.mjs";
import { guidanceState, cuePulse } from "./guidance.mjs";

// Lighting moods. Indoor keeps the original warm hall; resort levels choose day, sunset or night.
export const LIGHTING = {
  indoor: {
    background: 0x537e7b,
    exposure: 0.95,
    hemi: [0xcfe3e0, 0x80654d, 1.2],
    sun: [0xffd6a0, 2.45, [-12, 27, 10]],
    fill: [0x8fc3cb, 0.6, [15, 15, -18]],
    env: 0.55,
    envColors: ["#d8efe9", "#b9d5cc", "#a17c5e"],
    fog: [0x537e7b, 50, 125],
    water: { shallow: [0.2, 0.8, 0.84], deep: [0.09, 0.69, 0.79] },
    glow: 0,
  },
  day: {
    background: 0x8fd0e6,
    exposure: 0.97,
    hemi: [0xd4f1ff, 0xb08a60, 1.0],
    sun: [0xfff0d0, 2.6, [-16, 30, 6]],
    fill: [0x9fd8ea, 0.55, [14, 16, -16]],
    env: 0.7,
    envColors: ["#bfe7f7", "#e9f3ea", "#c9a57d"],
    fog: [0x9fd6e3, 55, 135],
    water: {
      shallow: [0.34, 0.86, 0.88],
      deep: [0.05, 0.56, 0.72],
      sky: [0.72, 0.92, 0.98],
      glint: [1, 0.97, 0.88],
    },
    glow: 0,
    sky: [
      [0, "#5fb4dd"],
      [0.55, "#a9dff0"],
      [1, "#f4ecd0"],
    ],
  },
  sunset: {
    background: 0xf2b27f,
    exposure: 0.98,
    hemi: [0xffd2b3, 0x7d5f63, 1.05],
    sun: [0xffb877, 2.7, [-24, 14, 12]],
    fill: [0x9e8fd6, 0.6, [14, 12, -18]],
    env: 0.65,
    envColors: ["#f7b995", "#f3d7b8", "#8f6a58"],
    fog: [0xe9a986, 50, 130],
    water: {
      shallow: [0.3, 0.8, 0.82],
      deep: [0.05, 0.47, 0.64],
      sky: [1, 0.74, 0.58],
      glint: [1, 0.82, 0.56],
      glow: 0.25,
    },
    glow: 0.15,
    sky: [
      [0, "#6b77c2"],
      [0.45, "#f09b7a"],
      [0.8, "#ffd08a"],
      [1, "#ffe9c2"],
    ],
  },
  night: {
    background: 0x1a2440,
    exposure: 1.05,
    hemi: [0x6878b8, 0x2e2a3c, 0.92],
    sun: [0x9fb6ff, 1.1, [-10, 24, 14]],
    fill: [0x5578c4, 0.35, [14, 14, -16]],
    env: 0.35,
    envColors: ["#27335a", "#3b4a73", "#2b2531"],
    fog: [0x1c2744, 45, 120],
    water: {
      shallow: [0.18, 0.72, 0.86],
      deep: [0.04, 0.4, 0.66],
      sky: [0.26, 0.34, 0.58],
      glint: [0.8, 0.88, 1],
      glow: 1,
    },
    glow: 1,
    sky: [
      [0, "#0e1631"],
      [0.6, "#233562"],
      [1, "#48507a"],
    ],
  },
};

// Open-air moods that ride the shared time-of-day scale (scene/daylight.mjs). A shift may also slide along that scale
// (`config.daylight`) and meet a storm, so the sky, light, fog, water and lamps all move together.
for (const name of ["golden", "dusk"]) LIGHTING[name] = dayLook(DAY_TIMES[name]);
// The Grand Gala arena: warm spotlights over a dark hall, pink fill from the crowd, glowing pool lamps.
LIGHTING.gala = {
  background: 0x2a2038,
  exposure: 1,
  hemi: [0xfff0dc, 0x3a2b3c, 1.05],
  sun: [0xfff0d8, 2.3, [-14, 30, 8]],
  fill: [0xff9ec0, 0.6, [14, 14, -16]],
  env: 0.6,
  envColors: ["#f6e6d0", "#d8b898", "#4a3a44"],
  fog: [0x2a2038, 70, 170],
  water: {
    shallow: [0.24, 0.82, 0.88],
    deep: [0.06, 0.6, 0.78],
    sky: [0.9, 0.75, 0.6],
    glint: [1, 0.9, 0.75],
    glow: 0.7,
  },
  glow: 0.6,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const BUILDERS = { club: buildClub, resort: buildResort, lagoon: buildLagoon, arena: buildArena };
const defaultLighting = (venue) => venue.lighting || (venue.indoor ? "indoor" : "day");
// A lighting preset with the sky dome's colours: the classic moods sit at fixed points of the day scale, and the
// dome's horizon takes the preset's own fog colour so the far ground melts into the sky without a seam.
function withDome(name, venue) {
  const base = LIGHTING[name];
  if (base.dome) return base;
  const time = DAY_TIMES[name];
  if (time === undefined) return base;
  const dome = moodLook(name, { azimuth: venue.sunAzimuth ?? 2.65 }).dome;
  dome.fog = new THREE.Color(base.fog[0]);
  return { ...base, dome };
}

export class PoolWorld extends SceneKit {
  constructor(container, onPick, { headless = false, venue = CLUB, lighting } = {}) {
    super();
    this.container = container;
    this.onPick = onPick;
    this.headless = headless;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 180);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.zoom = 1;
    this.autoZoom = 1;
    // "overview" is the classic across-the-pool camera; "coach" is the first-person Coach Cam.
    this.viewMode = "overview";
    this.effectSeed = 719;
    this.clock = 0;
    this.version = 0;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Switches for isolating a crash on someone's device (tuning.mjs, README): the app hands over its own, and a
    // headless world reads none.
    const tuning = (this.tune = globalThis.__poolTuning || readTuning(globalThis.location?.search || ""));
    this.noParticles = tuning.has("noparticles");
    if (!headless) {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !tuning.has("noaa"),
        alpha: false,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, Math.max(0.5, tuning.number("dpr", 1.7))));
      this.renderer.shadowMap.enabled = !tuning.has("noshadow");
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      container.appendChild(this.renderer.domElement);
    }
    this.build(venue, lighting);
    if (!headless) {
      window.addEventListener("resize", () => this.resize());
      this.bindInput();
    }
    this.resize();
  }

  // (Re)build every scene object for a venue and lighting mood. Old GPU resources are released.
  build(venue, lighting) {
    lighting ||= defaultLighting(venue);
    if (this.scene) {
      disposeScene(this.scene);
      if (this.coachCam) disposeScene(this.coachCam.scene);
      for (const t of this.textures) t.dispose();
      this.envTarget?.dispose();
    }
    this.venue = venue;
    this.lightingName = lighting;
    this.staticLook = withDome(lighting, venue);
    this.look = this.staticLook;
    this.dynamicLook = false;
    this.ambience = { glow: this.look.glow ?? 0, lamp: 1, storm: 0 };
    this.wind = windUniforms();
    this.dimmers = [];
    this.liveProps = [];
    this.updaters = [];
    this.cheer = 0;
    // What only some venues have: never carry the last venue's hall, glass or lamps into this one.
    this.hall = null;
    this.windowGlass = null;
    this.lightShafts = null;
    this.stringLights = null;
    this.poolLamps = null;
    this.incidentLight = 1;
    this.lookKey = null;
    this.staticBackground = null;
    this.resetKit();
    this.scene = new THREE.Scene();
    this.clickables = [];
    this.people = new Map();
    this.drops = new Map();
    this.particles = [];
    this.flags = [];
    this.lockerDoors = [];
    this.labels = [];
    this.handoffs = [];
    this.bobs = [];
    this.finPairs = [];
    this.ringModels = [];
    this.target = new THREE.Vector3(-1.5, 0.45, -3.2);
    this.glowMap = glowTexture();
    this.textures.push(this.glowMap);
    this.buildLights();
    (BUILDERS[venue.id] || buildClub)(this, venue, lighting);
    this.sky = venue.scenery ? new Sky(this, SCENERY[venue.scenery]) : null;
    this.sky?.setVisible(this.viewMode === "coach");
    this.hall?.setCoach(this.viewMode === "coach");
    this.batchStatic();
    this.coach = this.makeCoach();
    this.scene.add(this.coach);
    this.coachHalo = this.ring(0.57, 0xffd54d);
    this.scene.add(this.coachHalo);
    this.actionHalo = this.ring(0.66, 0xffe484);
    this.scene.add(this.actionHalo);
    this.actionHalo.visible = false;
    this.selection = this.ring(0.62, 0xffda4f);
    this.scene.add(this.selection);
    this.selection.visible = false;
    this.laneHighlights = venue.lanes.map((x) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(3.0, 16),
        new THREE.MeshBasicMaterial({ color: 0xffe58b, transparent: true, opacity: 0, depthWrite: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, -0.17, 0);
      this.scene.add(m);
      return m;
    });
    this.buildGuidance();
    this.incidentView = new IncidentView(this);
    const look = this.coachCam && {
      yaw: this.coachCam.yaw,
      pitch: this.coachCam.pitch,
      hfov: this.coachCam.hfov,
    };
    this.coachCam = new CoachCam(this);
    if (look) Object.assign(this.coachCam, look);
    if (this.coachCam.inline) this.coachCam.inline.visible = this.viewMode === "coach";
    if (this.tune.has("nolights")) this.stripLocalLights();
    if (this.tune.has("nopoints"))
      for (const root of [this.scene, this.coachCam.scene])
        root.traverse((o) => {
          if (o.isPoints) o.visible = false;
        });
    this.version++;
  }
  setVenue(venue, lighting) {
    lighting ||= defaultLighting(venue);
    if (venue === this.venue && lighting === this.lightingName) return false;
    this.build(venue, lighting);
    this.resize();
    return true;
  }

  buildLights() {
    const look = this.look;
    this.scene.background = look.sky ? gradientTexture(look.sky) : new THREE.Color(look.background);
    if (look.sky) this.textures.push(this.scene.background);
    this.scene.fog = new THREE.Fog(look.fog[0], look.fog[1], look.fog[2]);
    if (this.renderer) this.renderer.toneMappingExposure = look.exposure;
    this.hemi = new THREE.HemisphereLight(...look.hemi);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(look.sun[0], look.sun[1]);
    sun.position.set(...look.sun[2]);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -27;
    sun.shadow.camera.right = 27;
    sun.shadow.camera.top = 27;
    sun.shadow.camera.bottom = -27;
    sun.shadow.camera.far = 90;
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.00025;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    this.sun = sun;
    this.fill = new THREE.DirectionalLight(look.fill[0], look.fill[1]);
    this.fill.position.set(...look.fill[2]);
    this.scene.add(this.fill);
    // Emergency glow used during blackouts (off otherwise).
    this.emergency = new THREE.HemisphereLight(0xff6a4d, 0x1a2230, 0);
    this.scene.add(this.emergency);
    this.baseLight = { hemi: look.hemi[2], sun: look.sun[1], fill: look.fill[1], env: look.env };
    this.buildEnvironment();
  }
  // Soft image-based lighting from a tiny gradient room, so glazed tiles and water catch highlights.
  buildEnvironment() {
    if (!this.renderer) return;
    const [top, mid, bottom] = this.look.envColors;
    const env = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 32, 16);
    const colors = [],
      c = new THREE.Color(),
      a = new THREE.Color(top),
      m = new THREE.Color(mid),
      b = new THREE.Color(bottom);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 10;
      if (y > 0) c.copy(m).lerp(a, y);
      else c.copy(m).lerp(b, Math.min(1, -y * 2));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 3),
      new THREE.MeshBasicMaterial({ color: 0xfff4dc }),
    );
    panel.position.set(-4, 6, -6);
    panel.lookAt(0, 0, 0);
    env.add(panel);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromScene(env, 0.04);
    pmrem.dispose();
    geo.dispose();
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = this.look.env;
  }

  batchStatic() {
    // Bake fixed furniture into material batches; flags, water, inventory, fixtures and agents stay live.
    this.scene.updateMatrixWorld(true);
    const live = new Set(
      [
        ...this.flags,
        ...this.finPairs,
        ...this.lockerDoors.map((d) => d.hinge),
        this.sanitationGroup,
        ...this.ringModels,
        this.fishNetRack,
        this.flashlightRack,
        this.medkitRack,
        this.fuseLever,
        this.trampolineBed,
        ...(this.liveProps || []),
      ].filter(Boolean),
    );
    const batches = new Map();
    // A group flagged `batchOwner` (the hall's upper structure) keeps its own batches, so hiding the group hides them.
    const ownerOf = (m) => {
      for (let p = m.parent; p; p = p.parent) if (p.userData?.batchOwner) return p;
      return this.scene;
    };
    this.scene.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || !m.material.isMeshStandardMaterial) return;
      if (m.material.onBeforeCompile && m.material.customProgramCacheKey?.().startsWith("caustics")) return;
      for (let p = m; p; p = p.parent) if (live.has(p)) return;
      const key = ownerOf(m).uuid + ":" + m.material.uuid + ":" + m.castShadow + ":" + m.receiveShadow;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(m);
    });
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map((m) => {
        const g = m.geometry.index ? m.geometry.clone() : m.geometry.clone();
        return g.applyMatrix4(m.matrixWorld);
      });
      const withColor = geometries.some((g) => g.attributes.color);
      let vertexCount = 0,
        indexCount = 0;
      for (const g of geometries) {
        vertexCount += g.attributes.position.count;
        indexCount += g.index?.count || g.attributes.position.count;
      }
      const positions = new Float32Array(vertexCount * 3),
        normals = new Float32Array(vertexCount * 3),
        uv = new Float32Array(vertexCount * 2),
        colors = withColor ? new Float32Array(vertexCount * 3).fill(1) : null,
        indices = new Uint32Array(indexCount);
      let v = 0,
        j = 0;
      for (const g of geometries) {
        const count = g.attributes.position.count;
        positions.set(g.attributes.position.array, v * 3);
        normals.set(g.attributes.normal.array, v * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, v * 2);
        if (colors && g.attributes.color) colors.set(g.attributes.color.array, v * 3);
        if (g.index) {
          for (const index of g.index.array) indices[j++] = index + v;
        } else for (let i = 0; i < count; i++) indices[j++] = v + i;
        v += count;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      if (colors) geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
      geo.computeBoundingSphere();
      const merged = new THREE.Mesh(geo, meshes[0].material);
      merged.castShadow = meshes[0].castShadow;
      merged.receiveShadow = meshes[0].receiveShadow;
      ownerOf(meshes[0]).add(merged);
      for (const m of meshes) m.removeFromParent();
    }
  }

  buildGuidance() {
    this.guideAura = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.57, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffdf52,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    shell.position.y = 0.94;
    shell.scale.set(1, 1.8, 1);
    this.guideAura.add(shell);
    const halo = this.ring(0.76, 0xffdf52);
    halo.position.y = 0.07;
    this.guideAura.add(halo);
    this.guideAura.userData = { shell, halo };
    this.scene.add(this.guideAura);
    this.laneRims = this.venue.lanes.map((x) => {
      const points = [
        [-1.43, -7.9],
        [1.43, -7.9],
        [1.43, 7.9],
        [-1.43, 7.9],
      ].map(([a, b]) => new THREE.Vector3(x + a, -0.13, b));
      const rim = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0xffdf52, transparent: true, opacity: 1, depthWrite: false }),
      );
      this.scene.add(rim);
      return rim;
    });
    // Fixed, reusable speed streaks. No particle allocation in the dash loop.
    this.dashTrail = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.035, 0.65 + i * 0.12),
        new THREE.MeshBasicMaterial({ color: 0xffed92, transparent: true, opacity: 0.7, depthWrite: false }),
      );
      line.position.set(
        (i % 2 ? 1 : -1) * (0.25 + Math.floor(i / 2) * 0.18),
        0.3 + (i % 2) * 0.24,
        -0.9 - Math.floor(i / 2) * 0.2,
      );
      this.dashTrail.add(line);
    }
    this.scene.add(this.dashTrail);
  }

  // Compatibility helpers used by older callers and checks.
  character(p) {
    return character(this, p);
  }
  finsObject() {
    return finsObject(this);
  }
  lifeRingObject() {
    return lifeRingObject(this);
  }
  skimmerObject() {
    return skimmerObject(this);
  }
  pooObject() {
    return pooObject(this);
  }
  bucket(x, y, z, parent) {
    return bucket(this, x, y, z, parent);
  }

  addPerson(p) {
    const g = character(this, p);
    // The five swimmer models when they are loaded and wanted (swimmer-models.mjs); a swimmer who cannot have one stays classic.
    try {
      attachSwimmerModel(g, p);
    } catch (error) {
      console.error(error);
      dropSwimmerModel(g);
    }
    this.people.set(p.id, g);
    this.scene.add(g);
    return g;
  }
  removePerson(id) {
    const g = this.people.get(id);
    if (!g) return;
    this.clickables = this.clickables.filter((x) => x !== g.userData.hit);
    dropSwimmerModel(g);
    this.scene.remove(g);
    this.people.delete(id);
  }
  // A new shift starts with an empty deck: swimmers and visitors of the last one (their ids start again from 1) must
  // not be picked up by the next.
  resetActors() {
    for (const id of [...this.people.keys()]) this.removePerson(id);
    this.incidentView.clearVisitors();
    this.introPlan = null; // the coach walks in again
  }
  // The coach: Coach Panic when the model is loaded and wanted, else the classic one (coach-model.mjs).
  makeCoach(choice = activeChoice()) {
    const group = character(this, { type: "coach", skin: 1, shape: 0.5 });
    attachCoachModel(group, choice);
    return group;
  }
  // Change the coach's look now (How to play), keeping the classic one for going back.
  swapCoach(choice) {
    this.scene.remove(this.coach);
    this.coach = this.makeCoach(choice);
    this.scene.add(this.coach);
  }
  // Change the swimmers' look now (How to play): everyone on the deck is built again, the next sync makes them as chosen (a
  // cannonball man in the middle of his incident too).
  swapSwimmers() {
    for (const id of [...this.people.keys()]) this.removePerson(id);
    this.incidentView.clearVisitors();
  }
  slipPose(u, remaining, duration) {
    if (!(remaining > 0)) return;
    const elapsed = 1 - Math.min(1, remaining / duration),
      smooth = (t) => {
        t = Math.max(0, Math.min(1, t));
        return t * t * (3 - 2 * t);
      };
    const down = this.reducedMotion.matches
      ? 1
      : elapsed < 0.22
        ? smooth(elapsed / 0.22)
        : elapsed > 0.58
          ? 1 - smooth((elapsed - 0.58) / 0.42)
          : 1;
    // Characters face local +Z: negative X rotation puts their back on the deck.
    u.root.rotation.set((-Math.PI / 2) * down, 0, 0);
    u.root.position.set(0, (u.depth ?? 0.37) * down, -0.12 * (u.fit || 1) * down);
    u.arms.forEach((a, i) => a.rotation.set(-1.15 * down, 0, (i ? -0.35 : 0.35) * down));
    u.legs.forEach((l) => (l.rotation.x = 0.24 * down));
    u.puppet.arms = u.puppet.legs = true;
  }

  // `dt` drives the world (slowed during an incident sting, stopped for a hit-stop); `realDt` drives the camera.
  sync(sim, time, dt = 0.016, realDt = dt) {
    this.clock = time;
    this.realDt = realDt;
    if (this.moment) this.moment.left -= realDt;
    this.shake = Math.max(0, (this.shake || 0) - dt * 1.4);
    for (const door of this.lockerDoors)
      door.hinge.rotation.y = door.side * 1.35 * doorOpening(sim.doors?.[door.side] || 0);
    const guide = guidanceState(sim),
      pulse = cuePulse(time, this.reducedMotion.matches);
    this.syncSanitation(sim, time);
    const light = this.incidentView.lightLevel(sim, time);
    const uniforms = this.water.material.uniforms;
    uniforms.uTime.value = time;
    uniforms.uDirty.value = sim.contamination / 100;
    uniforms.uBrown.value = sim.waterBrown || 0;
    uniforms.uLight.value = light.water;
    this.poolUniforms.uTime.value = time;
    this.poolUniforms.uCaustic.value = light.caustic;
    this.flags.forEach((f, i) => {
      f.rotation.x = Math.sin(time * 1.4 + i * 0.5) * 0.06;
    });
    const active = new Set();
    this.crowd = !!sim.crowdPanic?.(); // a cannonball man is in the pool: the swimmers in it hold still, and everyone panics
    for (const p of sim.people) {
      if (p.status === "gone") continue;
      active.add(p.id);
      const g = this.people.get(p.id) || this.addPerson(p);
      this.syncSwimmer(sim, p, g, time, dt);
    }
    for (const id of this.people.keys()) if (!active.has(id)) this.removePerson(id);
    this.syncCoach(sim, time, dt);
    this.syncRescue(sim, time);
    for (let i = this.handoffs.length - 1; i >= 0; i--) {
      const f = this.handoffs[i];
      f.elapsed += dt;
      const t = Math.min(1, f.elapsed / 0.3);
      f.mesh.position.set(
        f.from.x + (f.to.x - f.from.x) * t,
        1.1 + Math.sin(t * Math.PI) * 0.75 - t * 0.65,
        f.from.z + (f.to.z - f.from.z) * t,
      );
      f.mesh.rotation.y = t * 3;
      if (t === 1) {
        f.mesh.removeFromParent();
        this.handoffs.splice(i, 1);
      }
    }
    this.finPairs.forEach((g, i) => (g.visible = i < sim.finsAvailable));
    const selected = sim.get(sim.selected);
    this.selection.visible = !!selected;
    if (selected) {
      this.selection.position.set(selected.x, selected.status === "swim" ? -0.11 : 0.035, selected.z);
      this.selection.scale.setScalar(1 + Math.sin(time * 5) * 0.08);
    }
    const focus = sim.get(guide.swimmerId);
    this.guideAura.visible = !!focus;
    if (focus) {
      this.guideAura.position.set(focus.x, 0, focus.z);
      this.guideAura.userData.shell.material.opacity = 0.16 + pulse * 0.24;
      this.guideAura.userData.halo.scale.setScalar(1 + pulse * 0.22);
      this.guideAura.userData.shell.scale.set(1 + pulse * 0.12, 1.8 + pulse * 0.12, 1 + pulse * 0.12);
    }
    this.laneHighlights.forEach((m, i) => {
      const danger = sim.laneLocked ? sim.laneLocked(i) : false,
        open = !!guide.lanes && i !== guide.laneExcept;
      m.material.opacity = danger
        ? 0.1 + pulse * 0.16
        : open
          ? 0.14 + pulse * 0.19
          : sim.lanePeople(i).some((p) => p.h < 30)
            ? 0.07
            : 0;
      m.material.color.set(danger ? 0xff7a3d : open ? 0xffdf52 : 0xff5d31);
      this.laneRims[i].visible = open && !danger;
      this.laneRims[i].material.opacity = 0.5 + pulse * 0.5;
    });
    this.syncClutter(sim);
    this.updateEnvironment(sim, time, dt);
    this.incidentView.sync(sim, time, dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= (p.gravity ?? 5.6) * dt;
      p.mesh.scale.setScalar(Math.max(0, p.life * (p.grow ?? 1.8)));
      if (p.spin) {
        p.mesh.rotation.x += p.spin * dt;
        p.mesh.rotation.y += p.spin * 0.7 * dt;
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  // Time of day, weather and the world beyond the deck. Indoor venues keep their fixed light. A shift with
  // `config.daylight = [from, to]` slides along the day scale as it plays; a storm (sim.stormLevel) darkens whatever
  // hour it is. Everything derives from one look, so the sky, fog, light, water and lamps never disagree.
  updateEnvironment(sim, time, dt) {
    // Reduced motion stills the scenery: flags, palms, fans, spotlights, waves and clouds hold one pose, and the
    // crowd stays seated. Content that follows the game (the scoreboard, the hour, the weather) still updates.
    const calm = this.reducedMotion.matches;
    time = calm ? 4.2 : time;
    this.wind.uWindTime.value = time;
    this.cheer = calm ? 0 : Math.max(0, this.cheer - dt * 0.22);
    this.hall?.update(time, dt, this, sim);
    for (const update of this.updaters) update(time, dt, this, sim);
    if (!this.sky) return;
    const cfg = sim.config || {},
      storm = sim.stormLevel?.() ?? 0,
      span = cfg.daylight;
    if (span || storm > 0.001) {
      const progress = clamp((sim.time || 0) / (cfg.duration || 1), 0, 1),
        t = span ? span[0] + (span[1] - span[0]) * progress : (DAY_TIMES[this.lightingName] ?? 0),
        key = Math.round(t * 2000) + ":" + Math.round(storm * 100);
      // The look only changes as fast as the sun moves: derive it again when that has made a difference.
      if (key !== this.lookKey || !this.dynamicLook) {
        this.lookKey = key;
        this.applyLook(dayLook(t, { azimuth: this.venue.sunAzimuth ?? 2.65, storm }), true);
      }
    } else if (this.dynamicLook) {
      this.lookKey = null;
      this.applyLook(this.staticLook, false);
    }
    this.ambience.storm = storm;
    this.sky.update(time, dt, this.look, {
      camera: this.camera,
      coach: this.viewMode === "coach",
      storm,
      reduced: this.reducedMotion.matches,
    });
    // A bolt in the storm: the app hears it as thunder, like a strike during a blackout.
    if (this.sky.consumeStrike()) this.incidentView.struck = true;
  }
  // Put a look on the lights, fog, water and lamps. `dynamic` looks come from the day scale each frame; the static
  // look is restored once when the shift no longer slides along it.
  applyLook(look, dynamic) {
    this.look = look;
    this.dynamicLook = dynamic;
    this.hemi.color.set(look.hemi[0]);
    this.hemi.groundColor.set(look.hemi[1]);
    this.sun.color.set(look.sun[0]);
    this.sun.position.set(...look.sun[2]);
    this.fill.color.set(look.fill[0]);
    this.fill.position.set(...look.fill[2]);
    this.baseLight.hemi = look.hemi[2];
    this.baseLight.sun = look.sun[1];
    this.baseLight.fill = look.fill[1];
    this.baseLight.env = look.env;
    this.scene.fog.color.set(look.fog[0]);
    this.scene.fog.near = look.fog[1];
    this.scene.fog.far = look.fog[2];
    if (this.renderer) this.renderer.toneMappingExposure = look.exposure;
    if (dynamic) {
      this.bgColor ||= new THREE.Color();
      this.staticBackground ||= this.scene.background;
      this.scene.background = this.bgColor.set(look.background);
    } else if (this.staticBackground) {
      this.scene.background = this.staticBackground;
      this.staticBackground = null;
    }
    const u = this.water.material.uniforms,
      water = look.water;
    u.uShallow.value.set(...water.shallow);
    u.uDeep.value.set(...water.deep);
    u.uSky.value.set(...water.sky);
    u.uGlint.value.set(...water.glint);
    u.uGlow.value = water.glow || 0;
    if (dynamic && look.dome) {
      const d = look.dome;
      u.uSun.value.copy(d.sunDir.y > 0.05 ? d.sunDir : d.moonDir);
    } else u.uSun.value.set(-0.35, 0.9, 0.3);
    this.ambience.glow = look.glow ?? 0;
    // Pool lamps: as built for the classic moods, following the hour on a sliding day.
    this.ambience.lamp = dynamic ? 0.3 + 0.7 * Math.min(1, (look.glow ?? 0) * 1.6) : 1;
  }

  syncSwimmer(sim, p, g, time, dt = 0.016) {
    const u = g.userData;
    // The crowd panics while a cannonball man is in the pool: a swimmer in the water is held where it is, upright, and hops with
    // its hands up like those who wait on the deck.
    const crowd = !!this.crowd,
      held = heldInWater(sim, p, crowd);
    const lying =
      (p.status === "swim" && p.type !== "aqua") ||
      (p.status === "evacuating" && p.evacWater) ||
      (p.status === "exit" && p.exitPhase === "water") ||
      p.status === "switch" ||
      (p.status === "fleeing" && p.fleePhase === "swim");
    // A swimmer on its front who is held stands up in the water (and lies down again when let go) over a third of a second,
    // not at once: `u.stand` goes from 0, on its front, to 1, standing. The crawl plays while it is mostly lying.
    const goal = held ? 1 : 0;
    u.stand = lying && u.lying ? u.stand + Math.max(-dt * 3, Math.min(dt * 3, goal - u.stand)) : goal;
    u.lying = lying;
    const swim = lying && u.stand < 0.5;
    const fit = u.fit || 1; // a model's height as a share of the classic swimmer's: how far back a swim or a climb sits it
    u.puppet.arms = u.puppet.legs = false;
    const walking =
      p.status === "enter" ||
      (p.status === "exit" && !["water", "climb"].includes(p.exitPhase)) ||
      (p.status === "evacuating" && !p.evacWater) ||
      (p.status === "arriving" && p.arrivalHold <= 0) ||
      (p.status === "recovering" && p.recoveryStage === "to-bench") ||
      (p.status === "fleeing" && p.fleePhase === "run") ||
      (p.status === "trampoline" && ["toStairs"].includes(p.jumpStage));
    g.position.set(
      p.x,
      swim ? -0.39 : held ? (p.type === "aqua" ? -0.75 : -0.82) : p.status === "swim" ? -0.75 : 0,
      p.z,
    );
    g.rotation.set(0, p.angle || 0, 0);
    u.root.rotation.set(0, 0, 0);
    u.root.position.set(0, 0, 0);
    u.legs.forEach((l) => (l.visible = !u.rig)); // a swimmer model's own legs show instead
    u.f.visible = p.hasFins;
    u.hit.position.y = swim ? 0.25 : 0.9;
    u.shadow.visible = !swim && !held && p.status !== "swim";
    u.bandage.visible = !!p.bandaged;
    const base = u.baseScale || 1;
    const standing = (0.94 + (p.shape || 0) * 0.12) * base;
    if (swim) {
      u.root.rotation.x = Math.PI / 2;
      u.root.position.y = 0.27;
      u.root.scale.setScalar(0.85 * base);
      u.root.position.z = -0.65 * fit;
      const tempo =
        p.status === "evacuating" || p.status === "fleeing"
          ? 12
          : p.problem
            ? 0
            : Math.max(p.actualSpeed, p.status === "switch" ? 2 : 0) * 3.2;
      u.arms.forEach((a, i) => {
        a.rotation.set(Math.sin(time * tempo + u.phase + i * Math.PI) * 1.4, 0, i === 0 ? -0.2 : 0.2);
      });
      u.legs.forEach((l, i) => {
        l.rotation.x = Math.sin(time * tempo * 1.4 + i * Math.PI) * 0.35;
      });
      if (p.h < 35) u.root.rotation.z = Math.sin(time * 10) * 0.06;
    } else {
      u.root.scale.setScalar(standing);
      u.root.position.z = 0;
      const tempo = walking ? time * (p.status === "fleeing" ? 14 : 9) : time * 2.2;
      const movement = walking ? 0.55 : p.type === "aqua" ? 0.8 : 0.09;
      u.arms.forEach((a, i) => {
        a.rotation.set(
          Math.sin(tempo + u.phase + i * Math.PI) * movement,
          0,
          p.type === "aqua" ? Math.sin(tempo) * 0.9 * (i ? 1 : -1) : 0,
        );
      });
      if (p.type === "aqua") u.puppet.arms = true; // the aerobics arms are in none of the clips
      u.legs.forEach((l, i) => {
        l.rotation.x = walking ? Math.sin(tempo + i * Math.PI) * 0.52 : 0;
      });
      u.root.position.y = Math.sin(tempo * 2) * (walking ? 0.025 : 0.017);
      if (p.queasy) u.root.rotation.z = Math.sin(time * 2.6) * 0.085;
    }
    if (p.exitPhase === "climb" && p.status === "exit") {
      const t = p.exitProgress;
      g.position.y = -0.39 * (1 - t);
      u.root.rotation.x = (Math.PI / 2) * (1 - t);
      u.root.position.y = 0.27 * (1 - t);
      u.root.position.z = -0.65 * (1 - t) * fit;
      u.arms.forEach((a) => a.rotation.set(-1.5 * (1 - t), 0, 0));
      u.legs.forEach((l) => (l.rotation.x = -0.5 * Math.sin(t * Math.PI)));
      u.puppet.arms = u.puppet.legs = true;
    }
    u.soreEyes.visible = p.problem === "eyes";
    if (p.stomachWarning && !swim) {
      u.arms[0].rotation.x = -1.1;
      u.root.rotation.z = Math.sin(time * 4) * 0.08;
      u.puppet.arms = true;
    }
    let panicClip = false,
      lift = 0; // (how high a hop takes the classic swimmer off its feet)
    if (
      p.status === "panic" ||
      ((sim.cleanup || crowd) && p.status === "queue") ||
      held ||
      p.status === "fleeing"
    ) {
      const running = p.status === "fleeing" || p.panicStyle === "circles";
      // A swimmer model that has the Panic clip hops on the spot with it, arms and all (with reduced motion it stands with
      // its hands up instead, like the classic swimmer).
      panicClip = !running && !this.reducedMotion.matches && !!u.rig?.actions.panic;
      u.arms.forEach((a, i) =>
        a.rotation.set(running ? Math.sin(time * 16 + i) * 0.4 : 0, 0, i ? -2.7 : 2.7),
      );
      u.puppet.arms = !panicClip; // hands up
      if (!running) {
        lift = panicClip || this.reducedMotion.matches ? 0 : Math.abs(Math.sin(time * 8 + u.phase)) * 0.42;
        u.root.position.y = lift;
        u.legs.forEach((l) => (l.rotation.x = -0.15));
        u.puppet.legs = !panicClip;
        if (panicClip) u.f.visible = false; // the fins stay on the floor: the feet are in the air
      } else if (!swim) {
        u.legs.forEach((l, i) => (l.rotation.x = Math.sin(time * 16 + i * Math.PI) * 0.7));
        u.root.position.y = this.reducedMotion.matches ? 0 : Math.abs(Math.sin(time * 16 + u.phase)) * 0.12;
      }
    }
    if (lying && u.stand > 0 && u.stand < 1) {
      // On the way between lying on the water and standing in it: the pose is turned up, set into the water and grown as it goes.
      const flat = 1 - u.stand;
      g.position.y = -0.39 - 0.43 * u.stand;
      u.root.rotation.x = (Math.PI / 2) * flat;
      u.root.position.set(0, 0.27 * flat + lift, -0.65 * fit * flat);
      u.root.scale.setScalar((0.85 + (standing / base - 0.85) * u.stand) * base);
    }
    if (!swim && p.status !== "swim") {
      const lean = bumpLean(p, this.reducedMotion.matches);
      u.root.rotation.x += lean.x;
      u.root.rotation.z += lean.z;
    }
    if (waitingInWater(sim, p) || (p.status === "exit" && p.rescueRecover && p.exitPhase === "water")) {
      const struggling = sim.rescue?.victim === p.id && p.problem === "cramp",
        dazed = p.problem === "injured",
        motion = this.reducedMotion.matches ? 0 : 1;
      const wave = Math.sin(time * (struggling ? 8 : 3) + u.phase);
      g.position.y = -0.82;
      u.root.rotation.set(
        struggling ? wave * 0.09 * motion : 0,
        0,
        struggling
          ? Math.sin(time * 5 + u.phase) * 0.12 * motion
          : dazed
            ? Math.sin(time * 2.2 + u.phase) * 0.2 * motion
            : 0,
      );
      u.root.position.set(0, wave * (struggling ? 0.15 : 0.065) * motion, 0);
      u.root.scale.setScalar(base);
      u.shadow.visible = false;
      u.hit.position.y = 0.9;
      u.arms.forEach((a, i) => {
        const paddle = Math.sin(time * (struggling ? 10 : 3) + u.phase + i * Math.PI) * motion;
        a.rotation.set(
          struggling ? 0.25 + paddle * 0.5 : paddle * 0.08,
          0,
          p.rescueRecover || dazed
            ? i
              ? -0.6
              : 0.6
            : (i ? -1 : 1) * (2.7 + paddle * (struggling ? 0.3 : 0.07)),
        );
      });
      u.legs.forEach((l) => {
        l.rotation.x = 0;
        l.visible = false;
      });
      u.f.visible = false;
      u.puppet.arms = u.puppet.legs = true;
    }
    if (p.status === "recovering" && p.recoveryStage === "resting") {
      g.position.y = 0.22 + (0.45 - (u.hipsY ?? 0.45)); // the hips stay where the classic swimmer's are, on the bench
      u.root.position.set(0, 0, 0);
      u.root.rotation.set(0, 0, 0);
      u.legs.forEach((l) => (l.rotation.x = -Math.PI / 2));
      u.arms.forEach((a) => a.rotation.set(-0.3, 0, 0));
      u.puppet.arms = u.puppet.legs = true;
    }
    this.incidentView.pose(sim, p, g, time);
    // Karen is near: hands over the ears, hunched, head shaking, until she has gone (a model's arms are the classic arms' while
    // they are up: the puppet).
    if (
      annoyPose(u, !swim && p.status !== "swim" && p.karenAnnoyed > 0, time, this.reducedMotion.matches) >
      0.001
    )
      u.puppet.arms = true;
    if (!swim && p.status !== "swim") this.slipPose(u, p.slipTime, 0.65);
    if (p.status === "swim" && p.actualSpeed > 0.3 && Math.random() < 0.04)
      this.splash(p.x, -0.16, p.z, 2, true);
    this.syncModel(p, g, swim, dt, panicClip);
  }
  // A swimmer model's clip and poses (swimmer-models.mjs): how fast the swimmer covers the ground, whether it swims, and
  // which limbs the poses above were set for.
  syncModel(p, g, swim, dt, panic = false) {
    const u = g.userData;
    if (!u.rig) return;
    const at = u.lastAt;
    u.lastAt = { x: p.x, z: p.z };
    if (at && dt > 0) u.footSpeed = Math.hypot(p.x - at.x, p.z - at.z) / dt;
    setQueasy(g, !!p.queasy);
    try {
      u.rig.update(dt, {
        speed: swim ? 0 : u.footSpeed || 0,
        swim,
        // The stroke follows the swimmer's pace; a swimmer in trouble barely moves, one fleeing flails.
        stroke:
          p.status === "evacuating" || p.status === "fleeing"
            ? 1.4
            : p.problem
              ? 0.25
              : Math.max(0.4, Math.min(1.5, Math.max(p.actualSpeed, p.status === "switch" ? 2 : 0) * 0.32)),
        panic,
        puppet: u.puppet,
        classic: u,
      });
    } catch (error) {
      // A failing model must not stop the shift: this swimmer is classic from here on.
      console.error(error);
      dropSwimmerModel(g);
    }
  }

  // A fresh model of a carried item (the third-person coach and the Coach Cam hands each hold their own).
  carryObject(kind) {
    const item = this.incidentView.carryModel(kind);
    if (item) return item;
    const g = new THREE.Group();
    if (kind === "fins") g.add(finsObject(this));
    else if (kind === "lifering") g.add(lifeRingObject(this));
    else if (kind === "skimmer") g.add(skimmerObject(this));
    else if (kind === "chlorine") bucket(this, 0, 0, 0, g);
    else if (kind === "relief") {
      this.cyl(0.12, 0.12, 0.36, 0x78c7ce, 0, 0, 0, g);
      this.cyl(0.08, 0.11, 0.1, 0xf9f2cf, 0, 0.24, 0, g);
    } else if (kind === "goggles") {
      this.box(0.44, 0.12, 0.14, COLORS.navy, 0, 0, 0, 0.03, g);
      for (const x of [-0.12, 0.12]) this.box(0.15, 0.1, 0.03, 0xbfe8db, x, 0, 0.08, 0.02, g);
    } else return null;
    return g;
  }
  syncCoach(sim, time, dt) {
    const c = sim.coach,
      cg = this.coach,
      cu = cg.userData;
    const firstPerson = this.viewMode === "coach";
    if (firstPerson) this.coachCam.update(sim, time, dt);
    else if (this.viewDirection && sim.status !== "ready")
      this.followCoach(c, this.realDt ?? dt, this.attention(sim));
    const rig = cu.rig;
    // Coach Panic walks in while the countdown runs, and is at the spawn point when it reaches zero.
    let intro = null;
    if (rig && sim.status === "countdown") {
      this.introPlan ||= planIntro(sim);
      if (this.introPlan.length > 0)
        intro = { ...introAt(this.introPlan, sim.countdown), rate: this.introPlan.rate };
    }
    cg.visible = !firstPerson;
    cg.position.set(intro ? intro.x : c.x, c.y || 0, intro ? intro.z : c.z);
    const angle = intro ? intro.angle : c.angle || 0;
    cg.rotation.y += Math.atan2(Math.sin(angle - cg.rotation.y), Math.cos(angle - cg.rotation.y)) * 0.3;
    const walking = Math.hypot(c.vx || 0, c.vz || 0) > 0.2,
      air = (c.y || 0) > 0.03;
    cu.root.position.set(0, 0, 0);
    cu.root.rotation.set(0, 0, 0);
    cu.carry.position.set(...(cu.carryHome || [0.58, 0.9, 0.25]));
    cu.carry.rotation.set(0, 0, 0);
    cu.arms.forEach((a) => (a.rotation.z = 0));
    cu.arms.forEach(
      (a, i) =>
        (a.rotation.x =
          c.carry && i === 1 ? -0.9 : air ? -0.5 : walking ? Math.sin(time * 12 + i * Math.PI) * 0.65 : 0),
    );
    cu.legs.forEach(
      (l, i) => (l.rotation.x = air ? -0.3 : walking ? Math.sin(time * 12 + i * Math.PI) * 0.65 : 0),
    );
    cu.root.position.y = walking && !air && !rig ? Math.abs(Math.sin(time * 12)) * 0.045 : 0; // the model bobs in its clips
    cu.root.rotation.x = c.dashTime > 0 && !this.reducedMotion.matches ? 0.25 : 0;
    this.dashTrail.visible =
      !firstPerson && c.dashTime > 0 && sim.status === "playing" && !this.reducedMotion.matches;
    this.dashTrail.position.copy(cg.position);
    this.dashTrail.rotation.y = c.angle;
    const coachLean = bumpLean(c, this.reducedMotion.matches);
    cu.root.rotation.x += coachLean.x;
    cu.root.rotation.z += coachLean.z;
    const scaleY = c.landing ? 1 - 0.17 * (c.landing / 0.18) : air ? 1 + Math.max(0, c.vy || 0) * 0.017 : 1;
    cu.root.scale.set(1 / Math.sqrt(scaleY), scaleY, 1 / Math.sqrt(scaleY));
    cu.shadow.position.y = 0.03 - (c.y || 0);
    cu.shadow.scale.setScalar(1 + (c.y || 0) * 0.25);
    this.coachHalo.position.set(c.x, 0.034, c.z);
    this.coachHalo.scale.setScalar(c.dashTime > 0 ? 1.18 : 1);
    this.coachHalo.visible = sim.status !== "ready" && !firstPerson;
    const nearby = sim.nearestInteraction(),
      marker = nearby || c.goal;
    this.actionHalo.visible = !!marker && sim.status === "playing";
    if (marker) {
      this.actionHalo.position.set(marker.x, 0.055, marker.z);
      this.actionHalo.scale.setScalar(1 + Math.sin(time * 5) * 0.08);
    }
    cu.carry.visible = !!c.carry;
    cu.carry.scale.setScalar(1 + (c.feedback || 0) * 1.1);
    if (c.carry !== cu.carryKind) {
      cu.carry.clear();
      cu.carryKind = c.carry;
      const item = this.carryObject(c.carry);
      if (item) cu.carry.add(item);
    }
    if (c.carry === "lifering") {
      cu.carry.position.set(0, 1.02, 0.55);
      cu.arms.forEach((a) => a.rotation.set(-1.15, 0, 0));
    }
    this.incidentView.poseCoach(sim, cu, time);
    if (c.swimming || c.waterTransition) {
      const transition = c.waterTransition;
      const prone = transition
        ? transition.kind === "dive"
          ? Math.min(1, transition.t * 2)
          : 1 - transition.t
        : 1;
      cu.root.rotation.set((Math.PI / 2) * prone, 0, 0);
      cu.root.position.set(0, 0.27 * prone, -0.65 * prone);
      cu.root.scale.setScalar(1);
      cu.shadow.visible = false;
      const reaching = c.carry === "lifering" || c.carry === "fishnet";
      cu.arms.forEach((a, i) =>
        a.rotation.set(reaching ? Math.PI : Math.sin(time * 9 + i * Math.PI) * 1.3, 0, 0),
      );
      cu.legs.forEach((l, i) => (l.rotation.x = Math.sin(time * 13 + i * Math.PI) * 0.24));
      if (c.carry === "lifering") cu.carry.position.set(0, 1.88, 0.05);
      if (c.carry === "fishnet") {
        // Root is prone here: its local +Y points forward, so the pole is laid along +Y ahead of the coach.
        cu.carry.position.set(0, 0.7, -0.45);
        cu.carry.rotation.set(-Math.PI / 2 + 0.28, 0, 0);
        cu.carry.scale.setScalar(0.6);
      }
      this.coachHalo.visible = false;
      this.dashTrail.visible = false;
    } else cu.shadow.visible = true;
    if (!c.swimming && !c.waterTransition) this.slipPose(cu, c.slipTime, 0.7);
    if (c.carry === "skimmer") {
      const waste = cu.carry.getObjectByName("caught-waste");
      if (waste) waste.visible = !!c.skimmerLoaded;
      cu.carry.visible = !(c.scoopTimer > 0);
    }
    if (rig) {
      try {
        rig.update(dt, {
          speed: Math.hypot(c.vx || 0, c.vz || 0),
          intro,
          prone: !!(c.swimming || c.waterTransition),
          ring: c.carry === "lifering",
          busy: !!c.busy,
        });
      } catch (error) {
        // A failing model must not stop the shift: show the classic coach from here on.
        console.error(error);
        dropCoachModel(cg);
      }
    }
  }

  syncRescue(sim, time) {
    for (const r of sim.lifeRings || []) {
      const g = this.ringModels[r.id],
        hit = this.ringHits[r.id],
        glow = this.ringGlows[r.id],
        light = this.ringLights[r.id];
      g.visible = r.state !== "coach";
      g.rotation.set(0, 0, 0);
      g.scale.setScalar(1);
      const pulse = this.reducedMotion.matches ? 1 : 0.5 + 0.5 * Math.sin(time * 5);
      const needed = !!sim.rescue && sim.rescue.stage === "stranded";
      if (r.state === "wall") {
        g.position.set(r.mount.x, 1.65, r.mount.z);
        g.rotation.y = r.mount.angle;
        if (needed) g.scale.setScalar(1.04 + pulse * 0.08);
      } else if (r.state === "deck") {
        g.position.set(r.x, 0.17, r.z);
        g.rotation.x = -Math.PI / 2;
      } else if (r.state === "victim") {
        const p = sim.get(r.owner);
        if (p) {
          const y =
            p.status === "injured"
              ? 0.17
              : p.exitPhase === "water"
                ? -0.1
                : p.exitPhase === "climb"
                  ? -0.1 + p.exitProgress * 0.9
                  : 0.8;
          g.position.set(p.x + (p.status === "injured" ? 0.9 : 0), y, p.z);
          g.rotation.x = -Math.PI / 2;
        }
      }
      hit.position.copy(g.position);
      if (r.state === "coach") hit.position.set(r.mount.x, 1.65, r.mount.z);
      hit.layers.mask = sim.level >= 2 && ["wall", "deck", "coach"].includes(r.state) ? 1 : 0;
      glow.visible = needed && ["wall", "deck"].includes(r.state);
      const a = r.state === "wall" ? r.mount.angle : 0;
      glow.position.set(r.x + Math.sin(a) * 0.55, 0.035, r.z + Math.cos(a) * 0.55);
      glow.scale.setScalar(0.93 + pulse * 0.16);
      glow.children[0].material.opacity = 0.22 + pulse * 0.24;
      light.position.set(glow.position.x, 0.65, glow.position.z);
      light.intensity = glow.visible ? 1.8 + pulse * 2 : 0;
    }
  }

  syncClutter(sim) {
    const dropIds = new Set();
    for (const f of sim.clutter) {
      dropIds.add(f.id);
      if (!this.drops.has(f.id)) {
        const g = f.type === "fins" ? finsObject(this) : new THREE.Group();
        if (f.type === "goggles") {
          this.box(0.45, 0.1, 0.13, COLORS.navy, 0, 0, 0, 0.04, g);
          this.box(0.14, 0.11, 0.02, COLORS.blue, -0.12, 0, 0.08, 0.01, g);
          this.box(0.14, 0.11, 0.02, COLORS.blue, 0.12, 0, 0.08, 0.01, g);
        }
        g.position.set(f.x, 0.08, f.z);
        g.rotation.x = -Math.PI / 2;
        g.rotation.z = 0.5;
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.52, 6, 5),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        hit.userData = { kind: "clutter", id: f.id };
        g.add(hit);
        g.userData.hit = hit;
        this.clickables.push(hit);
        this.scene.add(g);
        this.drops.set(f.id, g);
      }
      const g = this.drops.get(f.id);
      g.position.set(f.x, 0.08, f.z);
    }
    for (const [id, g] of this.drops)
      if (!dropIds.has(id)) {
        this.scene.remove(g);
        this.clickables = this.clickables.filter((x) => x !== g.userData.hit);
        this.drops.delete(id);
      }
  }

  showIncident(x, z) {
    if (!this.incident) {
      this.incident = pooObject(this);
      this.scene.add(this.incident);
    }
    this.incident.visible = true;
    this.incident.position.set(x, 0, z);
  }
  syncSanitation(sim, time) {
    const q = sim.cleanup,
      c = sim.coach;
    this.sanitationGroup.visible = sim.level >= 3;
    this.skimmerRack.visible = c.carry !== "skimmer";
    if (q?.stage === "floating") {
      this.showIncident(q.x, q.z);
      this.incident.position.y = -0.15 + Math.sin(time * 3) * 0.065;
      this.incident.rotation.y = q.elapsed * 0.55;
    } else if (this.incident) this.incident.visible = false;
    this.scoopCast.visible = !!(c.scoopTimer > 0 && c.scoopTarget);
    if (this.scoopCast.visible) {
      const from = new THREE.Vector3(c.x, 1.05, c.z),
        progress = 1 - c.scoopTimer / 0.42,
        to = new THREE.Vector3(c.scoopTarget.x, -0.08 + Math.sin(progress * Math.PI) * 0.35, c.scoopTarget.z),
        delta = to.clone().sub(from);
      this.scoopShaft.position.copy(from).add(to).multiplyScalar(0.5);
      this.scoopShaft.scale.y = delta.length();
      this.scoopShaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      this.scoopNet.position.copy(to);
    }
  }

  splash(x, y, z, n = 9, quiet = false, color = 0xc4f7e8) {
    if (this.noParticles) return;
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 220) break;
      const p = this.ball(quiet ? 0.055 : 0.09, this.mat(color, { roughness: 0.2 }), x, y, z);
      p.castShadow = false;
      this.particles.push({
        mesh: p,
        life: 0.35 + Math.random() * 0.4,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 1.6,
          1 + Math.random() * 2,
          (Math.random() - 0.5) * 1.6,
        ),
      });
    }
  }
  // Big radial splash for cannonballs, fish drops and trampoline landings.
  bigSplash(x, z, size = 1) {
    if (this.noParticles) return;
    for (let i = 0; i < 38 * size; i++) {
      if (this.particles.length > 260) break;
      const a = Math.random() * Math.PI * 2,
        s = (1.2 + Math.random() * 2.6) * size;
      const p = this.ball(0.12, this.mat(0xd8fbf2, { roughness: 0.2 }), x, 0, z);
      p.castShadow = false;
      this.particles.push({
        mesh: p,
        life: 0.6 + Math.random() * 0.6,
        grow: 1.2,
        gravity: 9,
        velocity: new THREE.Vector3(Math.cos(a) * s, 3 + Math.random() * 4.5 * size, Math.sin(a) * s),
      });
    }
  }
  // Rising sparkles for first aid.
  sparkle(x, z, n = 16) {
    if (this.noParticles) return;
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 260) break;
      const p = this.ball(
        0.06,
        this.mat(i % 2 ? 0xfff3a8 : 0xffffff, { roughness: 0.3, emissive: 0x665a20 }),
        x + (Math.random() - 0.5) * 0.7,
        0.5 + Math.random() * 0.5,
        z + (Math.random() - 0.5) * 0.7,
      );
      p.castShadow = false;
      this.particles.push({
        mesh: p,
        life: 0.7 + Math.random() * 0.5,
        grow: 1.2,
        gravity: -1.4,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          0.8 + Math.random(),
          (Math.random() - 0.5) * 0.8,
        ),
      });
    }
  }
  confetti() {
    if (this.noParticles) return;
    for (let i = 0; i < 70; i++) {
      const m = this.box(
        0.12,
        0.12,
        0.04,
        [COLORS.coral, COLORS.yellow, COLORS.teal, 0xffffff][i % 4],
        (Math.random() - 0.5) * 12,
        6 + Math.random() * 5,
        (Math.random() - 0.5) * 12,
        0.005,
      );
      this.particles.push({
        mesh: m,
        life: 2 + Math.random(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          2 + Math.random() * 3,
          (Math.random() - 0.5) * 4,
        ),
      });
    }
  }

  // Switch between the overview camera and the first-person Coach Cam (hands, head bob, mouse look).
  setViewMode(mode, sim = null) {
    const next = mode === "coach" ? "coach" : "overview";
    if (next === this.viewMode && !sim) return;
    this.viewMode = next;
    // The sky, the horizon and the hall's upper structure are only for the Coach Cam: the overview looks down on
    // the room like a dollhouse and would find them in its way.
    this.sky?.setVisible(next === "coach");
    this.hall?.setCoach(next === "coach");
    if (this.coachCam?.inline) this.coachCam.inline.visible = next === "coach"; // ?handsinline: not in the overview
    if (next === "coach" && sim) this.coachCam.reset(sim);
    if (next !== "coach" && typeof document !== "undefined" && document.pointerLockElement)
      document.exitPointerLock?.();
    this.resize();
  }
  resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    this.renderer?.setSize(w, h);
    if (this.viewMode === "coach") {
      // Full-screen first-person projection: no view offset for the overview's HUD framing.
      this.camera.clearViewOffset();
      this.camera.aspect = w / h;
      this.camera.near = 0.06;
      this.camera.fov = this.coachCam.verticalFov(w / h);
      this.camera.updateProjectionMatrix();
      this.coachCam.resize(w / h);
      return;
    }
    this.camera.near = 0.1;
    this.camera.aspect = w / h;
    this.camera.fov = 42;
    const reserve = w <= 620 ? (h <= 740 ? Math.max(220, 820 - h * 0.9) : 150) : h <= 540 ? 86 : 0;
    this.playHeight = Math.max(150, h - reserve);
    // Extend the camera below the play area: room scenery fills behind the touch HUD too.
    this.camera.setViewOffset(w, this.playHeight, 0, 0, w, h);
    // Frame for width instead of shrinking the entire room to fit inside a tabletop margin.
    this.viewDirection = new THREE.Vector3(-0.65, 0.76, 0).normalize();
    const distance = Math.max(
      20.5,
      Math.min(64, 30 / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect)),
    );
    this.cameraDistance = distance * (this.venue.cameraScale || 1);
    this.placeCamera();
  }
  // ?nolights: only the sun, the fill and the two sky lights stay (every lamp, the fuse box and the flashlight go).
  stripLocalLights() {
    const gone = [];
    for (const root of [this.scene, this.coachCam?.scene])
      root?.traverse((o) => {
        if (o.isPointLight || o.isSpotLight) gone.push(o);
      });
    for (const light of gone) light.removeFromParent();
  }
  placeCamera() {
    this.camera.position
      .copy(this.target)
      .addScaledVector(this.viewDirection, this.cameraDistance / (this.zoom * this.autoZoom));
    this.camera.lookAt(this.target);
    if (this.shake > 0 && !this.reducedMotion.matches) {
      const s = this.shake * 0.35;
      this.camera.position.x += Math.sin(this.clock * 61) * s;
      this.camera.position.z += Math.cos(this.clock * 53) * s;
      this.camera.position.y += Math.sin(this.clock * 47) * s * 0.5;
    }
    this.camera.updateMatrixWorld(true);
  }
  // Brief camera shake for big moments (skipped with reduced motion).
  kick(amount = 0.5) {
    this.shake = Math.max(this.shake || 0, amount);
  }
  // An incident sting: for a moment the overview makes room for the incident as well as the coach. The Coach
  // Cam never turns the player's head, and reduced motion keeps the camera still.
  focusMoment(x, z, seconds) {
    if (this.viewMode === "coach" || this.reducedMotion.matches || !Number.isFinite(x + z)) return;
    this.moment = { x, z, left: seconds };
  }
  // Save payoff: a fountain of confetti from the spot.
  burst(x, z, big = true) {
    if (this.noParticles) return;
    this.cheer = Math.min(1, this.cheer + (big ? 0.7 : 0.3));
    const colors = [COLORS.coral, COLORS.yellow, COLORS.teal, 0xffffff];
    for (let i = 0; i < (big ? 44 : 22); i++) {
      if (this.particles.length > 300) break;
      const a = Math.random() * Math.PI * 2,
        s = (big ? 2.4 : 1.6) * (0.35 + Math.random());
      const m = this.box(0.13, 0.13, 0.03, colors[i % 4], x, 0.7, z, 0.005);
      m.castShadow = false;
      this.particles.push({
        mesh: m,
        life: 0.9 + Math.random() * 0.6,
        grow: 1,
        gravity: 7.5,
        spin: 5 + Math.random() * 9,
        velocity: new THREE.Vector3(Math.cos(a) * s, 3.8 + Math.random() * 3, Math.sin(a) * s),
      });
    }
  }
  cameraBounds() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight,
      portrait = w <= 620;
    return {
      left: portrait ? 24 : Math.min(255, w * 0.22),
      right: w - (portrait ? 24 : Math.min(245, w * 0.22)),
      top: portrait ? 151 : 105,
      bottom: portrait ? Math.max(300, h - 366) : h <= 540 ? h - 145 : h - 135,
    };
  }
  // Points the follow camera keeps on screen when the coach stands near them.
  cameraAnchors() {
    const v = this.venue;
    return [
      ...Object.values(v.stations),
      v.sanitation.rack,
      v.sanitation.bin,
      ...Object.values(v.fixtures || {}).filter((p) => p && Number.isFinite(p.x)),
    ];
  }
  // Big moments the camera should frame alongside the coach: the trampoline tower during a jump, the stranded
  // victims of a crash, and (for the length of its sting) wherever a new incident just started.
  attention(sim) {
    if (this.moment?.left > 0) {
      const m = new THREE.Vector3(this.moment.x, 1.2, this.moment.z);
      m.moment = true;
      return [m];
    }
    if (sim.rescue?.kind === "crash")
      return (sim.strandedVictims?.() || [])
        .sort((a, b) => b.x - a.x)
        .slice(0, 1)
        .map((v) => new THREE.Vector3(v.x, 1.6, v.z));
    const tr = this.venue.trampoline,
      j = tr && sim.get?.(sim.jumper);
    if (!j || !["waiting", "climbing", "boarding", "bouncing", "flying"].includes(j.jumpStage)) return [];
    return [
      new THREE.Vector3(tr.bedX - 1.2, tr.bedY + 2.4, tr.z),
      new THREE.Vector3(this.venue.lanes[tr.lane], 0, tr.landZ),
    ];
  }
  followCoach(c, dt, focus = []) {
    const follow = this.venue.cameraFollow || { kx: 0.22, maxX: 2.4 };
    const target = new THREE.Vector3(
      clamp(c.x * follow.kx, -follow.maxX, follow.maxX),
      0.45,
      clamp(c.z * 0.13, -1.5, 1.5) - 3.2,
    );
    // Ease out while something spectacular needs to share the screen with the coach: the zoom goal keeps
    // widening until the focus fits (within limits) and relaxes again afterwards.
    const ease = 1 - Math.exp(-dt * 2.5),
      bounds = this.cameraBounds();
    if (focus.length) {
      const top = this.project(focus[0].x, focus[0].y, focus[0].z).y,
        settled = Math.abs(this.autoZoom - (this.zoomGoal ?? 0.9)) < 0.015;
      this.zoomGoal = clamp(
        (this.zoomGoal ?? 0.9) +
          (!settled ? 0 : top < bounds.top + 10 ? -0.25 : top > bounds.top + 70 ? 0.15 : 0) * dt,
        0.72,
        0.95,
      );
      target.x = (target.x + focus[0].x * 0.35) / 1.35;
    } else this.zoomGoal = null;
    this.autoZoom += ((this.zoomGoal ?? 1) - this.autoZoom) * ease;
    this.target.lerp(target, ease);
    this.placeCamera();
    // Keep the close view, but pan far enough to retain the coach and nearby equipment. Focus points go
    // first so the coach always wins when both cannot fit.
    for (const p of focus) p.focus = true;
    const points = [
      ...focus,
      new THREE.Vector3(c.x, c.y + 0.1, c.z - 0.5),
      new THREE.Vector3(c.x, c.y + 2.15, c.z + 0.5),
    ];
    for (const p of this.cameraAnchors())
      if (Math.hypot(c.x - p.x, c.z - p.z) < 3.3)
        points.push(new THREE.Vector3(p.x, 0.1, p.z - 0.65), new THREE.Vector3(p.x, 2.7, p.z + 0.65));
    const w = this.container.clientWidth,
      h = this.container.clientHeight,
      ray = new THREE.Raycaster(),
      plane = new THREE.Plane(),
      hit = new THREE.Vector3();
    for (let pass = 0; pass < 3; pass++)
      for (const p of points) {
        const screen = this.project(p.x, p.y, p.z),
          x = clamp(screen.x, bounds.left, bounds.right),
          y = clamp(screen.y, bounds.top, bounds.bottom);
        if (Math.abs(x - screen.x) + Math.abs(y - screen.y) < 0.1) continue;
        ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, 1 - (y / h) * 2), this.camera);
        plane.set(new THREE.Vector3(0, 1, 0), -p.y);
        if (ray.ray.intersectPlane(plane, hit)) {
          // Only correct the clamped axis (screen up/down is world X, left/right is world Z) so fixes never
          // drift sideways with the perspective. Focus points only ever pull the view up or down; a new
          // incident's point pulls both ways, but softly, so the view glides over instead of cutting.
          const k = p.moment ? 1 - Math.exp(-dt * 5) : 1;
          if (Math.abs(y - screen.y) > 0.05) this.target.x += (p.x - hit.x) * k;
          if (Math.abs(x - screen.x) > 0.05 && (!p.focus || p.moment)) this.target.z += (p.z - hit.z) * k;
          this.placeCamera();
        }
      }
  }
  zoomBy(f) {
    // In the Coach Cam, zoom narrows or widens the field of view instead.
    if (this.viewMode === "coach") this.coachCam.adjustFov(f > 1 ? -3 : 3);
    else this.zoom = clamp(this.zoom * f, 0.9, 1.3);
    this.resize();
  }
  resetView() {
    this.zoom = 1;
    this.coachCam.hfov = COACH_CAM.hfov;
    this.resize();
  }
  // What the Coach Cam crosshair is on (a clickable's userData), or null.
  centerTarget() {
    return this.viewMode === "coach" ? this.coachCam.centerTarget(this.raycaster, this.clickables) : null;
  }
  pickAt(nx, ny) {
    this.pointer.set(nx, ny);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.clickables, false);
    if (hits[0]) this.onPick(hits[0].object.userData);
  }
  handoff(from, to, item) {
    const mesh = item === "fins" ? finsObject(this) : new THREE.Group();
    if (item !== "fins")
      this.ball(
        0.15,
        item === "relief" ? 0x78c7ce : item === "medkit" ? 0xe0513f : COLORS.navy,
        0,
        0,
        0,
        mesh,
      );
    this.scene.add(mesh);
    this.handoffs.push({ mesh, from, to, elapsed: 0 });
  }
  // Screen position of a world point, whether it is behind the camera (the Coach Cam can face away), and how far
  // it sits to the right (1) or left (-1) of the camera's back.
  screenPoint(x, y, z) {
    const v = new THREE.Vector3(x, y, z),
      local = v.clone().applyMatrix4(this.camera.matrixWorldInverse);
    v.project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.container.clientWidth,
      y: (-v.y * 0.5 + 0.5) * this.container.clientHeight,
      behind: local.z > 0,
      lean: local.x / (Math.hypot(local.x, local.z) || 1),
    };
  }
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.container.clientWidth,
      y: (-v.y * 0.5 + 0.5) * this.container.clientHeight,
      visible: v.z < 1,
    };
  }
  bindInput() {
    const canvas = this.renderer.domElement;
    let start = null;
    const ndc = (e) => {
      const rect = canvas.getBoundingClientRect();
      return [
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ];
    };
    const locked = () => document.pointerLockElement === canvas;
    canvas.addEventListener("pointerdown", (e) => {
      start = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: 0 };
    });
    canvas.addEventListener("pointerup", (e) => {
      if (this.viewMode === "coach") {
        // Coach Cam: with the mouse captured, a click acts on whatever the crosshair names. Otherwise a click
        // captures the mouse for looking around, and a tap acts on what was tapped.
        if (locked()) {
          const target = this.centerTarget();
          if (target) this.onPick(target);
        } else if (start && start.moved < 10) {
          if (e.pointerType === "mouse" && this.canLook?.()) {
            try {
              const request = canvas.requestPointerLock?.();
              request?.catch?.(() => {});
            } catch {}
          } else this.pickAt(...ndc(e));
        }
        start = null;
        return;
      }
      if (!start || Math.hypot(start.x - e.clientX, start.y - e.clientY) > 10) return;
      this.pickAt(...ndc(e));
      start = null;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (this.viewMode === "coach") {
        if (locked()) this.coachCam.look(e.movementX || 0, e.movementY || 0);
        else if (start && (e.buttons || e.pointerType !== "mouse")) {
          // Drag to look (touch, or a mouse that has not been captured).
          const dx = e.clientX - start.lastX,
            dy = e.clientY - start.lastY;
          start.lastX = e.clientX;
          start.lastY = e.clientY;
          start.moved += Math.abs(dx) + Math.abs(dy);
          this.coachCam.look(
            dx,
            dy,
            e.pointerType === "mouse" ? COACH_CAM.sensitivity * 1.6 : COACH_CAM.touchSensitivity,
          );
        }
        canvas.style.cursor = locked() ? "none" : "grab";
        return;
      }
      this.pointer.set(...ndc(e));
      this.raycaster.setFromCamera(this.pointer, this.camera);
      canvas.style.cursor = this.raycaster.intersectObjects(this.clickables, false).length
        ? "pointer"
        : "default";
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoomBy(e.deltaY < 0 ? 1.035 : 0.966);
      },
      { passive: false },
    );
  }
  render() {
    this.renderer.render(this.scene, this.camera);
    if (this.viewMode === "coach" && !this.tune.has("nohands")) this.coachCam.render(this.renderer);
  }
}
