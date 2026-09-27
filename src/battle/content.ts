import { Color } from 'three/webgpu';

type Range = readonly [number, number];
type Rgb = readonly [number, number, number];

/** A colour as linear light, from its sRGB hex. */
function linear(hex: string): Rgb {
  const { r, g, b } = new Color(hex);

  return [r, g, b];
}

/**
 * The smallest a bolt is drawn across, and a flare across its radius, in pixels of the frame, however far off it is.
 */
export const SMALLEST = { bolt: 2.5, flare: 5 };

/** How many bolts, flares, and blasts can be drawn at once. */
export const BOLT_CAPACITY = 256;
export const FLARE_CAPACITY = 64;
export const BLAST_CAPACITY = 2;

/**
 * Laser colours, the glow round each bolt's core, weighted by how often each is fired, after the reference's night:
 * ice blue and cornflower, as its cold stars; orange, marigold, and ember, as its fire; crimson; and magenta and
 * orchid, as its smoke. Every core burns its own colour most of the way to white, `BOLT_CORE` of the way, so each
 * bolt is a white-hot line fringed with its hue.
 */
export const BOLT_COLORS: readonly { color: Rgb; weight: number }[] = [
  { color: linear('#a8c0ff'), weight: 0.18 },
  { color: linear('#6f94ff'), weight: 0.12 },
  { color: linear('#ff9a22'), weight: 0.17 },
  { color: linear('#ffc93a'), weight: 0.07 },
  { color: linear('#ff561c'), weight: 0.06 },
  { color: linear('#ff2c3c'), weight: 0.13 },
  { color: linear('#ff3f9a'), weight: 0.12 },
  { color: linear('#b06cff'), weight: 0.15 },
];
export const BOLT_CORE = 0.7;

export const FLARE_COLORS: readonly { color: Rgb; weight: number }[] = [
  { color: linear('#ff862a'), weight: 0.3 },
  { color: linear('#ffcc48'), weight: 0.14 },
  { color: linear('#ff482c'), weight: 0.12 },
  { color: linear('#ff4fa2'), weight: 0.1 },
  { color: linear('#fff0c8'), weight: 0.14 },
  { color: linear('#6ff0c0'), weight: 0.12 },
  { color: linear('#e4f25a'), weight: 0.08 },
];

export interface ShotStyle {
  /** How far behind the camera's focus the shots fly, as world z. */
  depth: Range;
  /** Seconds between shots, before the battle's heat scales it. */
  interval: Range;
  /** Path length, as a multiple of the frame's width at the shot's depth. */
  span: Range;
  /** How far across the frame a shot's path may centre, as a fraction of the frame's half width and height. */
  reach: number;
  bolt: { speed: Range; length: Range; width: Range; energy: Range };
  /** A beam lights its whole path almost at once, holds, and fades, rather than streaking along it. */
  beam: { chance: number; speed: number; life: Range };
  /** Now and then a shot flies in as a volley of parallel bolts, fired a beat apart. Most fly alone. */
  volley: { chance: number; count: Range; spacing: Range; stagger: Range };
  /** A share of shots strike something inside the frame and burst there. */
  impact: number;
  /**
   * If set, each shot's path passes this far from the frame's focus, where the wumpus floats, rather than anywhere
   * across the frame: close enough to feel, never close enough to hit.
   */
  miss?: Range;
}

/**
 * The battle raging behind the wumpus. Lengths are in world units, speeds in units per second, times in seconds,
 * and energies in multiples of white, so the brighter shots bloom. Paths centre anywhere across the frame and
 * reach past it, so most shots enter and leave off screen.
 */
export const FAR: ShotStyle = {
  depth: [-40, -10],
  interval: [0.04, 0.16],
  span: [0.9, 1.6],
  reach: 1.1,
  bolt: { speed: [12, 30], length: [6, 20], width: [0.12, 0.24], energy: [2.2, 4] },
  beam: { chance: 0.18, speed: 160, life: [0.5, 1.1] },
  volley: { chance: 0.05, count: [2, 2.6], spacing: [0.4, 1.2], stagger: [0.04, 0.12] },
  impact: 0.2,
};

/** Now and then a shot tears past between the camera and the wumpus, close enough to give the frame depth. */
export const NEAR: ShotStyle = {
  depth: [5, 10],
  interval: [6, 14],
  span: [1.4, 2],
  reach: 0.5,
  bolt: { speed: [60, 110], length: [8, 16], width: [0.05, 0.09], energy: [4, 6] },
  beam: { chance: 0.4, speed: 260, life: [0.35, 0.6] },
  volley: { chance: 0.1, count: [2, 2], spacing: [0.3, 0.5], stagger: [0.05, 0.08] },
  impact: 0,
};

