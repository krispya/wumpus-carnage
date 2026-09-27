/** How tall the wumpus stands, in world units, from its feet to the tip of its leaf. */
export const WUMPUS_HEIGHT = 3.4;

/**
 * Adrift in zero g. The wumpus sets off a little left of centre, already coasting, and a slack tether toward the
 * middle of the frame bends its path into slow loops rather than letting it leave. Its angular momentum, which
 * nothing changes, is tipped off the axis through its face, so it rolls over about once every fifty seconds and
 * wobbles as it goes. Its inertia follows its shape: easiest to turn about its width and height, hardest about
 * the axis through its face.
 */
export const WUMPUS_FLOAT = {
  start: [-0.35, 0.2, 0] as const,
  velocity: [0.07, -0.05, 0.05] as const,
  stiffness: [0.018, 0.026, 0.012] as const,
  inertia: [0.62, 0.66, 1] as const,
  momentum: [0.02, 0.035, 0.125] as const,
};

/** The model's node holding the body's meshes, which the rig splits into jointed parts. */
export const BODY_NODE = 'wumpus_2';

/** The wumpus's joints. Every piece of the model hangs from one of them. Parents come before their children. */
export const JOINTS = [
  'torso',
  'head',
  'leftEye',
  'rightEye',
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg',
] as const;
export type Joint = (typeof JOINTS)[number];

/** The joints that ride on another. The rest hang from the body. */
export const JOINT_PARENTS: Partial<Record<Joint, Joint>> = { leftEye: 'head', rightEye: 'head' };

/**
 * Where each joint turns, in the body node's units. The model faces its own -z, so its left is toward -x of the
 * midline. Shoulders sit at the top inner end of each arm and hips at the top of each leg, where the limb already
 * overlaps the torso, so turning it opens no gap. The neck sits inside the torso's top, and the torso turns about
 * its middle. Each eye closes about a point below its middle, so its top comes down further than its bottom comes
 * up, like a lid.
 */
export const MIDLINE = -0.385;
export const PIVOTS: Record<Joint, readonly [number, number, number]> = {
  torso: [-0.37, 1.06, 0.13],
  head: [-0.39, 1.6, 0.05],
  leftEye: [-1.385, 2.28, -0.975],
  rightEye: [0.53, 2.28, -0.975],
  leftArm: [-0.92, 1.17, 0.1],
  rightArm: [0.16, 1.17, 0.11],
  leftLeg: [-0.6, 0.33, 0.15],
  rightLeg: [-0.16, 0.33, 0.15],
};

/** Which joint a piece of the model hangs from, by where its middle is. */
export function jointAt(x: number, y: number, z: number): Joint {
  for (const eye of ['leftEye', 'rightEye'] as const) {
    const [ex, ey, ez] = PIVOTS[eye];

    if (Math.hypot(x - ex, y - ey, z - ez) < 0.2) return eye;
  }

  if (y > 1.5) return 'head';
  if (y < 0.45) return x < MIDLINE ? 'leftLeg' : 'rightLeg';
  if (Math.abs(x - MIDLINE) > 0.4) return x < MIDLINE ? 'leftArm' : 'rightArm';

  return 'torso';
}

/** The model's eye mesh, which gets a wet, glossy finish. */
export const EYE_MESH = 'Object_6';

/**
 * A blink, timed like an animator's: a snappy close that speeds into the shut, a beat held shut, and a slower open
 * that eases out. Times are in seconds. Shut, an eye squashes to a sliver and spreads a little wider. Blinks come
 * at random intervals, sometimes twice in quick succession, and also whenever the head turns sharply to look
 * somewhere new, since a glance is where a blink reads most naturally. The head dips a touch with each one.
 */
export const BLINK = {
  close: 0.06,
  hold: 0.04,
  open: 0.15,
  shut: 0.9,
  spread: 0.08,
  interval: [1.8, 5.5] as const,
  double: 0.2,
  doubleGap: 0.08,
  /** Head turning speed, in radians per second, that sparks a blink, and the rest a blink needs after the last. */
  glance: 0.08,
  rest: 1.4,
  nod: 0.03,
  seed: 5,
};

/** How far the neck rides above the torso's middle, so the head lifts as the torso breathes in. */
export const TORSO_REACH = 0.54;

/**
 * The float, as a performance: the rest of the posture a body settles into without gravity, and how far and how
 * slowly each part wanders from it. Angles are in radians and rates in cycles per second. Arms drift up from
 * their hang and a little forward, legs bend and paddle out of step, and the head glances about. No two parts
 * share a rate, so the body never moves in lockstep or mirrors itself.
 */
export const FLOAT_PERFORMANCE = {
  seed: 11,
  arms: { lift: 0.5, reach: 0.25, wave: 0.28, waveRate: 0.1, swing: 0.3, swingRate: 0.065 },
  legs: { bend: 0.2, kick: 0.32, kickRate: 0.16, splay: 0.12, splayWave: 0.06 },
  head: { turn: 0.35, nod: 0.12, tilt: 0.12, glanceRate: 0.08, tiltRate: 0.06 },
  breath: { depth: 0.03, rate: 0.25 },
};

