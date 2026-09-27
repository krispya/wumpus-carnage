import { dot, mx_fractal_noise_float, smoothstep, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { NEBULA } from './content';

/**
 * The nebula's cloud fields along `direction`, a unit vector in the world: its height above its edge, its smoke and
 * stretch, and the billow of its haze. They belong to directions alone, never to the camera or the clock, so they
 * are baked once.
 */
export function fieldsAt(direction: Node<'vec3'>): Node<'vec4'> {
  // The nebula. Its height above its edge is roughened by noise into cloud, lit most along the edge, and cut sharply
  // below it, where the dust begins.
  const [nx, ny, nz] = NEBULA.normal;
  const normalLength = Math.hypot(nx, ny, nz);
  const roughness = mx_fractal_noise_float(direction.mul(NEBULA.warpScale), 4, 2, 0.5);
  const height = dot(direction, vec3(nx / normalLength, ny / normalLength, nz / normalLength)).add(
    roughness.mul(NEBULA.warp)
  );
  const smoke = smoothstep(
    -0.4,
    0.5,
    mx_fractal_noise_float(direction.mul(NEBULA.smokeScale).add(roughness), 5, 2, 0.55)
  );
  const stretch = smoothstep(
    -0.6,
    0.3,
    mx_fractal_noise_float(direction.mul(NEBULA.stretchScale), 2)
  );
  const billow = mx_fractal_noise_float(
    direction.mul(NEBULA.haze.scale).add(roughness.mul(0.5)),
    4,
    2,
    0.5
  );
  return vec4(height, smoke, stretch, billow);
}
