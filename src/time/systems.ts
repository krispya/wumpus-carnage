import type { World } from 'koota';
import { Time } from './traits';

/** Accumulate a bounded playback delta. */
export function updateTime(world: World, delta: number): void {
  const time = world.get(Time)!;
  // Bound the step so a tab returning from the background resumes instead of leaping ahead.
  time.delta = Math.min(delta, 0.1);
  time.elapsed += time.delta;
  world.set(Time, time);
}
