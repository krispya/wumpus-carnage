/** A black hole's shadow is about this many times as wide as its horizon, since light passing near enough falls in. */
export const SHADOW = 2.6;

/**
 * The axis the hole spins about. It has nothing round it to show the spin, but it drags space round with it, and
 * curls whatever falls in.
 */
export const SPIN_AXIS = [0.1, -1, -0.2] as const;

/**
 * The render layer of what stands in front of the hole rather than in its bent light: the wumpus. The hole's light is
 * traced through a backdrop drawn without it, so nothing it hides is lost, and it is drawn back over the top.
 */
export const FOREGROUND = 1;

/**
 * How light is traced past the hole: rays that pass within `reach` horizon radii are followed step by step, taking
 * no more than `steps` steps, and the rest are bent whole. Once one escapes, it is followed out through the frame's
 * depth in `depths` steps to find what it meets. What lies less than `beside[0]` world units past the hole keeps its
 * place in the frame and falls into the hole in its own light, and what lies more than `beside[1]` past it is seen
 * only where its bent light lands. Light that turns back out within `skim` horizon radii of the photon sphere has
 * circled the hole and is let fade. Space round the hole is dragged round with its spin, `swirl` radians a second at
 * full pull, `drag` times that for light passing its horizon and less and less further out, so what lies past it
 * winds round into it like sand into a pit. What lies `dragDepth` world units or more past the hole is dragged
 * fully. A ray that leaves the frame shows what the frame shows at its edge if it was bent less than `leaving[0]`
 * radians, and the sky if more than `leaving[1]`.
 * Light climbing out from near the horizon reddens and dims, and is gone by `redshift[0]` horizon radii and clear by
 * `redshift[1]`. Light a falling camera races into is brightened, by at most `boost` times. The
 * backdrop covers at least `backdropAspect` horizontally, so bent rays can still find the scene
 * beyond a narrow visible frame.
 */
export const LENS = {
  backdropAspect: 1.5,
  reach: 16,
  steps: 120,
  depths: 14,
  beside: [5, 9] as const,
  skim: 0.7,
  swirl: 0.45,
  drag: 7.8,
  dragDepth: 12,
  leaving: [0.1, 0.3] as const,
  redshift: [1, 1.7] as const,
  boost: 5,
};

/**
 * The hole's life, in seconds and world units. It tears open out of nothing over `open` as a pinprick, its shadow
 * `pinprick` wide, so small it could be a trick of the eye but for the way space warps round it. Then it grows, at
 * first so slowly it seems not to and then faster and faster, evenly in scale, reaching `full` after `grow` seconds
 * and still growing after at `beyond` of that pace, until it is everything. Its pull warms up over `warm`. It
 * breathes a little, and it gulps what it swallows in one slow swell, `swell` past its size, settling over `gulp`
 * seconds, after which it is still.
 */
export const HOLE = {
  open: 0.3,
  pinprick: 0.8,
  full: 40,
  grow: 7,
  beyond: 0.05,
  warm: 1.6,
  breath: 0.03,
  gulp: 1.4,
  swell: 0.06,
};

/**
 * A capture, in seconds and world units. Once caught there is no getting away: whatever way the wumpus was flying,
 * the pull brakes it to a stop over about `brake` seconds, and over `duration` seconds it falls straight in, its
 * height above where it hangs closing as `e` to the minus `hang` times the `fall` power of the share of the time
 * gone: barely moving at first, then faster and faster, and then, seen from outside, slower again as it nears the
 * horizon, where time runs slow, until it hangs `edge` horizon radii above it, reddening, sinking in only at the
 * last. It spins `spinUp` times faster as it goes. The tide takes hold of it within `tide.reach` horizon radii,
 * gently at first and then harder, stretching it about its middle up to `tide.most` at the horizon, wringing it
 * `tide.wring` radians a unit from its middle, its ends turning opposite ways, and bending its near end `tide.curl`
 * radians round the hole ahead of its middle.
 */
export const CAPTURE = {
  duration: 12,
  brake: 1.3,
  fall: 4,
  hang: 5.8,
  edge: 0.35,
  spinUp: 1.6,
  tide: { reach: 5, most: 1.8, curl: 0.45, wring: 1.2 },
};

/**
 * Doom. Dread rises as the hole grows and climbs toward its worst as the hole draws the wumpus in, and the whole
 * scene answers it: the hole throbs like a heartbeat, from `calm` beats a second to `frantic`, each throb swelling
 * it by `throb`. The frame drains of colour and closes in. `ease` is how quickly dread follows what is happening,
 * per second.
 */
export const DOOM = { calm: 0.7, frantic: 2.3, throb: 0.05, ease: 1.5 };
