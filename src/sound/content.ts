import type { Recording, SoundKind, Voice } from './traits';

/**
 * How the battle sounds with distance. Shots nearer than `near` world units tear past the camera. The rest are the
 * battle's distant clamour, loudest and clearest at `closest` and fading, dulling, and sinking into the hall beyond
 * it, but never below `faint` of their level, so the battle seen from far outside is a faint crackle. Of the distant
 * shots, the nearest are always heard and the furthest only a `heard` share of the time. Only flares of at least
 * `boom` energy are heard at all. The wumpus's own small sounds, its blinks and squeaks, carry only `voice` units.
 * Levels are fractions of full scale.
 */
export const DISTANCE = { near: 18, closest: 26, faint: 0.12, heard: 0.3, boom: 3.5, voice: 40 };

/**
 * A voice's brightness as the cut-off of the low-pass it plays through, spaced evenly in pitch from `floor`, a
 * rumble, at 0, to `ceiling`, clear, at 1.
 */
export const TONE = { floor: 150, ceiling: 16_000 };

/**
 * Explosions reach the wumpus faint, as though filtered through the void: dulled to a rumble, swelling in rather
 * than striking, and mostly heard as the void's echo of them. Tones are at the nearest and furthest flares.
 */
export const EXPLOSION = { tone: [0.3, 0.12] as const, attack: 0.06, space: 0.25, expanse: 1 };

export const LEVELS = {
  master: 0.85,
  shot: 0.3,
  beam: 0.36,
  flyby: 0.55,
  hit: 0.22,
  blink: 0.1,
  yelp: 0.28,
  charge: 0.5,
  launch: 0.7,
  implode: 0.8,
  gulp: 0.7,
  plunge: 0.8,
  detonation: 0.9,
  scream: 0.35,
  drone: 0.55,
  heartbeat: 0.85,
  swish: 0.45,
  creak: 0.5,
  wilhelm: 0.6,
  riser: 0.42,
  strain: 0.55,
  organ: 0.22,
};

export interface Layer {
  voice: Voice;
  /** Its level within the sound. */
  gain: number;
  /** The clean bus, or the crunch bus that saturates it and takes it down to a few bits. */
  bus: 'clean' | 'crunch';
  /** Its pitch against the cue's, and its delay after the cue's, in seconds. */
  rate?: number;
  delay?: number;
  /** Seconds after which its tail is cut, so it strikes and gets out of the way. */
  cut?: number;
}

/**
 * Each sound as the voices layered to make it. Recordings lead, giving it body and a modern clarity, and
 * console-era synths sit under them through the crunch, giving it grit. Every layer plays at the cue's pitch and
 * place, so they sound as one. Shots strike rather than sing: a metal hit pitched up leads them, the laser's own
 * dive is cut short behind it, and a crushed snap of noise gives them their crunch.
 */
