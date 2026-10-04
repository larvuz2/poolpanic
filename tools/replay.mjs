#!/usr/bin/env node
// Plays a recorded shift again, headless (dist/replay.mjs records them, in a playtest: the crash log's report has the last one under
// "## Replay"). It makes the same simulation (level, seed, booking, drill), gives it the same inputs on the same ticks, checks the
// state hash at every checkpoint, and can print the shift's diary (the same lines the crash log would have written, every step of every
// incident) so a stuck incident can be read, or stopped at a time and looked into.
//
//   node tools/replay.mjs <report.md | record.json>             replay it all and say whether it kept in step
//   node tools/replay.mjs <file> --diary                        and print the diary (add --pulse for the positions every 5 s)
//   node tools/replay.mjs <file> --until 74                     stop at that second of the shift (--until-tick N for a tick)
//   node tools/replay.mjs <file> --level                        the report may hold several recorded shifts: pick the Nth with --nth N (default last)
//
// As a module: `replay(record, {until, onTick})` returns {sim, ticks, drift, hash} for a test or a script that wants to look at the
// simulation at the end (or at every tick, through onTick).
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PoolSimulation, SHIFTS } from "../dist/sim.mjs";
import { DRILLS } from "../dist/drills.mjs";
import { Tracer, describeEvent, isNoisy } from "../dist/trace.mjs";
import { stateHash } from "../dist/replay.mjs";

// The simulation as the game's start() makes it.
export function makeSim(record) {
  const man = record.man && { cannonball: record.man };
  if (record.drill) {
    const drill = DRILLS[record.drill];
    if (!drill) throw new Error("this record is of a drill that is not in this build: " + record.drill);
    return new PoolSimulation(drill.tier, record.seed, {
      config: { ...drill.config, ...man },
      drill: drill.id,
    });
  }
  return new PoolSimulation(record.level, record.seed, {
    booking: record.booking || null,
    ...(man && { config: { ...SHIFTS[record.level - 1], ...man } }),
  });
}

// One recorded input applied to a simulation.
export function apply(sim, entry, record) {
  const [, name, ...args] = entry;
  if (name === "m") return sim.setMovement(...record.vecs[args[0]]);
  if (name === "look") {
    sim.coach.lookAngle = args[0];
    return;
  }
  if (typeof sim[name] !== "function") throw new Error("this build's simulation has no input " + name);
  return sim[name](...args);
}

// Play `record` through. `until` is a tick count to stop at. `onTick(sim, tick)` is called after every tick (the events of the tick are
// still in sim.events: drain them there, or they are dropped after the call). Returns {sim, ticks, drift, hash}: `drift` is null when
// every checkpoint matched, else the tick of the first one that did not, with what was expected and found.
export function replay(record, { until = Infinity, onTick = null } = {}) {
  const sim = makeSim(record);
  sim.start({ countdown: true });
  const checks = new Map(record.checks || []);
  let next = 0,
    drift = null,
    tick = 0;
  const end = Math.min(until, record.ticks);
  for (; tick < end; tick++) {
    while (next < record.inputs.length && record.inputs[next][0] <= tick)
      apply(sim, record.inputs[next++], record);
    sim.tick(1 / 60);
    onTick?.(sim, tick + 1);
    sim.events.length = 0;
    const want = checks.get(tick + 1);
    if (want !== undefined && !drift) {
      const got = stateHash(sim);
      if (got !== want) drift = { tick: tick + 1, want, got };
    }
  }
  return { sim, ticks: tick, drift, hash: stateHash(sim) };
}

// The records in a report (or one on its own): the ```json blocks under "## Replay", or a bare JSON record or list of them.
export function readRecords(text) {
  const records = [];
  for (const block of text.matchAll(/## Replay[^\n]*\n+```json\n([^\n]*)\n```/g))
    records.push(JSON.parse(block[1]));
  if (records.length) return records;
  const whole = JSON.parse(text);
  return Array.isArray(whole) ? whole : whole.replays ? whole.replays : [whole];
}

async function main(argv) {
  const args = argv.slice(2);
  const flag = (name) => args.includes("--" + name);
  const value = (name) => {
    const i = args.indexOf("--" + name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const file = args.find(
    (a, i) => !a.startsWith("--") && !["--until", "--until-tick", "--nth"].includes(args[i - 1]),
  );
  if (!file) {
    console.error(
      "usage: node tools/replay.mjs <report.md | record.json> [--diary] [--pulse] [--until SECONDS] [--nth N]",
    );
    process.exit(2);
  }
  const records = readRecords(readFileSync(file, "utf8"));
  const nth = value("nth") !== undefined ? Number(value("nth")) : records.length - 1;
  const record = records[nth];
  if (!record) throw new Error("no recorded shift number " + nth + " (there are " + records.length + ")");
  const until =
    value("until-tick") !== undefined
      ? Number(value("until-tick"))
      : value("until") !== undefined
        ? Number(value("until")) * 60
        : Infinity;
  console.log(
    `Replaying ${record.drill ? "drill " + record.drill : "level " + record.level} · seed ${record.seed}${record.booking ? " · booking " + record.booking : ""}${record.man ? " · " + record.man : ""} · ${record.ticks} ticks (${(record.ticks / 60).toFixed(1)} s), ${record.inputs.length} inputs${record.truncated ? " (the record is cut short)" : ""}`,
  );
  const tracer = new Tracer((kind, text) => flag("diary") && console.log(kind.padEnd(9) + " " + text), {
    verbose: true,
  });
  let pulse = 0;
  const result = replay(record, {
    until,
    onTick(sim, tick) {
      tracer.look(sim);
      if (tick === 1 && flag("diary")) console.log("plan      " + tracer.plan(sim));
      if (flag("diary"))
        for (const e of sim.events)
          if (!isNoisy(e)) console.log("event     " + "t" + Math.floor(sim.time) + "s " + describeEvent(e));
      if (flag("pulse") && tick - pulse >= 300) {
        pulse = tick;
        console.log("pulse     " + tracer.pulse(sim));
      }
    },
  });
  const sim = result.sim;
  console.log(
    `Ended at tick ${result.ticks} (shift time ${sim.time.toFixed(1)} s), status ${sim.status}, score ${Math.round(sim.score)}.`,
  );
  console.log(
    result.drift
      ? `DRIFTED at tick ${result.drift.tick}: the recording says ${result.drift.want}, this replay has ${result.drift.got}. Before that the replay kept in step.`
      : `Every checkpoint matched (${(record.checks || []).filter(([t]) => t <= result.ticks).length}).`,
  );
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main(process.argv).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
