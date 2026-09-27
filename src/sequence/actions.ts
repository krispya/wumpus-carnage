import { createActions } from 'koota';
import { Time } from '../time/traits';
import { Timeline, type Cue } from './traits';

export const sequenceActions = createActions((world) => ({
  /** Play a script from now: timed cues fall due that long after this moment, and event cues wait for theirs. */
  loadSequence: (cues: readonly Cue[]) => {
    const now = world.get(Time)!.elapsed;
    world.set(Timeline, {
      cues,
      due: Float64Array.from(cues, (cue) => ('at' in cue ? now + cue.at : Infinity)),
    });
  },
  /** Something happened in the scene: every cue waiting on it falls due after its delay. */
  triggerSequence: (event: string) => {
    const { cues, due } = world.get(Timeline)!;
    const now = world.get(Time)!.elapsed;

    for (let index = 0; index < cues.length; index++) {
      const cue = cues[index]!;

      if ('on' in cue && cue.on === event) due[index] = now + (cue.after ?? 0);
    }
  },
  runSequenceCue: (index: number) => {
    const { cues, due } = world.get(Timeline)!;
    due[index] = Infinity;
    cues[index]!.run();
  },
}));
