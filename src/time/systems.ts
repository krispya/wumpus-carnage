import type { World } from 'koota';
import { Time } from './traits';

/** The longest step playback takes, so a tab returning from the background resumes rather than leaps ahead. */
const MAX_STEP = 0.1;

/** Accumulate a bounded playback delta. */
export function updateTime(world: World, delta: number): void {
  const time = world.get(Time)!;
  time.delta = Math.min(delta, MAX_STEP);
  time.elapsed += time.delta;
  world.set(Time, time);
}
