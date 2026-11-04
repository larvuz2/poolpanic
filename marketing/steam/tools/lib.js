// The lineup: clears the deck, stands a cast in a row facing +x, each pinned to a clip.
const M = await import('/scene/swimmer-models.mjs');
await Promise.all(['carl', 'leopard', 'kid', 'marco', 'valentina'].map((id) => M.loadFigure(id)));
s.people.length = 0;
s.visitors.length = 0;
const placed = [];
CAST.forEach((c, i) => {
  const p = s.spawn({ type: c.type || 'intermediate', sick: false });
  if (c.figure) p.figure = c.figure;
  if (c.skin !== undefined) p.skin = c.skin;
  if (c.vip) p.vip = true;
  Object.assign(p, { status: 'queue', path: [], x: X, z: Z0 + i * STEP, angle: (typeof FACE === 'number' ? FACE : Math.PI / 2) + (c.turn || 0), actualSpeed: 0, h: 100, crampAt: Infinity });
  placed.push([p.id, c]);
});
s.coach.x = X + 30; s.coach.z = 40;
await new Promise((r) => setTimeout(r, 2500));
const missing = [];
for (const [id, c] of placed) {
  const g = w.people.get(id), u = g?.userData;
  const r = u?.rig;
  if (!r || !r.actions[c.clip]) { missing.push(c.figure || c.skin + ':' + c.clip); continue; }
  r.update = function (dt) { if (this.current !== c.clip) this.to(c.clip, 0.15); this.actions[c.clip].setEffectiveTimeScale(c.rate ?? 1); this.mixer.update(dt); };
  if (c.at) { r.to(c.clip, 0); r.actions[c.clip].time = c.at; }
}
for (const h of [w.coachHalo, w.actionHalo, w.dashTrail]) if (h) h.traverse((o) => { if (o.material) o.material.visible = false; });
