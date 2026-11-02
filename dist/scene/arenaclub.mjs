// The Grand Gala Arena dressed for real (2 November 2026, the creator: "Now do the same for the next venue!!!! same about of deal!"):
// THE POOL PANIC AWARDS, the season's last night, in a grand old domed arena.
//
// Its materials are photographic, painted once on fal and made seamless (tools/venues/arena/arena_textures.py): an ivory terrazzo
// deck with brass strips, the pool in navy and gold glass mosaic with an art deco sunburst band at its waterline, black marble
// coping and starting blocks, French-polished walnut, gold leaf, crimson velvet, navy theatre carpet, midnight damask. The stage's
// wall round the game's screens (gold-leaf frames, a velvet pelmet, the changing rooms' doors in it since 2 November 2026: no locker
// rooms, GENTLEMEN and LADIES), the niche over the screen where the trophy turns on its plinth before a gold sunburst; the deck's
// red carpet along the stage; the grandstands in navy with crimson and gold velvet seats where the crowd sits in its evening
// clothes; the far walls' opera boxes and arched windows on the night. And the gala's nonsense at the edges: the CHAMPAGNE BAR (it's
// sparkling pool water), an ice swan melting into a bucket (PLEASE DO NOT LICK), the VIP lounge's velvet chaises, the confetti
// cannons, the flamingo's memorial (2019 – 2026, SHE FLOATED), the winner's lectern, the press pen of rubber ducks with their
// flashes and the POOL PANIC TV jib, the orchestra pit (THE CANNONBALL OVERTURE, a duck in the tuba, a seal as the guest artist),
// the royal box with its one empty throne (Reserved · M.), the coaches' tunnel; and the pictures with our characters in them (GPT
// Image 2.5, the coaches as the references): THE GRAND GALA poster, COACH OF THE YEAR · THE NOMINEES, the red carpet's photograph.
// For the Coach Cam: the coffered vault, its gilded trusses, two crystal chandeliers, the banners, the near side's wall and stand.
//
// What moves stays the game's (scene/arena.mjs): the LED screens and the chasing marquee, the drapes, the trophy turning, the crowd
// (the Meshy spectators in their evening clothes, scene/crowd-models.mjs) and the ribbons scrolling along the stands, the hanging
// scoreboard, the spotlights' rigs, beams and pools of light, the balloons. It loads behind the menu after the Jumping Pool
// (`loadArenaClub`, app.mjs); until it has, and with ?nomodels, the arena is the classic one.
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
  medkitCabinet,
  trampolineTower,
} from "./props.mjs";
import { kioskTreats } from "./resort.mjs";
import { dressedVenue, dressModel, ringsFromModel } from "./dressed.mjs";
import { stage, stands, scoreboard, spotlights, balloons, crowdLife } from "./arena.mjs";
import { rngOf } from "./geom.mjs";

// The trophy's plinth's top, in the niche over the screen (tools/venues/arena/kit.py TROPHY).
export const TROPHY_AT = { y: 5.9, z: -17.0 };

// Its light (over LIGHTING.gala, scene.mjs `withDome`): the classic's warm spotlit evening; the model's lamps lit all night (the
// marquee bulbs round the platform, the chandeliers, the sconces in the boxes, the spots on the trophy), their light warm gold.
export const ARENA_LOOKS = {
  gala: {
    lamps: 1,
    lampColor: 0xffd59a,
    clouds: 0,
  },
};

const ARENA_CLUB = dressedVenue({ dir: "arena-club", file: "arena", label: "The Grand Gala Arena" });
export const arenaClubReady = ARENA_CLUB.ready;
export const arenaClubModel = ARENA_CLUB.model;
export const primeArenaClub = ARENA_CLUB.prime;
export const arenaClubPictures = ARENA_CLUB.pictures;
// Fetch the model and its pictures once (a few MB); resolves to null when they cannot be had (the classic arena stays).
export const loadArenaClub = (base) => ARENA_CLUB.load(base);

