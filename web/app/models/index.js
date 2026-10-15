// The built-in models, by the `model` name trainings.json gives each training. Each builder takes
// the three.js module and returns a Group whose meshes carry userData.partId.

import { buildTrainerEngine } from './engine.js';
import { buildTrainerAircraft } from './aircraft.js';
import { buildGearBench } from './gear.js';
import { buildTrainerEmpennage } from './empennage.js';

export const MODELS = {
  engine: buildTrainerEngine,
  aircraft: buildTrainerAircraft,
  gear: buildGearBench,
  empennage: buildTrainerEmpennage,
};

/** Hits that count: see-through skins never block a view, a pick or a label. */
export function solidHits(hits) {
  return hits.filter((h) => !h.object.userData.seeThrough);
}
