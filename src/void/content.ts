/**
 * The space everything floats in: an indigo so deep it reads as black, flat to the edges, as in a hand-painted frame.
 */
export const SKY = '#0e0a2c';

/**
 * A band of smoky cloud across the sky, a deep indigo where it is thin and cobalt blue where it gathers. Its lower
 * edge follows a great circle tipped to rise to the right, so it crosses the bottom of the wumpus's shots. Below the
 * edge sits dark dust, and above it the cloud is lit brightest right along the edge, thinning into wisps as it
 * rises. Heights are roughly radians above the edge.
 */
export const NEBULA = {
  /** The edge's great circle, as the normal of the plane it lies in, pointing to the side the cloud rises into. */
  normal: [-0.13, 1, -0.19] as const,
  thin: '#1e1c5e',
  thick: '#2a5aa6',
  strength: 0.7,
  /** How far the edge wanders, and the size of the wanders, in cycles per radian. */
  warp: 0.025,
  warpScale: 4,
  /** The size of the smoke's puffs, and of the stretches of band that glow brighter or fade, in cycles per radian. */
  smokeScale: 9,
  stretchScale: 2.5,
  /** How high the cloud rises above its edge, and how quickly its lit rim fades going up. */
  depth: 0.09,
  rim: 0.022,
  /** How much the dust dims the stars behind it. */
  shade: 0.6,
  /**
   * Round the band, a broad soft haze of the same cloud, billowing in puffs `scale` cycles per radian across, as bright
   * as `strength` of white where it gathers and fading over about `reach` radians above and below the edge.
   */
  haze: { strength: 0.42, scale: 1.8, reach: 0.4 },
};

/**
 * Stars, sparse, small, and mostly faint, like flecks of paint. Each layer scatters stars over a grid of cells on
 * the faces of a cube around the camera, `cells` to each half face, with at most one star to a cell, kept `margin`
 * in from its edges so none is ever cut off. Star sizes are in screen pixels, so they stay sharp at any resolution.
 * Brightness falls off sharply, so most stars are faint and a few shine. They are amber, cream, and periwinkle, the
 * amber ones gathering near the nebula.
 */
export const STARS = {
  margin: 0.2,
  /** How likely a star is to be warm or cream rather than blue, and how much likelier warm is near the nebula. */
  warm: 0.3,
  cream: 0.2,
  nebulaWarmth: 0.35,
  layers: [
    { cells: 90, density: 0.034, size: [0.6, 1.2], falloff: 2.5, dim: 0.3, halo: 0 },
    { cells: 24, density: 0.05, size: [1, 2], falloff: 1.5, dim: 0.55, halo: 0.12 },
  ],
  colors: { blue: '#8a9cff', pale: '#c8d0ff', cream: '#fff0d0', orange: '#ffb45a', ember: '#ff8a3c' },
};

/**
 * The system's star, far off, and the way its light comes from: a little above the dust and to the left, behind the
 * wumpus's camera, so the wumpus is lit from the front and the planet is lit on its near side. It is drawn as a small
 * disc burning `burn` times brighter than white, in a warm glow and a ring of blue, all seen as through an ND filter
 * that passes `filter` of its light, so the sliver holds its shape rather than burning out the frame.
 */
export const SUN = {
  direction: [-0.52, 0.36, 0.77] as const,
  radius: 0.011,
  burn: 40,
  filter: 0.3,
  color: '#fff6e6',
  glow: '#fff0cc',
  halo: '#4a74ff',
};

/**
 * A dark world crossing the star, `radius` radians across its middle, seen from its night side. It hides all of the
 * star but a sliver, `showing` of its width, burning round its edge at `angle` radians round from the star's right,
 * and the star's light catches in its air as a thin ring of fire, brightest nearest the sliver.
 */
export const ECLIPSE = {
  radius: 0.075,
  showing: 0.3,
  angle: 0.95,
  night: '#0a0818',
  bands: '#18143a',
  rim: '#ffe6b8',
  air: '#8fb8ff',
};

/**
 * Light beams fanning out from the sliver of the star through the dust, `count` streaks round, fading over `reach`
 * radians, shimmering slowly as the dust drifts `drift` a second, and cut into dark wedges where the dark world's
 * shadow falls across them. `strength` is how bright they burn at their root, in multiples of white. The nebula's
 * dust glows faintly, `glow` of white, with the star's light out to about `warmth` radians from it.
 */
export const BEAMS = {
  count: 34,
  reach: 0.26,
  drift: 0.04,
  strength: 0.32,
  color: '#f4ecd0',
  warmth: 0.5,
  glow: 0.22,
};