/**
 * Close calls: every few seconds a shot tears right past the wumpus, a body's width from it, fast and bright. The
 * wumpus is about two units from its middle to its furthest edge and drifts a little further, so a miss is wider.
 */
export const CLOSE: ShotStyle = {
  depth: [-1.5, 1.5],
  interval: [4, 9],
  span: [1.6, 2.2],
  reach: 0,
  bolt: { speed: [45, 80], length: [6, 12], width: [0.08, 0.12], energy: [4, 6] },
  beam: { chance: 0.2, speed: 220, life: [0.35, 0.55] },
  volley: { chance: 0.05, count: [2, 2], spacing: [0.3, 0.5], stagger: [0.05, 0.08] },
  impact: 0,
  miss: [2.6, 3.8],
};

/**
 * The battle's far reaches, where ships a thousand times the wumpus's size trade fire: beams a hundred units long
 * and units thick, lancing across hundreds of units of dark far behind it. From the wumpus they are thin distant
 * lines; seen from far off, they are the battle.
 */
export const VAST: ShotStyle = {
  depth: [-420, -140],
  interval: [0.1, 0.24],
  span: [0.6, 1.3],
  reach: 1.2,
  bolt: { speed: [90, 200], length: [60, 140], width: [1.6, 3.2], energy: [2, 3.2] },
  beam: { chance: 0.55, speed: 900, life: [1.4, 3] },
  volley: { chance: 0.25, count: [2, 4], spacing: [4, 10], stagger: [0.06, 0.18] },
  impact: 0.25,
};

export interface FlareStyle {
  /** How far behind the camera's focus they burst, as world z. */
  depth: Range;
  interval: Range;
  radius: Range;
  life: Range;
  energy: Range;
}

/** Distant hits and explosions, flashing up and burning out across the battle's depth. */
export const FLARES: FlareStyle = {
  depth: FAR.depth,
  interval: [0.1, 0.4],
  radius: [0.3, 0.8],
  life: [1.2, 3.2],
  energy: [2, 4],
};

/** Ships dying in the far reaches: slow, vast blooms of fire. */
export const VAST_FLARES: FlareStyle = {
  depth: VAST.depth,
  interval: [0.07, 0.2],
  radius: [6, 18],
  life: [2, 4.5],
  energy: [2, 3.4],
};

/** How quickly a shot lights up, and the share of its life it spends fading out. */
export const BOLT_RISE = 0.03;
export const BOLT_FADE = 0.3;
/** How bright a streaking bolt's tail is next to its head. A beam is lit evenly. */
export const BOLT_TAIL = 0.08;

export const BATTLE_SEED = 23;

/**
 * The black-hole gun's shell: a crackling orb of cold mint, unlike any laser in the battle, that flies with a heavy
 * trailing bolt and bursts in a blinding flash where it lands. Sizes are in world units and energies in multiples
 * of white.
 */
export const SHELL = {
  color: linear('#7ff0cf'),
  radius: 0.45,
  energy: 7,
  trail: { width: 0.34, length: 7, energy: 6 },
  flash: { color: linear('#eafff6'), radius: 2.2, energy: 10, life: 0.7 },
};

/**
 * The giant explosion: a capital ship going up, `radius` units across its fireball at its fullest. It flashes
 * blinding white, `flash` across and burning `flash.energy` times white, and its fireball billows out, cooling from
 * white through marigold and ember to ash, with a shockwave racing ahead of it as a thin ring. `shrapnel` streaks fly
 * out of it, and `debris` burning fragments tumble away with whatever it flings, some faster and some slower. Its
 * fire lights everything round it, `light.intensity` times at its hottest, cooling as it does. What is left glows on
 * for `life` seconds as a smoky remnant, violet where it thins and dusky mauve where it gathers, fading over the last
 * `fade` of them.
 */
export const BLAST = {
  radius: 75,
  life: 90,
  fade: 20,
  flash: { radius: 110, energy: 30, life: 1.4 },
  light: { color: '#ff9a4a', intensity: 9 },
  debris: {
    count: 48,
    speed: [0.45, 1.55] as Range,
    spread: 3,
    reach: 14,
    radius: [0.05, 0.22] as Range,
    energy: [2, 5] as Range,
    life: [18, 30] as Range,
  },
  shrapnel: {
    count: 70,
    speed: [120, 320] as Range,
    length: [20, 70] as Range,
    width: [0.8, 2.2] as Range,
    energy: [3, 6] as Range,
    life: [0.8, 2.8] as Range,
  },
  colors: {
    core: linear('#fff6e0'),
    fire: linear('#ffb02a'),
    ember: linear('#ff4f1a'),
    ash: linear('#3a1a22'),
    ring: linear('#ffe8c0'),
    teal: linear('#3a2450'),
    ochre: linear('#6a2e4c'),
  },
};
