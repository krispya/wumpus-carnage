import { createActions } from 'koota';
import { Sound, SoundView, type SoundDraw, type SoundKind } from './traits';

export const soundActions = createActions((world) => ({
  initializeSound: () => {
    world.add(Sound);
  },
  /** Attach the mixer. Whatever was cued while no mixer listened is dropped rather than played late. */
  mountSoundView: (view: SoundDraw) => {
    world.get(Sound)!.queue.count = 0;
    world.add(SoundView(view));
  },
  unmountSoundView: () => {
    world.remove(SoundView);
  },
  unlockSound: () => {
    world.set(Sound, { ...world.get(Sound)!, unlocked: true });
  },
  /** Let everything fall silent at once, or bring it back. */
  silenceSound: (silenced: boolean) => {
    world.set(Sound, { ...world.get(Sound)!, silenced });
  },
  toggleSound: () => {
    const sound = world.get(Sound)!;
    world.set(Sound, { ...sound, muted: !sound.muted });
  },
  /** The mixer has played this frame's cues. */
  clearSoundCues: () => {
    world.get(Sound)!.queue.count = 0;
  },
  /** Queue a sound for the mixer. A frame holds a bounded number of cues, and any past that are dropped. */
  cueSound: (
    sound: SoundKind,
    options: {
      take?: number;
      pan?: number;
      panTo?: number;
      rate?: number;
      gain?: number;
      delay?: number;
      attack?: number;
      tone?: number;
      space?: number;
      expanse?: number;
      offset?: number;
    }
  ) => {
    const queue = world.get(Sound)!.queue;

    if (queue.count === queue.cues.length) return;

    const cue = queue.cues[queue.count++]!;
    cue.sound = sound;
    cue.take = options.take ?? 0;
    cue.pan = options.pan ?? 0;
    cue.panTo = options.panTo ?? cue.pan;
    cue.rate = options.rate ?? 1;
    cue.gain = options.gain ?? 1;
    cue.delay = options.delay ?? 0;
    cue.attack = options.attack ?? 0;
    cue.tone = options.tone ?? 1;
    cue.space = options.space ?? 0;
    cue.expanse = options.expanse ?? 0;
    cue.offset = options.offset ?? 0;
  },
}));