export const LAYERS: Record<SoundKind, readonly Layer[]> = {
  shot: [
    { voice: 'crack', gain: 0.9, bus: 'clean', rate: 1.7, cut: 0.1 },
    { voice: 'blaster', gain: 0.45, bus: 'clean', cut: 0.12 },
    { voice: 'snap', gain: 0.8, bus: 'crunch' },
    { voice: 'pew', gain: 0.35, bus: 'crunch' },
  ],
  beam: [
    { voice: 'crack', gain: 0.9, bus: 'clean', rate: 1.15, cut: 0.18 },
    { voice: 'turbolaser', gain: 0.85, bus: 'clean', cut: 0.35 },
    { voice: 'snap', gain: 0.6, bus: 'crunch', rate: 0.8 },
    { voice: 'cannon', gain: 0.5, bus: 'crunch' },
  ],
  flyby: [
    { voice: 'crack', gain: 1, bus: 'clean', rate: 1.35, cut: 0.15 },
    { voice: 'turbolaser', gain: 0.8, bus: 'clean', rate: 1.15 },
    { voice: 'snap', gain: 0.7, bus: 'crunch' },
    { voice: 'zap', gain: 0.5, bus: 'crunch' },
    { voice: 'pass', gain: 0.7, bus: 'clean', delay: 0.02 },
  ],
  hit: [
    { voice: 'blast', gain: 1, bus: 'clean' },
    { voice: 'boom', gain: 0.25, bus: 'crunch' },
  ],
  blink: [{ voice: 'blink', gain: 1, bus: 'clean' }],
  yelp: [{ voice: 'eep', gain: 1, bus: 'clean' }],
  charge: [
    { voice: 'charge', gain: 1, bus: 'crunch' },
    { voice: 'field', gain: 0.6, bus: 'clean', rate: 0.7, delay: 0.1 },
    { voice: 'field', gain: 0.5, bus: 'clean', rate: 1.2, delay: 0.55 },
  ],
  launch: [
    { voice: 'crack', gain: 1, bus: 'clean', rate: 0.75, cut: 0.25 },
    { voice: 'turbolaser', gain: 0.9, bus: 'clean', rate: 0.7 },
    { voice: 'thoom', gain: 0.8, bus: 'crunch' },
  ],
  implode: [
    { voice: 'implode', gain: 1, bus: 'crunch' },
    { voice: 'rumble', gain: 0.9, bus: 'clean', delay: 0.55 },
  ],
  gulp: [
    { voice: 'gulp', gain: 1, bus: 'clean' },
    { voice: 'gulp', gain: 0.4, bus: 'crunch', rate: 0.5 },
  ],
  detonation: [
    { voice: 'rumble', gain: 1, bus: 'clean', rate: 0.45 },
    { voice: 'blast', gain: 0.8, bus: 'clean', rate: 0.4, delay: 0.08 },
    { voice: 'boom', gain: 0.6, bus: 'crunch', rate: 0.55 },
  ],
  plunge: [
    { voice: 'roar', gain: 1, bus: 'clean' },
    { voice: 'roar', gain: 0.6, bus: 'crunch' },
    { voice: 'rumble', gain: 0.7, bus: 'clean', rate: 0.6, delay: 0.2 },
  ],
  scream: [{ voice: 'scream', gain: 1, bus: 'clean' }],
  heartbeat: [
    { voice: 'heartbeat', gain: 1, bus: 'clean' },
    { voice: 'heartbeat', gain: 0.6, bus: 'clean', rate: 0.5 },
  ],
  wilhelm: [{ voice: 'wilhelm', gain: 1, bus: 'clean' }],
  swish: [
    { voice: 'cloth', gain: 1, bus: 'clean', rate: 0.75 },
    { voice: 'rush', gain: 0.45, bus: 'clean', rate: 0.8, cut: 0.55 },
    { voice: 'gasp', gain: 0.3, bus: 'clean' },
  ],
  creak: [{ voice: 'creak', gain: 1, bus: 'clean', rate: 0.6 }],
};

/**
 * The recordings each recorded voice draws its takes from, by file name in `assets/sounds`: Kenney's Sci-Fi Sounds,
 * released under CC0. Metal hits for the strike of every shot, small lasers for distant blaster fire, large ones for
 * turbolasers, crunchy explosions, a force field's hum for the gun charging, and deep explosions for the hole.
 */
export const RECORDINGS: Record<Recording, readonly string[]> = {
  crack: ['impactMetal_000', 'impactMetal_001', 'impactMetal_002', 'impactMetal_004'],
  blaster: ['laserSmall_000', 'laserSmall_001', 'laserSmall_002', 'laserSmall_003'],
  turbolaser: ['laserLarge_000', 'laserLarge_002', 'laserLarge_004'],
  blast: ['explosionCrunch_000', 'explosionCrunch_001', 'explosionCrunch_003'],
  field: ['forceField_001', 'forceField_003'],
  rumble: ['lowFrequency_explosion_000', 'lowFrequency_explosion_001'],
  cloth: ['cloth1', 'cloth2', 'cloth3', 'cloth4'],
  rush: ['thrusterFire_000', 'thrusterFire_001', 'thrusterFire_002'],
  creak: ['creak1', 'creak2', 'creak3'],
};

/**
 * How long the implosion swells before it strikes, in seconds, so it can be cued that far ahead of the moment the
 * hole forms.
 */
export const IMPLODE_LEAD = 0.76;

/**
 * Doom's drone. It sounds only while a hole is open: quiet and muffled at first, opening from `tone[0]` to `tone[1]`
 * hertz and swelling as dread rises, climbing `climb` semitones as the hole draws the wumpus in, and joined by the
 * same drone a tritone above as the end nears. As the tide takes the wumpus it climbs `torment` semitones further.
 * once it is gone it falls back to `hush` of its level, and as the camera falls in it swells `fall.swell` times
 * louder, climbs `fall.climb` semitones further, and opens right up, to a roar.
 */
export const DOOM_DRONE = {
  tone: [160, 2600] as const,
  climb: 12,
  tritone: 0.6,
  torment: 5,
  hush: 0.3,
  fall: { swell: 2.2, climb: 7, tone: 6000 },
};

/**
 * The rise under the end, as in Gravity's score: a Shepard tone climbing without end, `octaves` of partials each
 * gliding up an octave every `seconds`. It rises with the wumpus's tumble as the tide takes it, loudest and running
 * `spinning` times faster once it turns `spin` times a second, and `fall` times faster as the camera is sucked in,
 * its tone opening from `tone[0]` to `tone[1]` hertz.
 */
