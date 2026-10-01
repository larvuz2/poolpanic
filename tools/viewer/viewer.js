// Anim Bench: preview every clip of a rigged character in the browser, with the game's own three.js.
// Characters come from characters.json (one GLB each, more clips may come from extra GLBs); any .glb can also be
// dropped on the page. Everything a reviewer wants to know about a clip is shown next to it: length, whether it loops
// without a jump, whether any bone turns more than POP_DEG in a single frame, and how fast the ground must move so the
// planted foot does not slide.
import * as THREE from "./three.module.js";
import { GLTFLoader } from "./GLTFLoader.js";
import { OrbitControls } from "./OrbitControls.js";

const FPS = 24; // the clips are authored at 24 frames per second
const POP_DEG = 40; // a bone turning more than this in one frame is flagged
const CYCLE_SECONDS = 3; // "Cycle clips" plays every clip at least this long
const BACKDROPS = { dark: "#171b21", mid: "#59606b", light: "#dfe3ea", green: "#14a84a" };

const $ = (selector) => document.querySelector(selector);
const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem("animbench." + key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("animbench." + key, JSON.stringify(value));
    } catch {
      /* storage can be blocked; nothing depends on it */
    }
  },
};
const pad = (n, width) => String(n).padStart(width, " ");

const S = {
  entries: [], // {id, name, file?, buffer?, note?, clipFiles?}
  character: null, // the loaded character: {root, mixer, clips, stats, height, ...}
  clip: null, // the clip entry playing now
  playing: true,
  speed: store.get("speed", 1),
  once: false,
  cycle: false,
  blend: store.get("blend", 0.25),
  ground: 0,
  loops: 0,
  backdrop: store.get("backdrop", "auto"),
  cache: new Map(),
};

// ---- the scene ----------------------------------------------------------------------------------------------------

const stage = $("#stage");
const canvas = $("#gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.5;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotateSpeed = 2.5;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8792a6, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 1.9);
key.position.set(2.6, 4.4, 3.4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = key.shadow.camera.bottom = -2.4;
key.shadow.camera.right = key.shadow.camera.top = 2.4;
key.shadow.camera.far = 14;
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.02;
scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd0ff, 0.5);
fill.position.set(-3, 2, -2.5);
scene.add(fill);

// The floor: a 1 m grid that can scroll under the character (Ground slider), plus a plane that only catches shadow.
const floorTexture = new THREE.CanvasTexture(document.createElement("canvas"));
floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.colorSpace = THREE.SRGBColorSpace;
floorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
floorTexture.repeat.set(48, 48);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), new THREE.MeshBasicMaterial({ map: floorTexture }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), new THREE.ShadowMaterial({ opacity: 0.32 }));
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = 0.002;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);

function backdropColor() {
  if (S.backdrop in BACKDROPS) return BACKDROPS[S.backdrop];
  return getComputedStyle(document.documentElement).getPropertyValue("--stage").trim() || BACKDROPS.dark;
}

function paintBackdrop() {
  const color = backdropColor();
  const tone = new THREE.Color(color);
  const { l } = tone.getHSL({}, THREE.SRGBColorSpace);
  const ink = l < 0.5 ? "255,255,255" : "0,0,0";
  const c = floorTexture.image;
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = `rgba(${ink},0.06)`; // the half-metre lines
  g.fillRect(127, 0, 2, 256);
  g.fillRect(0, 127, 256, 2);
  g.fillStyle = `rgba(${ink},0.18)`; // the metre lines
  g.fillRect(0, 0, 256, 2);
  g.fillRect(0, 0, 2, 256);
  floorTexture.needsUpdate = true;
  scene.background = tone;
  scene.fog = new THREE.Fog(tone, 9, 26);
  for (const b of document.querySelectorAll("[data-bd]")) b.setAttribute("aria-pressed", String(b.dataset.bd === S.backdrop));
}