// The Grand Gala Arena, the model and what the game moves round it. `w` is the PoolWorld being built.
export function buildArenaClub(w, venue) {
  const A = arenaClubModel(),
    info = A.info,
    look = w.look;
  // the water, the lane ropes and the pennants (the game's); the basin, the blocks, the ladders and the posts are the model's
  buildPool(w, venue, look.water, {
    basin: false,
    blocks: false,
    ladderAt: [],
    posts: false,
    line: 0x0c1430,
    ropes: [0xf2d58a, 0x9c2a3a, 0x22305a],
    pennants: [0xd4a53c, 0x9c2a3a, 0xfff1d6],
  });
  // (the caustics stay in the pool's box: the hall's floor and the stands lie below the water's level too)
  const P = venue.pool,
    box = [-P.halfX - 0.05, P.halfX + 0.05, -P.halfZ - 0.05, P.halfZ + 0.05];
  const root = dressModel(w, A, { look, name: "arenaclub", deckSet: "terrazzo", caustics: box });
  liveParts(w, venue, root, info);
  // what the Coach Cam alone sees (the near stand's crowd, the scoreboard, the rigs, the balloons) lives in a group of its own
  const near = new THREE.Group();
  near.name = "arena-near";
  w.scene.add(near);
  w.liveProps.push(near);
  const hall = { coach: false, live: near, animators: [], ctx: { g: near } };
  const ctx = { w, venue, hall, upper: near, rand: rngOf(97), crowds: [], ribbons: [] };
  // (the drapes hang in the overview too: the stage's wall is the model's, seen from every camera)
  stage(
    { ...ctx, hall: { ...hall, live: w.scene } },
    { wall: false, trophyY: TROPHY_AT.y, trophyZ: TROPHY_AT.z },
  );
  stands(ctx, { tiers: false, models: true });
  scoreboard(ctx);
  spotlights(ctx);
  balloons(ctx);
  crowdLife(ctx);
  w.hall = coachView(root, hall);
}

// What the game moves or asks for: the stations' hit boxes and labels, the rings, the fins, the doors, the treats on the champagne
// bar, the first-aid cabinet, the trampoline's bed.
function liveParts(w, venue, root, info) {
  const S = venue.stations,
    F = venue.fixtures;
  const fins = [1, 2, 3].map((i) => root.getObjectByName("Fins_" + i)).filter(Boolean);
  // (the model's rack and pairs; a model without them has the classic rack)
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
  medkitCabinet(w, F.medkit, { cabinet: false });
  kioskTreats(w, F.treats);
  if (venue.trampoline) trampolineTower(w, venue.trampoline, { structure: false });
  for (const [name, side] of [
    ["Door_A", -1],
    ["Door_B", 1],
  ]) {
    const hinge = root.getObjectByName(name);
    if (hinge) w.lockerDoors.push({ side, hinge });
  }
}

// The Coach Cam sees the hall from inside: the vault, its trusses, the chandeliers and banners, the near side's wall and stand (the
// model's C_ meshes: tools/venues/arena/kit.py COACH_PARTS), and the game's near stand, scoreboard, rigs and balloons, which move
// only while it looks. None of it casts a shadow.
function coachView(root, hall) {
  const coach = [];
  root.traverse((o) => {
    // (the packed model keeps the class's name on the node over each mesh)
    if (o.isMesh && (/^C_/.test(o.name) || /^C_/.test(o.parent?.name || ""))) {
      o.castShadow = false;
      coach.push(o);
    }
  });
  coach.push(hall.live);
  const set = (on) => {
    hall.coach = on;
    for (const m of coach) m.visible = on;
  };
  set(false);
  return {
    setCoach: set,
    update(time, dt, world, sim) {
      if (!hall.coach) return;
      for (const f of hall.animators) f(time, dt, world, sim);
    },
  };
}
