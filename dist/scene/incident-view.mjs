// Visuals for chaos incidents: visitors, loose animals, hazards, blackout lighting and trampoline stunts.
// Filled in per incident; every method is a pure view of simulation state.
export class IncidentView {
  constructor(w) {
    this.w = w;
  }
  // Global light multipliers (1 = normal). Blackouts dim the water and caustics.
  lightLevel() {
    return { water: 1, caustic: 1 };
  }
  sync() {}
  pose() {}
  poseCoach() {}
  carryModel() {
    return null;
  }
}