function resize() {
  const w = Math.max(1, stage.clientWidth);
  const h = Math.max(1, stage.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

// ---- notes --------------------------------------------------------------------------------------------------------

let noteTimer = 0;
function note(text, kind = "info", ms = 0) {
  const box = $("#note");
  clearTimeout(noteTimer);
  box.hidden = !text;
  box.textContent = text || "";
  box.classList.toggle("error", kind === "error");
  if (text && ms) noteTimer = setTimeout(() => (box.hidden = true), ms);
}

// ---- loading ------------------------------------------------------------------------------------------------------

const loader = new GLTFLoader();

// A GLB's textures are decoded from blob: URLs. The default path for that fetch()es them, and the page's frame may not
// allow that, so hide createImageBitmap for the moment the loader is made and it falls back to plain <img> loading.
function parseGLB(buffer) {
  return new Promise((resolve, reject) => {
    const saved = window.createImageBitmap;
    window.createImageBitmap = undefined;
    try {
      loader.parse(buffer, "", resolve, reject);
    } catch (error) {
      reject(error);
    } finally {
      window.createImageBitmap = saved;
    }
  });
}

// The published page cannot serve .glb files, so a model arrives as base64 text (models/x.glb.b64.txt); a plain .glb
// (served straight from a folder while developing) works too.
async function fetchBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  if (!url.endsWith(".b64.txt")) return response.arrayBuffer();
  const binary = atob((await response.text()).replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const letters = (name) => name.split(":").pop().toLowerCase().replace(/[^a-z]/g, "");
function findFoot(root, side) {
  const wanted = [side + "foot", "foot" + side[0]];
  let found = null;
  root.traverse((o) => {
    if (o.isBone && !found && wanted.includes(letters(o.name))) found = o;
  });
  return found;
}

// Per clip: does it loop without a jump, and does any bone turn a lot in one frame?
function analyse(clip) {
  let closed = true;
  let maxDeg = 0;
  let worst = "";
  for (const track of clip.tracks) {
    const n = track.getValueSize();
    const t = track.times;
    const v = track.values;
    const count = t.length;
    if (count < 2) continue;
    if (n === 4) {
      const turn = (i, j) => {
        const d = v[i * 4] * v[j * 4] + v[i * 4 + 1] * v[j * 4 + 1] + v[i * 4 + 2] * v[j * 4 + 2] + v[i * 4 + 3] * v[j * 4 + 3];
        return (2 * Math.acos(Math.min(1, Math.abs(d))) * 180) / Math.PI;
      };
      if (turn(0, count - 1) > 0.25) closed = false;
      for (let i = 0; i < count - 1; i++) {
        const perFrame = turn(i, i + 1) / Math.max((t[i + 1] - t[i]) * FPS, 1e-6);
        if (perFrame > maxDeg) {
          maxDeg = perFrame;
          worst = track.name.split(".")[0];
        }
      }
    } else {
      for (let k = 0; k < n; k++) if (Math.abs(v[k] - v[(count - 1) * n + k]) > 1e-3) closed = false;
    }
  }
  return { duration: clip.duration, frames: Math.round(clip.duration * FPS), tracks: clip.tracks.length, closed, maxDeg, worst };
}

// How fast the ground must move (m/s) for the planted foot to stay still: the mean backward speed of whichever foot is
// on the floor. Null for clips that stay in place (idles) or where the feet do not plant.
function groundSpeed(character, entry) {
  const feet = [findFoot(character.root, "left"), findFoot(character.root, "right")];
  const frames = entry.info.frames;
  if (!feet[0] || !feet[1] || frames < 4) return null;
  const { mixer, root } = character;
  mixer.stopAllAction();
  const action = entry.action;
  action.reset().play();
  const path = feet.map(() => []);
  for (let i = 0; i < frames; i++) {
    action.time = i / FPS;
    mixer.update(0);
    root.updateMatrixWorld(true);
    feet.forEach((bone, k) => path[k].push(bone.getWorldPosition(new THREE.Vector3())));
  }
  mixer.stopAllAction();
  // In each frame the lower foot is the planted one; its backward speed is the speed the ground must move at.
  const floorY = Math.min(...path.flat().map((p) => p.y));
  const planted = 0.04 * (character.height / 1.75); // 4 cm on the 1.75 m Coach, in proportion on a child
  const speeds = [];
  for (let i = 0; i < frames; i++) {
    const k = path[0][i].y <= path[1][i].y ? 0 : 1;
    if (path[k][i].y > floorY + planted) continue; // both feet are in the air
    const next = path[k][(i + 1) % frames];
    const before = path[k][(i - 1 + frames) % frames];
    const speed = -(next.z - before.z) / (2 / FPS); // forward is +Z, so a planted foot moves to -Z
    if (speed > 0) speeds.push(speed); // a foot still moving forward is landing, not planted
  }
  if (speeds.length < 4) return null;
  const sorted = [...speeds].sort((x, y) => x - y);
  const median = sorted[sorted.length >> 1];
  const steady = speeds.filter((v) => Math.abs(v - median) < 0.35 * median);
  return median > 0.15 && steady.length >= 0.6 * speeds.length ? steady.reduce((x, y) => x + y, 0) / steady.length : null;
}

async function buildCharacter(entry) {
  const buffer = entry.buffer || (await fetchBuffer(entry.file));
  const gltf = await parseGLB(buffer);
  const root = gltf.scene;
  const sources = gltf.animations.map((clip) => ({ clip, source: entry.name }));
  for (const file of entry.clipFiles || []) {
    const extra = await parseGLB(await fetchBuffer(file));
    extra.animations.forEach((clip) => sources.push({ clip, source: file }));
  }
  let triangles = 0;
  let vertices = 0;
  let skeleton = null;
  const materials = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false; // a skinned mesh's bounds are those of its bind pose
    const position = o.geometry.attributes.position.count;
    vertices += position;
    triangles += o.geometry.index ? o.geometry.index.count / 3 : position / 3;
    materials.add(o.material);
    if (o.isSkinnedMesh && !skeleton) skeleton = o.skeleton;
  });
  const textures = new Set();
  for (const m of materials)
    for (const slot of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"]) if (m[slot]) textures.add(m[slot]);
  root.updateMatrixWorld(true);
  root.traverse((o) => o.isSkinnedMesh && o.skeleton.update());
  const box = new THREE.Box3().setFromObject(root, true);
  const mixer = new THREE.AnimationMixer(root);
  const names = new Set();
  const clips = sources.map(({ clip, source }) => {
    let name = clip.name || "clip";
    for (let i = 2; names.has(name); i++) name = `${clip.name} (${i})`;
    names.add(name);
    return { name, clip, source, action: mixer.clipAction(clip), info: analyse(clip) };
  });
  const character = {
    entry,
    root,
    mixer,
    clips,
    bytes: buffer.byteLength,
    height: Math.max(0.1, box.max.y - box.min.y),
    feetY: box.min.y,
    stats: {
      triangles,
      vertices,
      bones: skeleton ? skeleton.bones.length : 0,
      materials: materials.size,
      textures: [...textures].map((t) => (t.image ? `${t.image.width}×${t.image.height}` : "?")),
    },
    helper: null,
  };
  for (const c of clips) c.ground = groundSpeed(character, c); // stopAllAction puts the bones back at rest
  wireMixer(character);
  return character;
}

async function openCharacter(entry) {
  note(`Loading ${entry.name}…`);
  try {
    let character = S.cache.get(entry.id);
    if (!character) {
      character = await buildCharacter(entry);
      S.cache.set(entry.id, character);
    }
    activate(character);
    note("");
  } catch (error) {
    console.error(error);
    note(`Could not load ${entry.name}: ${error.message || error}`, "error");
  }
}

// ---- showing a character ------------------------------------------------------------------------------------------

// Frames the character between the readouts: the head (and the name plate over it, for a premium character) below the one
// at the top of the stage, the feet above the one at the bottom. It is as large as 2.7 character heights away gives, and
// smaller where the stage is short (a phone).
function setCamera(azimuthDeg, elevationDeg = 7) {
  const c = S.character;
  const h = c ? c.height : 1.8;
  const stageH = Math.max(160, stage.clientHeight);
  const top = 14 + ($(".hud-top")?.offsetHeight || 24) + (c?.entry.premium ? 58 : 14); // under the readout (and the name plate)
  const bottom = stageH - 48;
  const half = Math.tan((camera.fov * Math.PI) / 360);
  const pixelsPerMetre = Math.min(stageH / 2 / (2.7 * h * half), (bottom - top) / (h * 1.05));
  const d = stageH / 2 / (pixelsPerMetre * half);
  const target = new THREE.Vector3(0, h / 2 + ((top + bottom) / 2 - stageH / 2) / pixelsPerMetre, 0);
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  camera.position.set(target.x + Math.sin(az) * Math.cos(el) * d, target.y + Math.sin(el) * d, target.z + Math.cos(az) * Math.cos(el) * d);
  controls.target.copy(target);
  controls.update();
}

function activate(character) {
  const previous = S.character;
  if (previous) {
    previous.mixer.stopAllAction();
    scene.remove(previous.root);
    if (previous.helper) scene.remove(previous.helper);
  }
  S.character = character;
  S.clip = null;
  scene.add(character.root);
  character.helper = character.helper || new THREE.SkeletonHelper(character.root);
  character.helper.visible = $("#t-bones").getAttribute("aria-pressed") === "true";
  scene.add(character.helper);
  applyWireframe();
  store.set("character", character.entry.id);

  $("#hud-char").textContent = character.entry.name;
  $("#tag-name").textContent = character.entry.name;
  $("#tag").hidden = !character.entry.premium;
  const s = character.stats;
  $("#hud-stats").textContent = `${s.triangles.toLocaleString("en-US")} tris · ${s.bones} bones · ${character.clips.length} clips`;
  if (!previous) setCamera(-35);
  else {
    // The next character is framed to fit from the side the camera is on, so a child and a tall man fill the stage alike
    // and a premium name plate always has room above the head. (After the readout is written: its height sets the room.)
    const v = camera.position.clone().sub(controls.target);
    setCamera((Math.atan2(v.x, v.z) * 180) / Math.PI, (Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180) / Math.PI);
  }
  renderStats(character);
  renderClips(character);
  const remembered = store.get("clip:" + character.entry.id, null);
  const first = character.clips.find((c) => c.name === remembered) || character.clips[0];
  if (first) selectClip(first, { fade: 0 });
  else {
    $("#hud-name").textContent = "";
    $("#hud-rest").textContent = "";
    $("#match").hidden = true;
    $("#match-note").textContent = "";
    note("This file has no animation clips.", "info");
  }
  $("#char").value = character.entry.id;
}

function renderStats(character) {
  const s = character.stats;
  const rows = [
    ["Triangles", s.triangles.toLocaleString("en-US")],
    ["Vertices", s.vertices.toLocaleString("en-US")],
    ["Bones", String(s.bones)],
    ["Materials", String(s.materials)],
    ["Textures", s.textures.join(", ") || "none"],
    ["Height", `${character.height.toFixed(2)} m`],
    ["Feet at y", `${character.feetY.toFixed(3)} m`],
    ["File", `${(character.bytes / 1024).toFixed(0)} KB`],
  ];
  const dl = $("#stats");
  dl.replaceChildren();
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  }
  if (character.entry.note) {
    const dt = document.createElement("dt");
    dt.textContent = "Note";
    const dd = document.createElement("dd");
    dd.style.fontFamily = "var(--font)";
    dd.textContent = character.entry.note;
    dl.append(dt, dd);
  }
}

function renderClips(character) {
  const list = $("#clips");
  list.replaceChildren();
  character.clips.forEach((c, index) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "clip";
    const keyLabel = document.createElement("span");
    keyLabel.className = "key";
    keyLabel.textContent = index < 9 ? String(index + 1) : "";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = c.name;
    const badges = document.createElement("span");
    badges.className = "row tight";
    const loop = document.createElement("span");
    loop.className = "badge " + (c.info.closed ? "ok" : "warn");
    loop.textContent = c.info.closed ? "loops clean" : "open loop";
    loop.title = c.info.closed ? "The last pose equals the first, so the loop has no jump." : "The last pose differs from the first: the loop will pop.";
    badges.append(loop);
    if (c.info.maxDeg > POP_DEG && !character.entry.clips?.[c.name]?.pop) {
      const pop = document.createElement("span");
      pop.className = "badge warn";
      pop.textContent = "pop?";
      pop.title = `${c.info.worst} turns ${c.info.maxDeg.toFixed(0)}° in one frame`;
      badges.append(pop);
    }
    const meta = document.createElement("span");
    meta.className = "meta";
    const parts = [`${c.info.duration.toFixed(2)} s`, `${c.info.frames} f`, `${c.info.tracks} tracks`, `max ${c.info.maxDeg.toFixed(0)}°/f`];
    if (c.ground) parts.push(`ground ≈ ${c.ground.toFixed(2)} m/s`);
    meta.textContent = parts.join(" · ");
    button.append(keyLabel, name, badges, meta);
    button.addEventListener("click", () => selectClip(c));
    li.append(button);
    list.append(li);
    c.button = button;
  });
}

