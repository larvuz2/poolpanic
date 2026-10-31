// The Aqua Disco dressed for real (31 October 2026, the creator: "Now same treatment for next venue!! You got this AAA indie …lots of
// good quality blender made assets that add lots to the scene !!"): an art-deco nightclub round the pool. A black glass dance floor
// wall to wall, the deep-blue pool with a mirror starburst in its floor; buttoned velvet walls between mirror-mosaic columns under a
// gold cornice and its neon cove, posters of the club's nights; the grand entrance in the back wall (padded doors, a stepped gold
// surround, marquee bulbs round the game's neon sign, a chrome bezel round its equaliser); the stage's mirror arch, velvet drapes and
// the AQUA DISCO crest, truss towers and their lights; speaker stacks, the DJ's riser and booth, the juice bar and its back bar, velvet
// banquettes, palms in urns, the aqua-fit kit; for the Coach Cam, the ceiling's coffered vault with its neon rings and the lighting
// truss, the near wall over the overview's camera.
//
// Every asset is made by tools/venues/disco/ with the shared venue kit (tools/venues/common/); scene/dressed.mjs puts the model in.
// Everything that moves to the beat stays the game's (scene/disco.mjs): the moving-head spots, the lasers, the LED rim, the mirror
// ball's sparkles, the neon sign and the equaliser, the stage's ring, disc and bulbs, Valentina, the speakers' cones; and the DJ and
// the bartender are the Rooftop Pool's dancing models (roof-view.mjs `buildCast`). It loads behind the menu after the Sunset Lagoon
// (`loadDiscoClub`, app.mjs); until it has, and with ?nomodels, the Aqua Disco is the classic one (scene/disco.mjs).
import { THREE } from "./kit.mjs";
import { buildPool } from "./pool.mjs";
import {
  finRack,
  station,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
} from "./props.mjs";
import { kioskTreats } from "./resort.mjs";
import { dressedVenue, dressModel, ringsFromModel } from "./dressed.mjs";
import {
  onTheBeat,
  backWall,
  stage,
  speaker,
  ledRim,
  spotlights,
  sparkles,
  lasers,
  glowMaterial,
} from "./disco.mjs";
import { buildCast, syncCast } from "./roof-view.mjs";
import { rngOf } from "./geom.mjs";

// Its light (over LIGHTING.disco, scene.mjs `withDome`): the game's dark violet room with the water glowing; every lamp in the model lit
// all the time (the neon, the sconces, the marquee, the bottles), their light on the floor and the walls pink.
export const DISCO_LOOKS = {
  disco: {
    lamps: 1,
    clouds: 0,
    lampColor: 0xff6ad5,
  },
};

const DISCO = dressedVenue({ dir: "disco", file: "disco", label: "The Aqua Disco" });
export const discoClubReady = DISCO.ready;
export const discoClubModel = DISCO.model;
export const primeDiscoClub = DISCO.prime;
export const discoClubPictures = DISCO.pictures;
// Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic disco stays).
export const loadDiscoClub = (base) => DISCO.load(base);

// Where the DJ and the bartender stand (behind the booth on its riser, behind the bar), both facing the pool (+x).
const DJ = { x: -12.85, z: -9.4, y: 0.25 };
const BAR = { x: -13.35, z: 10.6 };
const BOOTH = { front: -11.14, top: 1.3, panelY: 0.85, records: [-0.6, 0.6], recordX: -11.68 };

// The Aqua Disco, the model and what the game moves round it. `w` is the PoolWorld being built.
export function buildDiscoClub(w, venue) {
  const D = discoClubModel(),
    info = D.info,
    look = w.look;
  // the water and the zones' pick volumes; the basin and the ladders are the model's (no lines, ropes, pennants or blocks)
  buildPool(w, venue, w.look.water, {
    basin: false,
    blocks: false,
    ladderAt: [],
    posts: false,
    line: null,
    ropes: null,
    pennants: null,
  });
  const root = dressModel(w, D, { look, name: "discoclub", deckSet: "glassfloor" });
  liveParts(w, venue, root, info);
  // what moves to the beat: the game's own, round the model
  const ctx = { w, venue, rand: rngOf(71), beats: [] };
  backWall(ctx, { wall: false });
  for (const f of venue.furniture) {
    if (f.kind === "speaker") speaker(ctx, f.x, f.z, { body: false });
    if (f.kind === "stage") stage(ctx, f.x, f.z, { body: false });
  }
  djDecks(ctx);
  ledRim(ctx);
  spotlights(ctx);
  sparkles(ctx);
  lasers(ctx);
  onTheBeat(ctx);
  // the DJ and the bartender: the Rooftop Pool's models, dancing at the decks and shaking at the bar
  const cast = { djSpot: DJ, djY: DJ.y, djAngle: Math.PI / 2, barSpot: BAR, barAngle: Math.PI / 2 };
  buildCast(w, cast);
  w.updaters.push((time, dt, world, sim) => syncCast(w, sim, time, dt, cast));
  w.hall = coachView(w, root);
}

