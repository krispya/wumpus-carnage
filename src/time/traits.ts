import { trait } from 'koota';

/** The frame clock: the latest bounded step and the playback seconds accumulated from it. */
export const Time = trait({ delta: 0, elapsed: 0 });