export const RISER = {
  seconds: 6,
  octaves: 6,
  spin: 1.2,
  spinning: 1,
  fall: 1.6,
  tone: [900, 7000] as const,
};

/**
 * The organ, as in Interstellar's score: a pipe organ holding a minor chord, a low bed under the hush once the wumpus
 * is gone, `hush` of its level, and `fall` of it as the camera is sucked in, its tone opening from `tone[0]` to
 * `tone[1]` hertz.
 */
export const ORGAN = { hush: 0.8, fall: 0.5, tone: [1400, 9000] as const };

/**
 * Space tearing: the whole mix is driven into a hard saturation, as far as `torment` of the way while the tide takes
 * the wumpus and all the way as the camera is sucked in, `drive` times harder at its worst.
 */
export const TEAR = { torment: 0.45, drive: 10 };

/**
 * The wumpus's heart, which keeps the beat through the flight, after the way Gravity keeps it, in beats a second:
 * racing at `racing` as it tumbles. Once the hole opens, dropping, as Gravity's score drops to near silence, to a slow,
 * deep `slow`, quickening to `quick` as the hole grows. Racing again up to `frantic` as the tide takes it. And
 * stopping dead when it is gone. It sounds `deep` times louder at its slowest, and as though in the ear: dry, with
 * no room round it, and muffled, `muffled` of the way from dull to clear.
 */
export const HEART = { racing: 2.3, slow: 0.8, quick: 1.5, frantic: 3.2, deep: 1.25, muffled: 0.3 };

/**
 * The swish of the wumpus through its tumble, recorded cloth and a rush of air with a breath beneath: every
 * `interval` seconds or so, give or take `scatter`, as it tumbles free. Once the hole has it, once each turn of its
 * tumble, though never quicker than `quickest` seconds or slower than `slowest`, `strain` higher as the tide takes
 * it, and never once it is gone.
 */
export const SWISH = { interval: 0.62, scatter: 0.18, quickest: 0.45, slowest: 1.2, strain: 0.35 };

/**
 * The wumpus's body creaking as the tide draws it out, recorded creaks pitched down to its bulk: once the tide has it
 * `from` of the way, every `interval[0]` to `interval[1]` seconds, quicker the harder it pulls.
 */
export const CREAK = { from: 0.15, interval: [0.6, 1.8] as const };

/** The sounds the wumpus itself makes, which pass through its own bus, to be caught at the horizon. */
export const OWN: ReadonlySet<SoundKind> = new Set([
  'heartbeat',
  'swish',
  'creak',
  'wilhelm',
  'scream',
  'yelp',
  'blink',
]);

/**
 * The horizon, as heard from outside it. Over the last `from` of its fall, time slows for the wumpus: its heart beats
 * up to `heart` slower and its voice drops up to `voice` lower, darkening to `dark` hertz. At the horizon its last
 * `grain` seconds of sound are caught and held, looping back on themselves `feedback` as loud each time, stretched
 * `stretch` times longer and redshifted from `redshift[0]` to `redshift[1]` hertz as they fade over `seconds`.
 */
export const FREEZE = {
  from: 0.1,
  heart: 0.6,
  voice: 0.35,
  dark: 900,
  grain: 0.12,
  feedback: 0.985,
  stretch: 3,
  redshift: [9000, 180] as const,
  seconds: 3.5,
};

/** How many seconds before the wumpus is gone its last scream sets out, so it peaks as it sinks in. */
export const WILHELM_LEAD = 0.7;

/** How many seconds into its take the plunge's roar comes in, near its height, as the hole sucks the camera in. */
export const PLUNGE_FROM = 4.6;

/**
 * The crunch: how hard a gritty voice is driven into a soft clip, how rounded that clip's knee is, the ceiling above
 * which its fizz is trimmed, and how much of it is kept. Each gritty voice is crunched before its distance dulls it,
 * so the grit fades with everything else.
 */
export const CRUNCH = { drive: 3.5, warmth: 2, ceiling: 14_000, level: 0.35 };

/** The hall: how long its tail rings, how quickly it dies and darkens, and how much of it returns to the mix. */
export const HALL = { seconds: 3, decay: 1.9, darkening: 1.2, wet: 0.55, predelay: 0.03 };

/**
 * The void: a far larger space with no walls, which answers after a long moment, swells in rather than starting at
 * once, and rings dark for seconds, trimmed of everything above `ceiling`.
 */
export const EXPANSE = {
  seconds: 7,
  decay: 0.7,
  darkening: 0.6,
  wet: 0.9,
  predelay: 0.12,
  ceiling: 900,
};
