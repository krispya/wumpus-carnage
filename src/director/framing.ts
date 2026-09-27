import { vec3, type Vec3 } from 'math';
import { WUMPUS_HEIGHT } from '../wumpus/content';

const back = vec3.create();
const right = vec3.create();
const up = vec3.create();

/** Pull back to fit a tumbling body, stretched along the tide, with room for its limbs and curl. */
export function frameWumpus(
  position: Vec3,
  centre: Vec3,
  axis: Vec3,
  stretch: number,
  aspect: number,
  fov: number,
  roll: number,
  weight: number
): void {
  vec3.subtract(back, position, centre);
  const distance = vec3.length(back);
  vec3.normalize(back, back);
  vec3.normalize(right, vec3.cross(right, [0, 1, 0], back));
  vec3.cross(up, back, right);

  // Project an enclosing ellipsoid onto the rolled camera axes without measuring the animated meshes.
  const horizontal = vec3.dot(axis, right);
  const vertical = vec3.dot(axis, up);
  const radius = WUMPUS_HEIGHT * 0.6;
  const extent = (along: number) =>
    radius * Math.sqrt(1 / stretch + (stretch * stretch - 1 / stretch) * along * along);
  const width = extent(horizontal * Math.cos(roll) + vertical * Math.sin(roll));
  const height = extent(vertical * Math.cos(roll) - horizontal * Math.sin(roll));
  const depth = extent(vec3.dot(axis, back));
  const halfHeight = Math.tan((fov * Math.PI) / 360);
  const fit = depth + Math.max(width / aspect, height) / (halfHeight * 0.8);

  vec3.scaleAndAdd(position, position, back, Math.max(fit - distance, 0) * weight);
}