// The DJ's decks: the booth's panel glowing to the beat and the two records spinning on the model's turntables.
function djDecks(ctx) {
  const { w } = ctx;
  const panel = glowMaterial(0xff3fb4);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), panel);
  front.position.set(BOOTH.front + 0.012, BOOTH.panelY, DJ.z);
  front.rotation.y = Math.PI / 2;
  w.scene.add(front);
  w.liveProps.push(front);
  const records = BOOTH.records.map((dz) => {
    const rec = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.012, 24),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.3 }),
    );
    rec.position.set(BOOTH.recordX, BOOTH.top + 0.095, DJ.z + dz);
    const label = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), glowMaterial(0xff3fb4));
    label.rotation.x = -Math.PI / 2;
    label.position.y = 0.007;
    rec.add(label);
    w.scene.add(rec);
    w.liveProps.push(rec);
    return rec;
  });
  ctx.beats.push((t, d, p, lit, dt) => {
    for (const r of records) r.rotation.y += dt * 3.5;
    panel.color.setHSL((0.85 + d.beat * 0.05) % 1, 1, 0.5).multiplyScalar(lit * (0.6 + 0.4 * p));
  });
}

// What the game moves or asks for: the stations' hit boxes and labels, the rings, the fins, the doors, the treats on the bar.
function liveParts(w, venue, root, info) {
  const S = venue.stations,
    F = venue.fixtures;
  const fins = [1, 2, 3].map((i) => root.getObjectByName("Fins_" + i)).filter(Boolean);
  finRack(w, S.fins, { rack: fins.length !== 3 });
  if (fins.length === 3) w.finPairs = fins;
  station(w, "chlorine", S.chlorine, 0, "", -Math.PI / 2, { body: false });
  station(w, "relief", S.relief, 0, "", -Math.PI / 2, { body: false });
  rescueStations(w, venue, { mounts: false });
  w.ringAt = ringsFromModel(venue, info);
  sanitationCorner(w, venue, { board: false, bin: false });
  fishNetHook(w, F.fishNet, { board: false });
  const torch = info.anchors?.Flashlight?.[0];
  flashlightHolder(w, F.flashlight, { post: false, at: torch && { x: torch[0], y: torch[1], z: torch[2] } });
  fuseBox(w, F.fuseBox);
  kioskTreats(w, F.treats);
  for (const [name, side] of [
    ["Door_A", -1],
    ["Door_B", 1],
  ]) {
    const hinge = root.getObjectByName(name);
    if (hinge) w.lockerDoors.push({ side, hinge });
  }
}

// The Coach Cam sees the room from inside: the ceiling's vault and truss, the near wall the overview's camera looks over (the model's
// C_ meshes: tools/venues/disco/kit.py COACH_PARTS), and the mirror ball turning under the vault. None of it casts a shadow (the
// game's light comes from above, through where the ceiling would be).
function coachView(w, root) {
  const coach = [];
  root.traverse((o) => {
    // (the packed model keeps the class's name on the node over each mesh)
    if (o.isMesh && (/^C_/.test(o.name) || /^C_/.test(o.parent?.name || ""))) {
      o.castShadow = false;
      coach.push(o);
    }
  });
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 2),
    new THREE.MeshStandardMaterial({ color: 0xe8e8ff, metalness: 1, roughness: 0.12, flatShading: true }),
  );
  ball.position.set(0, 7.6, 0);
  w.scene.add(ball);
  w.liveProps.push(ball);
  coach.push(ball);
  const set = (on) => {
    for (const m of coach) m.visible = on;
  };
  set(false);
  return {
    setCoach: set,
    update(time) {
      ball.rotation.y = time * 0.6;
    },
  };
}
