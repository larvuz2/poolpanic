// The sound's little chains of nodes (dist/audio.mjs): the music and every effect make about 70 of them a second, and each is let go of when its
// source ends (Safari holds on to a finished chain that is still connected). The noise comes from one buffer made once, from a random place in
// it, fading out through the gain. Driven with a fake audio context that remembers every node.
import assert from "node:assert/strict";
import { PoolAudio } from "./dist/audio.mjs";

function fakeContext() {
  const nodes = [],
    buffers = [];
  const param = () => ({
    value: 0,
    calls: [],
    setValueAtTime(v, t) {
      this.calls.push(["set", v, t]);
    },
    linearRampToValueAtTime(v, t) {
      this.calls.push(["linear", v, t]);
    },
    exponentialRampToValueAtTime(v, t) {
      this.calls.push(["exp", v, t]);
    },
  });
  const make = (kind, extra = {}) => {
    const n = {
      kind,
      outputs: [],
      disconnects: 0,
      connect(to) {
        n.outputs.push(to);
        return to;
      },
      disconnect() {
        n.disconnects++;
      },
      start(...args) {
        n.started = args;
      },
      stop(...args) {
        n.stopped = args;
      },
      ...extra,
    };
    nodes.push(n);
    return n;
  };
  return {
    nodes,
    buffers,
    currentTime: 1,
    sampleRate: 44100,
    createOscillator: () => make("oscillator", { frequency: param(), type: "sine" }),
    createGain: () => make("gain", { gain: param() }),
    createBufferSource: () => make("source", { buffer: null }),
    createBiquadFilter: () => make("filter", { type: "", frequency: param(), Q: param() }),
    createBuffer(channels, length, rate) {
      const b = {
        channels,
        length,
        rate,
        duration: length / rate,
        getChannelData: () => new Float32Array(length),
      };
      buffers.push(b);
      return b;
    },
  };
}
const audio = () => {
  const a = new PoolAudio();
  a.ctx = fakeContext();
  a.master = a.ctx.createGain();
  a.ctx.nodes.length = 0;
  return a;
};
const of = (a, kind) => a.ctx.nodes.filter((n) => n.kind === kind);

// 1) A tone is an oscillator and a gain, and both are let go of when the oscillator ends.
{
  const a = audio();
  a.tone(440, 2, 0.5, 0.2, "triangle", 220);
  const [osc] = of(a, "oscillator"),
    [gain] = of(a, "gain");
  assert.equal(osc.type, "triangle");
  assert.deepEqual(osc.started, [2]);
  assert.ok(Math.abs(osc.stopped[0] - 2.53) < 1e-9, "stops just after the sound");
  assert.equal(typeof osc.onended, "function", "it asks to be told when it has ended");
  assert.equal(osc.disconnects + gain.disconnects, 0, "and is let go of only then");
  osc.onended();
  assert.equal(osc.disconnects, 1);
  assert.equal(gain.disconnects, 1);
  a.enabled = false;
  a.tone(440, 2, 0.5);
  assert.equal(of(a, "oscillator").length, 1, "a muted game makes nothing");
}

// 2) Noise: one buffer for the whole game, a random place in it, a fade through the gain, and all three nodes let go of at the end.
{
  const a = audio();
  for (let i = 0; i < 40; i++) a.noise(3 + i * 0.1, [0.025, 0.08, 0.5, 0.9, 1.4][i % 5], 0.1, 1000 + i);
  assert.equal(a.ctx.buffers.length, 1, "forty bursts, one buffer (the music asked for a new one each time)");
  const hiss = a.ctx.buffers[0];
  assert.ok(hiss.duration >= 3, "longer than the longest burst (1.4 s) with room to start anywhere");
  const sources = of(a, "source");
  assert.equal(sources.length, 40);
  let offsets = new Set();
  sources.forEach((s, i) => {
    const duration = [0.025, 0.08, 0.5, 0.9, 1.4][i % 5];
    assert.equal(s.buffer, hiss);
    const [at, offset, length] = s.started;
    assert.equal(at, 3 + i * 0.1);
    assert.equal(length, duration, "plays as long as asked");
    assert.ok(offset >= 0 && offset + length <= hiss.duration + 1e-9, "from inside the buffer");
    offsets.add(offset.toFixed(3));
    assert.equal(typeof s.onended, "function");
  });
  assert.ok(offsets.size > 30, "from a different place nearly every time");
  // The fade is the gain going from the volume to nothing over the burst (the buffer used to carry it).
  const gain = of(a, "gain")[0];
  assert.deepEqual(gain.gain.calls, [
    ["set", 0.1, 3],
    ["linear", 0, 3.025],
  ]);
  const filter = of(a, "filter")[0];
  assert.equal(filter.type, "highpass");
  assert.equal(filter.frequency.value, 1000);
  // The chain is source → filter → gain → master, and let go of at the end, all of it.
  assert.deepEqual(sources[0].outputs, [filter]);
  assert.deepEqual(filter.outputs, [gain]);
  assert.deepEqual(gain.outputs, [a.master]);
  sources[0].onended();
  assert.equal(sources[0].disconnects + filter.disconnects + gain.disconnects, 3);
  a.enabled = false;
  a.noise(0, 0.1);
  assert.equal(of(a, "source").length, 40, "a muted game makes nothing");
}

// 3) A node that will not disconnect (it was never connected, in some browsers an error) does not break the sound.
{
  const a = audio();
  a.tone(300, 1, 0.1);
  const [osc] = of(a, "oscillator");
  osc.disconnect = () => {
    throw new Error("InvalidAccessError");
  };
  assert.doesNotThrow(() => osc.onended());
  a.noise(1, 0.1);
  of(a, "source")[0].disconnect = () => {
    throw new Error("InvalidAccessError");
  };
  assert.doesNotThrow(() => of(a, "source")[0].onended());
}

// 4) The crowd's cheer and a recorded sound let go of theirs too; the music (the scheduler) makes only chains that end.
{
  const a = audio();
  a.cheer(2);
  const cheerSource = of(a, "source").find((s) => s.buffer && s.buffer.duration > 1 && s.buffer !== a.hiss);
  assert.ok(cheerSource, "the swell of voices has a buffer of its own (shaped, so not the shared noise)");
  assert.equal(typeof cheerSource.onended, "function");
  const before = of(a, "oscillator").length + of(a, "source").length;
  a.playing = true;
  a.next = 0;
  a.ctx.currentTime = 0;
  a.schedule();
  const chains = [...of(a, "oscillator"), ...of(a, "source")];
  assert.ok(chains.length > before, "the music made sounds");
  assert.ok(
    chains.every((n) => typeof n.onended === "function"),
    "every one of them ends and says so",
  );
  assert.ok(a.ctx.buffers.filter((b) => b === a.hiss).length === 1);
}

console.log(
  "Audio checks passed: every tone and noise chain is let go of when its source ends (and a refusing node breaks nothing), the noise comes from one shared buffer at a random place and fades through the gain, and the cheer and the music end the same way.",
);
