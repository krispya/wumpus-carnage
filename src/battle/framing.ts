import { vec3, type Vec3 } from 'math';
import { BLAST_AT, openingShot } from '../director/content';

export interface BattleFrame {
  centre: Vec3;
  right: Vec3;
  up: Vec3;
  back: Vec3;
  distance: number;
  halfHeightPerDistance: number;
}

let cached: { aspect: number; frame: BattleFrame } | undefined;

/** The portrait battle occupies a plane facing the opening camera at the blast's depth. */
export function openingBattleFrame(aspect: number): BattleFrame | undefined {
  if (aspect >= 1) return undefined;
  if (cached?.aspect === aspect) return cached.frame;

  const shot = openingShot(aspect);
  const back = vec3.normalize(
    vec3.create(),
    vec3.subtract(vec3.create(), shot.position, shot.target)
  );
  const right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), [0, 1, 0], back));
  const up = vec3.cross(vec3.create(), back, right);
  const distance = vec3.dot(vec3.subtract(vec3.create(), shot.position, BLAST_AT), back);
  const frame = {
    centre: vec3.scaleAndAdd(vec3.create(), shot.position, back, -distance),
    right,
    up,
    back,
    distance,
    halfHeightPerDistance: Math.tan((shot.fov * Math.PI) / 360),
  };
  cached = { aspect, frame };

  return frame;
}

/** Rotate a vector from the battle plane into world space. Supports writing over the input. */
export function orientBattle(out: Vec3, local: Vec3, frame: BattleFrame): Vec3 {
  const [x, y, z] = local;
  vec3.scale(out, frame.right, x);
  vec3.scaleAndAdd(out, out, frame.up, y);

  return vec3.scaleAndAdd(out, out, frame.back, z);
}

/** Spread the fighting across the middle of the frame, keeping the upper sky quiet. */
export function placeBattle(out: Vec3, local: Vec3, frame: BattleFrame): Vec3 {
  const [x, y, z] = local;
  vec3.set(out, x, y * 0.3 - (frame.distance - z) * frame.halfHeightPerDistance * 0.1, z);
  orientBattle(out, out, frame);

  return vec3.add(out, out, frame.centre);
}