// ---- playing ------------------------------------------------------------------------------------------------------

function selectClip(entry, { fade = S.blend } = {}) {
  const character = S.character;
  const previous = S.clip && S.clip !== entry ? S.clip : null;
  S.clip = entry;
  S.loops = 0;
  const action = entry.action;
  action.enabled = true;
  action.setEffectiveTimeScale(1);
  action.setEffectiveWeight(1);
  action.setLoop(S.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  action.clampWhenFinished = true;
  action.reset();
  if (previous && fade > 0 && previous.action.isRunning()) {
    action.play();
    previous.action.crossFadeTo(action, fade, false);
  } else {
    character.mixer.stopAllAction();
    action.play();
  }
  for (const c of character.clips) c.button?.setAttribute("aria-current", String(c === entry));
  store.set("clip:" + character.entry.id, entry.name);
  const speedHint = entry.ground;
  const match = $("#match");
  match.hidden = !speedHint;
  $("#match-note").textContent = speedHint ? "" : "in place: no ground speed to match";
  if (speedHint) match.textContent = `Match ground to ${speedHint.toFixed(2)} m/s`;
}

function setTime(seconds) {
  if (!S.clip) return;
  const duration = S.clip.info.duration;
  S.clip.action.time = ((seconds % duration) + duration) % duration;
  S.character.mixer.update(0);
}

function step(frames) {
  if (!S.clip) return;
  S.playing = false;
  setTime(S.clip.action.time + frames / FPS);
  syncPlayButton();
}

function syncPlayButton() {
  const button = $("#play");
  button.innerHTML = S.playing
    ? '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>';
  button.setAttribute("aria-label", S.playing ? "Pause" : "Play");
}

function nextClip(delta) {
  const clips = S.character?.clips || [];
  if (!clips.length) return;
  const at = clips.indexOf(S.clip);
  selectClip(clips[(at + delta + clips.length) % clips.length]);
}

function applyWireframe() {
  const on = $("#t-wire").getAttribute("aria-pressed") === "true";
  S.character?.root.traverse((o) => {
    if (o.isMesh) o.material.wireframe = on;
  });
}

function wireMixer(character) {
  character.mixer.addEventListener("loop", (e) => {
    if (S.clip && e.action === S.clip.action && ++S.loops >= Math.max(1, Math.ceil(CYCLE_SECONDS / S.clip.info.duration)) && S.cycle) {
      nextClip(1);
    }
  });
  character.mixer.addEventListener("finished", (e) => {
    if (S.clip && e.action === S.clip.action && S.cycle) nextClip(1);
  });
}

// ---- the frame loop -----------------------------------------------------------------------------------------------

const clock = new THREE.Clock();
const scrub = $("#scrub");
let scrubbing = false;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const character = S.character;
  if (character) {
    const advance = S.playing ? dt * S.speed : 0;
    character.mixer.update(advance);
    if (S.ground > 0) floorTexture.offset.y = (floorTexture.offset.y - S.ground * advance) % 1; // the ground runs back under a character facing +Z
    const a = S.clip;
    if (a) {
      const t = a.action.time;
      const frame = Math.min(a.info.frames, Math.round(t * FPS));
      $("#hud-name").textContent = a.name;
      $("#hud-rest").textContent = `  f ${pad(frame, 3)}/${a.info.frames}  ${t.toFixed(2)} s  ${S.speed}×${S.playing ? "" : "  paused"}`;
      $("#frame-readout").textContent = `f ${pad(frame, 3)}/${a.info.frames}`;
      if (!scrubbing) scrub.value = String(Math.round((t / a.info.duration) * 1000));
    }
  }
  controls.update();
  placeTag();
  renderer.render(scene, camera);
}

