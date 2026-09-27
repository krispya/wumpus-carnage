import {
  dot,
  floor,
  interleavedGradientNoise,
  mx_cell_noise_float,
  screenCoordinate,
  screenSize,
  screenUV,
  smoothstep,
  time,
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import { retained } from '../utils';

/** How far the curtain over the frame is closed, from 0, open, to 1, black. Kept across a hot module replacement. */
export const { uCurtain } = retained('post', () => ({ uCurtain: uniform(1) }));

/** The glow around anything brighter than white: lasers, flares, and the brightest stars. */
export const BLOOM = { strength: 0.9, radius: 0.5, threshold: 1 };

/** Darken gently toward the frame's corners, keeping the eye on the middle. Multiplies linear colour. */
export const vignette = smoothstep(
  0.35,
  1.05,
  screenUV
    .sub(0.5)
    .mul(vec2(screenSize.x.div(screenSize.y), 1))
    .length()
)
  .oneMinus()
  .mul(0.25)
  .add(0.75);

/**
 * How strong the film's grain is, in display steps either way at its strongest, and how many times a second it
 * changes.
 */
export const GRAIN = { strength: 0.035, rate: 24 };

/**
 * The grain of the film the animatic seems painted onto: fresh noise at each pixel on each of the film's frames,
 * strongest in the midtones and gone in pure black, so the hole stays absolute. Adds to display-encoded colour.
 */
export function grain(color: Node<'vec3'>): Node<'vec3'> {
  const noise = mx_cell_noise_float(vec3(screenCoordinate.xy, floor(time.mul(GRAIN.rate)))).sub(0.5);
  const luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));

  return vec3(noise.mul(GRAIN.strength).mul(smoothstep(0.01, 0.12, luminance)));
}

/**
 * Half a display step of noise either way. A gradient this dark spans only a handful of 8-bit values, and without
 * it they band into visible rings. Adds to display-encoded colour.
 */
export const dither = interleavedGradientNoise(screenCoordinate.xy).sub(0.5).div(255);
