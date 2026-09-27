import {
  asin,
  atan,
  clamp,
  cos,
  dot,
  float,
  mx_fractal_noise_float,
  rtt,
  sin,
  smoothstep,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { RepeatWrapping, type Node } from 'three/webgpu';
import { NEBULA } from './content';

/** Static cloud fields in world directions, independent of the camera and animation clock. */
function fieldsAt(direction: Node<'vec3'>): Node<'vec4'> {
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

// Longitude repeats across the seam. The fixed map is shared by the sky and escaped lensing rays.
const longitude = uv()
  .x.sub(0.5)
  .mul(Math.PI * 2);
const latitude = uv().y.sub(0.5).mul(Math.PI);
const direction = vec3(
  cos(latitude).mul(sin(longitude)),
  sin(latitude),
  cos(latitude).mul(cos(longitude))
);
const fields = rtt(fieldsAt(direction), 1024, 512, { autoUpdate: false, depthBuffer: false });
fields.name = 'nebula-fields';
fields.value.wrapS = RepeatWrapping;

/** Sample the cloud fields baked once at startup, leaving stars sharp at the current screen resolution. */
export function nebulaAt(direction: Node<'vec3'>): Node<'vec4'> {
  const at = vec2(
    atan(direction.x, direction.z)
      .div(Math.PI * 2)
      .add(0.5),
    asin(clamp(direction.y, -1, 1))
      .div(Math.PI)
      .add(0.5)
  );

  return fields.sample(at).level(float(0));
}