// A premium character's name plate floats just over the top of its head, whatever the camera does. The anchor is a fixed
// point above the character, not the head bone, so the plate stays still while the head bobs in a run.
const tagAt = new THREE.Vector3();
function placeTag() {
  const tag = $("#tag");
  const character = S.character;
  if (!character?.entry.premium) return;
  character.root.getWorldPosition(tagAt);
  tagAt.y += character.feetY + character.height * 1.03 + 0.02;
  tagAt.project(camera);
  const visible = tagAt.z < 1;
  tag.style.visibility = visible ? "visible" : "hidden";
  if (visible)
    tag.style.transform = `translate(calc(${((tagAt.x * 0.5 + 0.5) * stage.clientWidth).toFixed(1)}px - 50%), calc(${((-tagAt.y * 0.5 + 0.5) * stage.clientHeight).toFixed(1)}px - 100% - 8px))`;
}

// ---- wiring the controls ------------------------------------------------------------------------------------------

function pressed(button, value) {
  button.setAttribute("aria-pressed", String(value));
}

function wire() {
  $("#play").addEventListener("click", () => {
    S.playing = !S.playing;
    syncPlayButton();
  });
  $("#prev").addEventListener("click", () => step(-1));
  $("#next").addEventListener("click", () => step(1));
  scrub.addEventListener("input", () => {
    scrubbing = true;
    S.playing = false;
    syncPlayButton();
    if (S.clip) setTime((Number(scrub.value) / 1000) * S.clip.info.duration);
  });
  scrub.addEventListener("change", () => (scrubbing = false));

  for (const b of document.querySelectorAll("#speed button")) {
    b.addEventListener("click", () => setSpeed(Number(b.dataset.speed)));
  }
  $("#once").addEventListener("click", (e) => {
    S.once = !S.once;
    pressed(e.currentTarget, S.once);
    if (S.clip) {
      S.clip.action.setLoop(S.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      S.clip.action.clampWhenFinished = true;
    }
  });
  $("#cycle").addEventListener("click", (e) => {
    S.cycle = !S.cycle;
    pressed(e.currentTarget, S.cycle);
    S.loops = 0;
  });
  const blend = $("#blend");
  const showBlend = () => ($("#blend-out").textContent = `${Number(blend.value).toFixed(2)} s`);
  blend.value = String(S.blend);
  blend.addEventListener("input", () => {
    S.blend = Number(blend.value);
    store.set("blend", S.blend);
    showBlend();
  });
  showBlend();

  for (const b of document.querySelectorAll("#cams [data-az]")) b.addEventListener("click", () => setCamera(Number(b.dataset.az)));
  for (const b of document.querySelectorAll("[data-bd]")) {
    b.addEventListener("click", () => {
      S.backdrop = b.dataset.bd;
      store.set("backdrop", S.backdrop);
      paintBackdrop();
    });
  }
  $("#t-shadow").addEventListener("click", (e) => {
    const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
    pressed(e.currentTarget, on);
    shadowCatcher.visible = on;
    key.castShadow = on;
  });
  $("#t-wire").addEventListener("click", (e) => {
    pressed(e.currentTarget, e.currentTarget.getAttribute("aria-pressed") !== "true");
    applyWireframe();
  });
  $("#t-bones").addEventListener("click", (e) => {
    const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
    pressed(e.currentTarget, on);
    if (S.character?.helper) S.character.helper.visible = on;
  });
  $("#t-spin").addEventListener("click", (e) => {
    const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
    pressed(e.currentTarget, on);
    controls.autoRotate = on;
  });
  const ground = $("#ground");
  const showGround = () => ($("#ground-out").textContent = `${S.ground.toFixed(2)} m/s`);
  ground.addEventListener("input", () => {
    S.ground = Number(ground.value);
    showGround();
  });
  $("#match").addEventListener("click", () => {
    if (!S.clip?.ground) return;
    S.ground = Math.round(S.clip.ground * 20) / 20;
    ground.value = String(S.ground);
    showGround();
  });

  $("#char").addEventListener("change", (e) => {
    const entry = S.entries.find((x) => x.id === e.target.value);
    if (entry) openCharacter(entry);
  });
  $("#open").addEventListener("click", () => $("#file").click());
  $("#file").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) openFile(file);
    e.target.value = "";
  });

  // Dropping a .glb anywhere previews it (nothing is uploaded).
  let depth = 0;
  const drop = $("#drop");
  addEventListener("dragenter", (e) => {
    if (![...(e.dataTransfer?.types || [])].includes("Files")) return;
    e.preventDefault();
    depth++;
    drop.hidden = false;
  });
  addEventListener("dragover", (e) => e.preventDefault());
  addEventListener("dragleave", () => {
    if (--depth <= 0) drop.hidden = true;
  });
  addEventListener("drop", (e) => {
    e.preventDefault();
    depth = 0;
    drop.hidden = true;
    const file = [...(e.dataTransfer?.files || [])].find((f) => /\.glb$/i.test(f.name));
    if (file) openFile(file);
    else note("Only .glb files can be previewed.", "info", 4000);
  });

  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches?.("select, input[type=text], input[type=file]")) return;
    if (e.target.matches?.("input[type=range]") && e.target !== scrub) return; // the other sliders keep their arrow keys
    let handled = true;
    if (e.key === " ") {
      if (e.target.matches?.("button")) return; // a focused button keeps its own space key
      S.playing = !S.playing;
      syncPlayButton();
    } else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowUp") nextClip(-1);
    else if (e.key === "ArrowDown") nextClip(1);
    else if (e.key === "[") setSpeed(Math.max(0.25, S.speed / 2));
    else if (e.key === "]") setSpeed(Math.min(2, S.speed * 2));
    else if (/^[1-9]$/.test(e.key)) {
      const c = S.character?.clips[Number(e.key) - 1];
      if (c) selectClip(c);
    } else handled = false;
    if (handled) e.preventDefault();
  });

  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => S.backdrop === "auto" && paintBackdrop());
  new MutationObserver(() => S.backdrop === "auto" && paintBackdrop()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}