/** The leaf's mesh in the model. It lies along its local x, stem at the low end, and spreads across its z. */
export const LEAF_MESH = 'Object_10';

/**
 * The leaf's shape and colour, in its own units. The blade opens past the stem at `base` and narrows to `tip`. It
 * is a living green, a little softened for a hand-painted frame: deepest toward the margin, bright along the veins,
 * paler underneath, and glowing a warm yellow-green where light comes through it, `through` as strongly as the light
 * behind it. However hard it is lit it is never brighter than `brightest` of white, so it glows without blooming.
 */
export const LEAF = {
  /** The end of the stem, where the leaf hinges on the head. */
  stem: [-1.5, 0.19, -0.035] as const,
  base: -1.3,
  tip: 1.03,
  margin: 0.62,
  veinsPerUnit: 4,
  deep: '#2e6a22',
  blade: '#5aa636',
  vein: '#c2e27a',
  under: '#72ac4c',
  glow: '#8ed04c',
  through: 1,
  brightest: 0.85,
};

/**
 * How the model's own colours are softened for a hand-painted frame: its saturation and lightness scaled a little, so
 * its blurple stays a vivid blue against the indigo sky and the golden fire, and its blacks stay black.
 */
export const REPAINT = { saturation: 0.8, lightness: 0.95 };

/**
 * The leaf trails the head. It hinges at its stem with its tip lifted off the head a little, and each turn of
 * the head swings it the other way on a loose spring that overshoots before it settles, never further than its
 * reach. The axes are the leaf's own: a twist along its length, a swing side to side, and a lift of the tip.
 */
export const LEAF_SWAY = {
  rest: [0, 0, 0.03] as const,
  lag: [2, 3, 2] as const,
  reach: [0.12, 0.3, 0.16] as const,
  stiffness: 30,
  damping: 2.5,
};

/**
 * Terror, in the way an animator would stage it on a body with no face to speak of. At rest the wumpus cowers:
 * chin tucked, head sunk into its shoulders, arms up in front of its face, legs drawn up, trembling, panting, its
 * eyes wide and blinking too often, its head darting from one glance to the next. A shot that passes close makes it
 * glance toward the danger at once and flinch as it passes: its eyes squeeze shut, its body jolts on a spring that
 * overshoots, it cowers harder, and the blast knocks it aside. Then it slowly recovers, as far as it ever does. Angles are in radians and rates in cycles per second.
 */
export const FEAR = {
  /** How frightened it is at rest, from 0, calm, to 1, cowering. */
  level: 0.85,
  seed: 31,
  cower: {
    head: [-0.16, 0, 0] as const,
    duck: 1,
    rightArm: [1, 0.55, 0.1] as const,
    leftArm: [1, -0.55, -0.1] as const,
    rightLeg: [0.6, 0, 0.04] as const,
    leftLeg: [0.55, 0, -0.04] as const,
  },
  /** How far the head sinks into the shoulders, fully ducked, in the model's units. */
  duckDepth: 0.28,
  tremble: { rate: 11, amount: 0.02 },
  pant: { rate: 1.5, depth: 0.025 },
  /** How much wider terror opens the eyes, and how much more often it blinks. */
  wide: 0.22,
  blinkPace: 1.8,
  /**
   * Nervous glances: how long each is held, how far the head can turn and nod to one, how snappily it gets there,
   * how long it holds a glance toward danger, and how close a shot must pass, in world units, to draw one.
   */
  glance: {
    interval: [0.45, 1.6] as const,
    turn: 0.55,
    nod: 0.25,
    stiffness: 320,
    damping: 30,
    hold: 0.9,
    reach: 12,
  },
  /**
   * Flinching: how close a shot must pass to cause one, in world units; how quickly the fright fades, per second;
   * the fright past which the eyes squeeze shut; how hard the blast knocks the body aside, in units per second;
   * and the small fright of a distant flash.
   */
  flinch: { range: 6, decay: 1.4, squeeze: 0.3, shove: 4, flash: 0.15 },
  /**
   * Panic, once it is flung loose, at once, or once a hole has hold of it: how quickly it sets in then, in seconds;
   * the arms thrashing out and back at their own rates as though swimming away; the legs kicking out of step; the
   * head lifting out of the shoulders; and its eyes shrinking to pinpricks in terror.
   */
  panic: {
    onset: 0.4,
    arms: { reach: 0.4, swing: 0.9, lift: 0.9, flap: 0.7, rates: [3.1, 2.6, 2.9, 2.4] as const },
    legs: { bend: 0.3, kick: 0.7, rate: 3.6 },
    duck: 0.2,
    wide: -0.7,
  },
  /** The recoil's spring, how hard a flinch kicks it, and how far it throws the head back, ducks it, lifts the arms, and squashes the torso. */
  jolt: { stiffness: 160, damping: 8, kick: 8, head: 0.25, duck: 0.6, arms: 0.35, squash: 0.06 },
};
