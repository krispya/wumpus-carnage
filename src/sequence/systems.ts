import type { World } from 'koota';
import { Time } from '../time/traits';
import { sequenceActions } from './actions';
import { Timeline } from './traits';

/** Run due cues in time order, using declaration order to break ties. A cue may load a new script. */
export function advanceSequence(world: World): void {
  const now = world.get(Time)!.elapsed;

  while (true) {
    const { due, cues } = world.get(Timeline)!;
    let next = -1;
    let earliest = Infinity;

    for (let index = 0; index < due.length; index++) {
      if (due[index]! <= now && due[index]! < earliest && cues[index]!.ready?.() !== false) {
        next = index;
        earliest = due[index]!;
      }
    }

    if (next < 0) return;

    sequenceActions(world).runSequenceCue(next);
  }
}