function setSpeed(value) {
  S.speed = value;
  store.set("speed", value);
  for (const b of document.querySelectorAll("#speed button")) pressed(b, Number(b.dataset.speed) === value);
}

async function openFile(file) {
  const buffer = await file.arrayBuffer();
  const id = "local:" + file.name;
  let entry = S.entries.find((x) => x.id === id);
  if (entry) S.cache.delete(id);
  else {
    entry = { id, name: file.name.replace(/\.glb$/i, "") + " (local)" };
    S.entries.push(entry);
    addOption(entry);
  }
  entry.buffer = buffer;
  await openCharacter(entry);
}

function addOption(entry) {
  const option = document.createElement("option");
  option.value = entry.id;
  option.textContent = entry.name;
  $("#char").append(option);
}

// ---- start --------------------------------------------------------------------------------------------------------

async function start() {
  resize();
  paintBackdrop();
  wire();
  setSpeed(S.speed);
  syncPlayButton();
  renderer.setAnimationLoop(tick);
  let manifest = [];
  try {
    const response = await fetch("characters.json");
    if (!response.ok) throw new Error(`characters.json: HTTP ${response.status}`);
    manifest = (await response.json()).characters || [];
  } catch (error) {
    note(`Could not read characters.json (${error.message || error}). Drop a .glb on the page instead.`, "error");
  }
  S.entries = manifest;
  manifest.forEach(addOption);
  const wanted = manifest.find((x) => x.id === store.get("character", "")) || manifest[0];
  if (wanted) await openCharacter(wanted);
  else $("#hud-char").textContent = "No characters";
  document.documentElement.dataset.ready = "1";
}

window.__bench = { S, THREE, scene, camera, renderer, controls, selectClip, setTime, floorTexture };
start().catch((error) => {
  console.error(error);
  note(`Viewer failed to start: ${error.message || error}`, "error");
});
