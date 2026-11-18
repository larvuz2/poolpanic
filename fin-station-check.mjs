// The fin station (18 November 2026, the creator: "the fins should always be on top of the station, like we have it on some other
// levels… we always can see the fins from a top-down view… the fin station should be in the lower-left corner, really close to the
// lower-left corner of the pool"): one station, the Community Pool's own table with a pair of fins lying in each bay
// (dist/assets/models/fin-station.glb, made by tools/venues/common/fin_station.py; scene/fin-station.mjs), in every pool that hands
// out fins, by its pool's lower-left corner as the camera sees it (spatial.mjs FIN_CORNER), and nothing in its way.
import assert from "node:assert/strict";
import { statSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { PoolWorld } from "./dist/scene.mjs";
import { VENUES, FIN_CORNER, finCorner } from "./dist/spatial.mjs";
import {
  FIN_STATION_FILE,
  FIN_STATION_ANGLE,
  FIN_STATION_SIZE,
  finStationReady,
  useFinStationTemplate,
} from "./dist/scene/fin-station.mjs";
import { parseFinStation, assertFinStation } from "./fin-station-kit.mjs";
import { BAKED_FIN_RACKS } from "./dist/scene/dressed.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const quiet = console.warn;
console.warn = () => {};
const container = { clientWidth: 1440, clientHeight: 900 };

// The pools that hand out fins; the others and what stands in the fins' place there.
const FIN_POOLS = ["club", "resort", "lagoon", "arena", "aquatic", "disco", "kids", "senior", "cruise"];
const OTHERS = {
  river: "tube-rack", // (tubes, by the river's lower-left bend)
  wave: "tube-hut", // (tubes, in the beach's corner)
  onsen: "towel-rack", // (nobody needs fins)
  dive: "towel-rack",
  roof: null, // (nobody swims)
};
assert.deepEqual(
  Object.keys(VENUES).sort(),
  [...FIN_POOLS, ...Object.keys(OTHERS)].sort(),
  "every pool is one or the other",
);

// ---- the model: small, a few draws, the pairs its own nodes ----------------------------------------------------------------------
const bytes = statSync("dist/assets/" + FIN_STATION_FILE).size;
assert.ok(bytes < 400e3, `the station's file is ${Math.round(bytes / 1e3)} kB (budget 400)`);
const model = await parseFinStation();
let triangles = 0,
  draws = 0;
const classes = new Set();
model.traverse((o) => {
  if (!o.isMesh) return;
  draws++;
  triangles += o.geometry.index.count / 3;
  classes.add(o.material.name.replace(/^H_/, ""));
  assert.ok(o.geometry.attributes.color, o.name + ": its colours and its occlusion in the vertices");
});
assert.ok(triangles < 8000, `${triangles} triangles (budget 8000)`);
assert.ok(draws <= 8, `${draws} meshes`);
for (const c of classes) assert.ok(["matte", "satin", "gloss", "metal"].includes(c), "a dressed class: " + c);
const pairs = [1, 2, 3].map((i) => model.getObjectByName("Fins_" + i));
assert.ok(pairs.every(Boolean), "the three pairs, Fins_1..3, the game's own nodes");

// The shape, turned as the game turns it: its footprint the plan's, its top at a table's height, the fins lying on top.
const turned = new THREE.Group();
turned.add(model);
turned.rotation.y = FIN_STATION_ANGLE;
turned.updateMatrixWorld(true);
const all = new THREE.Box3().setFromObject(turned);
assert.ok(
  Math.abs((all.max.x - all.min.x) / 2 - FIN_STATION_SIZE.hx) < 0.08,
  `half its depth ${((all.max.x - all.min.x) / 2).toFixed(2)} m`,
);
assert.ok(
  Math.abs((all.max.z - all.min.z) / 2 - FIN_STATION_SIZE.hz) < 0.08,
  `half its length ${((all.max.z - all.min.z) / 2).toFixed(2)} m, along the lanes' ends`,
);
assert.ok(all.max.y < 1.2, "a low table: nothing tall to hide the fins");
const ray = new THREE.Raycaster(),
  down = new THREE.Vector3(0, -1, 0);
for (const p of pairs) {
  const b = new THREE.Box3().setFromObject(p);
  assert.ok(b.min.y > 0.68, p.name + " lies on the table's top");
  assert.ok(b.max.y - b.min.y < 0.2, p.name + " lies flat");
  // (seen from straight above, the pair is the first thing over most of its box: nothing of the station over it; the rest is the
  // table between its two fins and round their blades)
  let seen = 0,
    tried = 0;
  for (let u = 0.15; u < 1; u += 0.1)
    for (let v = 0.15; v < 1; v += 0.1) {
      ray.set(
        new THREE.Vector3(b.min.x + (b.max.x - b.min.x) * u, 5, b.min.z + (b.max.z - b.min.z) * v),
        down,
      );
      const hit = ray.intersectObject(turned, true)[0];
      tried++;
      if (hit && p.getObjectById(hit.object.id)) seen++;
    }
  assert.ok(seen / tried > 0.6, `${p.name} is seen from above (${seen} of ${tried} points)`);
}

// ---- the plan: every pool's station by its pool's lower-left corner, as far out as the Community Pool's ------------------------
assert.deepEqual(
  VENUES.club.stations.fins,
  { x: -8.2, z: -11.0 },
  "the Community Pool's where it stood (the reference)",
);
assert.deepEqual(finCorner(VENUES.club.pool), VENUES.club.stations.fins);
for (const id of FIN_POOLS) {
  const v = VENUES[id],
    f = v.stations.fins;
  assert.deepEqual(f, finCorner(v.pool), id + ": by the pool's -x, -z corner (the lower left on screen)");
  assert.ok(f.x < -v.pool.solidX && f.z < -v.pool.solidZ, id + ": outside the pool, past its corner");
  const rack = v.furniture.filter((o) => o.kind === "rack");
  assert.equal(rack.length, 1, id + ": one rack in the plan");
  assert.deepEqual(
    { x: rack[0].x, z: rack[0].z, hx: rack[0].hx, hz: rack[0].hz },
    { x: f.x, z: f.z, ...FIN_STATION_SIZE },
    id + ": the rack's box is the station's",
  );
  // nothing else in its box, no queue spot by it, and the coach can walk up to it on two sides
  for (const o of v.furniture.filter((o) => o.hx && o.kind !== "rack"))
    assert.ok(
      Math.abs(o.x - f.x) >= o.hx + FIN_STATION_SIZE.hx + 0.3 ||
        Math.abs(o.z - f.z) >= o.hz + FIN_STATION_SIZE.hz + 0.3,
      `${id}: room between the station and the ${o.kind}`,
    );
  for (const s of v.queueSpots || [])
    assert.ok(
      Math.abs(s.x - f.x) > FIN_STATION_SIZE.hx + 0.6 || Math.abs(s.z - f.z) > FIN_STATION_SIZE.hz + 0.6,
      id + ": no queue spot by the station",
    );
  const reach = [
    [f.x + FIN_STATION_SIZE.hx + 0.6, f.z],
    [f.x, f.z + FIN_STATION_SIZE.hz + 0.6],
  ].filter(([x, z]) => v.isDeck(x, z));
  assert.ok(reach.length >= 1, id + ": the coach can walk up to it");
}
for (const [id, kind] of Object.entries(OTHERS)) {
  const v = VENUES[id];
  if (!kind) {
    assert.ok(!v.stations.fins, id + ": no fin station");
    continue;
  }
  assert.ok(
    v.furniture.some((o) => o.kind === kind && o.x === v.stations.fins.x && o.z === v.stations.fins.z),
    `${id}: its ${kind} in the fins' place`,
  );
}
assert.ok(
  ["river", "wave"].every((id) => VENUES[id].stations.fins.x < 0 && VENUES[id].stations.fins.z < 0),
  "the tubes by the lower-left corner too",
);

// ---- the dressed decks: the old rack's contact shadow gone, the station's laid where it stands (tools/venues/common/fin_shadow.py)
const DRESSED = {
  resort: "splash/splash",
  lagoon: "lagoon/lagoon",
  arena: "arena-club/arena",
  aquatic: "aquatic/aquatic",
  disco: "disco/disco",
  kids: "kids/kids",
  senior: "senior-club/senior",
  cruise: "cruise-club/cruise",
};
assert.deepEqual(
  Object.keys(DRESSED).sort(),
  Object.keys(BAKED_FIN_RACKS).sort(),
  "every dressed venue with a rack of its own",
);
for (const [id, file] of Object.entries(DRESSED)) {
  const done = JSON.parse(readFileSync("dist/assets/" + file + ".json", "utf8")).finStation;
  assert.ok(done, id + ": its deck's shadows redone for the station");
  assert.deepEqual(
    done.cut,
    BAKED_FIN_RACKS[id],
    id + ": the old rack's shadow cleared where the model had it",
  );
  assert.deepEqual(done.at, VENUES[id].stations.fins, id + ": the station's shadow where the station stands");
}

// ---- built: the classic table until the model is in, then the model --------------------------------------------------------
assert.equal(finStationReady(), null);
const classic = new PoolWorld(container, () => {}, { headless: true, venue: VENUES.resort });
assert.equal(
  classic.scene.getObjectByName("FinStation"),
  undefined,
  "the classic table until the model is in",
);
assert.equal(classic.finPairs.length, 3);
for (const p of classic.finPairs) {
  p.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(p);
  assert.ok(b.min.y > 0.7 && b.max.y - b.min.y < 0.2, "the classic pairs lie on its top too");
}
useFinStationTemplate(model);
let shown = 0;
for (const id of FIN_POOLS) {
  const w = new PoolWorld(container, () => {}, { headless: true, venue: VENUES[id] });
  assertFinStation(w, VENUES[id]);
  const hit = w.clickables.filter((c) => c.userData?.kind === "station" && c.userData.item === "fins");
  assert.equal(hit.length, 1, id + ": one place to take fins");
  assert.ok(
    Math.hypot(
      hit[0].position.x - VENUES[id].stations.fins.x,
      hit[0].position.z - VENUES[id].stations.fins.z,
    ) < 0.01,
  );
  assert.ok(w.labels.some((l) => l.text === "E · FIN RACK" && l.x === VENUES[id].stations.fins.x));
  shown++;
}
console.warn = quiet;
console.log(
  `Fin station checks passed: one station (${Math.round(bytes / 1e3)} kB, ${triangles} triangles, ${draws} meshes), the fins lying on its top and seen from above; in all ${shown} pools that hand out fins, by the pool's lower-left corner (${-FIN_CORNER.x} m nearer the camera and ${-FIN_CORNER.z} m to the left of it, as the Community Pool's), nothing in its way and the coach able to walk up to it; the tubes by that corner too at the river and the wave pool; the classic table, the fins on top, until the model is in.`,
);
