import { trait } from 'koota';

/** The voices baked by the synth, in the manner of a late-nineties console. */
export type Synth =
  | 'pew'
  | 'snap'
  | 'zap'
  | 'pass'
  | 'cannon'
  | 'boom'
  | 'blink'
  | 'eep'
  | 'charge'
  | 'thoom'
  | 'implode'
  | 'gulp'
  | 'scream'
  | 'heartbeat'
  | 'roar'
  | 'wilhelm'
  | 'gasp';
/** The voices recorded, for body and a modern clarity. */
export type Recording =
  'crack' | 'blaster' | 'turbolaser' | 'blast' | 'field' | 'rumble' | 'cloth' | 'rush' | 'creak';
export type Voice = Synth | Recording;
/** The baked voices that run for as long as the mixer does. */
export type Loop = 'drone' | 'riser' | 'organ' | 'strain';
/** What the scene asks to hear. The mixer plays each as the voices layered to make it. */
export type SoundKind =
  | 'shot'
  | 'beam'
  | 'flyby'
  | 'hit'
  | 'blink'
  | 'yelp'
  | 'charge'
  | 'launch'
  | 'implode'
  | 'gulp'
  | 'scream'
  | 'heartbeat'
  | 'plunge'
  | 'detonation'
  | 'wilhelm'
  | 'swish'
  | 'creak';

/**
 * One sound: what it is and which take of each of its voices; where it sits from -1 left to 1 right, and where it
 * has moved to by the time it ends; its playback rate, level, delay, and the seconds it takes to swell in; its
 * brightness, from 0, muffled to a rumble, to 1, clear; and how much of it the hall and the void carry.
 */
export interface SoundCue {
  sound: SoundKind;
  take: number;
  pan: number;
  panTo: number;
  rate: number;
  gain: number;
  delay: number;
  attack: number;
  tone: number;
  space: number;
  expanse: number;
  /** How many seconds into its takes it starts. */
  offset: number;
}

/** What the listener last heard, so each change in the scene sounds once. */
export interface Heard {
  blinking: boolean;
  frightened: boolean;
  /** Whether the wumpus was caught, and whether it was swallowed, last frame. */
  caught: boolean;
  swallowed: boolean;
}

export const Sound = trait({
  muted: false,
  /** Whether everything has fallen silent, as it does past the horizon. */
  silenced: false,
  /** Whether a gesture has let the browser start the audio. */
  unlocked: false,
  /**
   * Doom's drone: how loud it runs, 0..1, where it sits across the stereo field, how far it has climbed, 0..1, how
   * close doom feels, which opens it up and brings in the tritone above it, and how far the camera has fallen into
   * the hole, 0..1, which swells it to a roar.
   */
  drone: 0,
  dronePan: 0,
  rise: 0,
  dread: 0,
  fall: 0,
  /**
   * The end: how hard the tide has the wumpus, 0..1, held once it is gone; how fast it tumbles, in turns a second;
   * whether it is gone; and how hushed the moment after it is gone is, 0..1.
   */
  torment: 0,
  spin: 0,
  gone: false,
  hush: 0,
  /** Seconds until the wumpus's heart next beats, until it next swishes through a turn, and until it next creaks. */
  heart: 0,
  breath: 0,
  creak: 0,
  /** How far time has slowed for the wumpus as it nears the horizon, as heard from outside, 0..1. */
  dilation: 0,
  /** This frame's cues, a fixed buffer and count that the mounted mixer drains. */
  queue: () => ({
    count: 0,
    cues: Array.from({ length: 48 }, (): SoundCue => ({
      sound: 'shot',
      take: 0,
      pan: 0,
      panTo: 0,
      rate: 1,
      gain: 0,
      delay: 0,
      attack: 0,
      tone: 1,
      space: 0,
      expanse: 0,
      offset: 0,
    })),
  }),
  heard: (): Heard => ({
    blinking: false,
    frightened: false,
    caught: false,
    swallowed: false,
  }),
});

/** A continuous voice: its looping source, and the brightness, level, and place the scene sets on it. */
export interface LoopDraw {
  source: AudioBufferSourceNode;
  tone: BiquadFilterNode;
  level: GainNode;
  pan: StereoPannerNode;
}

/**
 * The mounted mixer. Every voice enters at `input`, and at `reverb` and `expanse` for its share of the hall and of
 * the void. A gritty voice passes through its own shaper on `crunch`'s curve first.
 */
export interface SoundDraw {
  context: AudioContext;
  samples: Readonly<Record<Voice | Loop, readonly AudioBuffer[]>>;
  input: AudioNode;
  crunch: Float32Array<ArrayBuffer>;
  reverb: AudioNode;
  expanse: AudioNode;
  master: GainNode;
  drone: LoopDraw;
  /** The drone again, a tritone above, which joins it as doom nears. */
  tritone: LoopDraw;
  /** The rise under the end, and the wumpus's body straining. */
  riser: LoopDraw;
  strain: LoopDraw;
  /** The organ. */
  organ: LoopDraw;
  /** Space tearing: the mix clean, and driven into saturation, and how much of that is kept. */
  tear: { clean: GainNode; drive: GainNode; torn: GainNode };
  /** The wumpus's own sounds, which can be caught at the horizon and held there. */
  own: Held;
}

/**
 * The wumpus's own sounds: they enter at `input` and pass `live` through `tone`, which darkens as time slows for it;
 * `gate` feeds them into `hold`, a line `loop` feeds back on itself through `redshift`, which is heard at `held` once
 * they are caught, whether they are.
 */
export interface Held {
  input: GainNode;
  live: GainNode;
  tone: BiquadFilterNode;
  gate: GainNode;
  hold: DelayNode;
  loop: GainNode;
  redshift: BiquadFilterNode;
  held: GainNode;
  caught: boolean;
}

export const SoundView = trait((): SoundDraw | undefined => undefined);
