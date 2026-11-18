// For the checks (not a check itself): the shared fin station (scene/fin-station.mjs, 18 November 2026) parsed from its file and
// put where a headless world finds it, and what every pool's station must be once a venue is built with it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { useFinStationTemplate, FIN_STATION_FILE } from "./dist/scene/fin-station.mjs";
import { BAKED_FIN_RACKS } from "./dist/scene/dressed.mjs";
import { finCorner } from "./dist/spatial.mjs";
import * as THREE from "./dist/assets/three.module.js";

export async function parseFinStation() {
  const data = readFileSync("dist/assets/" + FIN_STATION_FILE);
  const gltf = await new Promise((resolve, reject) =>
    new GLTFLoader().parse(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      "",
      resolve,
      reject,
    ),
  );
  return gltf.scene;
}
export async function primeFinStation() {
  const scene = await parseFinStation();
  useFinStationTemplate(scene);
  return scene;
}

// The world's fin station: the shared one at the plan's place by the pool's lower-left corner, its three pairs the world's
// `finPairs`; and, in a dressed venue (`root` its model), the model's own rack gone: no Fins_1..3, no triangle left standing in
// the box it was baked in.
export function assertFinStation(world, venue, root = null) {
  const station = world.scene.getObjectByName("FinStation");
  assert.ok(station, venue.id + ": the shared fin station");
  assert.deepEqual(
    { x: station.position.x, z: station.position.z },
    { x: venue.stations.fins.x, z: venue.stations.fins.z },
    venue.id + ": at the plan's place",
  );
  assert.deepEqual(
    venue.stations.fins,
    finCorner(venue.pool),
    venue.id + ": by the pool's lower-left corner on screen",
  );
  assert.equal(world.finPairs.length, 3, venue.id + ": its three pairs of fins");
  assert.ok(
    world.finPairs.every((f) => station.getObjectById(f.id)),
    venue.id + ": the pairs are the station's",
  );
  if (!root) return;
  for (const n of ["Fins_1", "Fins_2", "Fins_3"])
    assert.equal(root.getObjectByName(n), undefined, venue.id + ": the model's own " + n + " is gone");
  const box = BAKED_FIN_RACKS[venue.id];
  assert.ok(box, venue.id + ": where its model had its own rack");
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert(),
    m = new THREE.Matrix4(),
    v = new THREE.Vector3();
  let standing = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry.index) return;
    m.multiplyMatrices(toRoot, o.matrixWorld);
    const pos = o.geometry.attributes.position,
      idx = o.geometry.index.array;
    const at = (i) => v.fromBufferAttribute(pos, i).applyMatrix4(m).clone();
    for (let t = 0; t + 2 < idx.length; t += 3) {
      if (idx[t] === idx[t + 1] && idx[t] === idx[t + 2]) continue;
      const p = [at(idx[t]), at(idx[t + 1]), at(idx[t + 2])];
      if (
        p.every((q) => Math.abs(q.x - box.x) < box.hx && Math.abs(q.z - box.z) < box.hz) &&
        Math.max(...p.map((q) => q.y)) > 0.004
      )
        standing++;
    }
  });
  assert.equal(standing, 0, venue.id + ": nothing of its old rack stands where it was baked");
}
