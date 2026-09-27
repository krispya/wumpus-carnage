/**
 * The camera the animatic is shot through, at its rest. The field of view is vertical, in degrees. It sees far
 * enough to take in the whole battle from well outside it.
 */
export const CAMERA = {
  fov: 35,
  near: 0.5,
  far: 2000,
  position: [0, 0, 16] as const,
};

/** Half the frame's height at a distance of one unit in front of the camera. */
export const HALF_HEIGHT_PER_DISTANCE = Math.tan((CAMERA.fov * Math.PI) / 360);

/** The frame's half width and half height at world depth `z`, for a frame of `aspect`. */
export function frameAt(z: number, aspect: number): [number, number] {
  const halfHeight = (CAMERA.position[2] - z) * HALF_HEIGHT_PER_DISTANCE;

  return [halfHeight * aspect, halfHeight];
}
