import { trait } from 'koota';

/** Times and delays are in playback seconds. Events rearm their cues from the latest occurrence. */
export type Cue = ({ readonly at: number } | { readonly on: string; readonly after?: number }) & {
  /** Leave a due cue pending until whatever it needs is ready. */
  readonly ready?: () => boolean;
  readonly run: () => void;
};

/** The script playing: its cues, and when each is next due, or never while it waits on its event. */
export const Timeline = trait({
  cues: (): readonly Cue[] => [],
  due: () => new Float64Array(0),
});
