import type { Entity, World } from 'koota';
import { clamp, vec3 } from 'math';
import { easing } from 'math/time';
import { Vector3 } from 'three/webgpu';
import { sequenceActions } from '../sequence/actions';
import { Shot } from '../director/traits';
import { Time } from '../time/traits';
import { Transform } from '../transform/traits';
import { blackHoleActions } from './actions';
import { CAPTURE, DOOM, HOLE, LENS, SHADOW } from './content';
import { backdropCamera, holeUniforms } from './materials';
import { BlackHole, BlackHoleView, Captured, Dread, Swallowed } from './traits';

/** Fraction of the way from `from` to `to`, clamped. */
function ramp(t: number, from: number, to: number): number {
  return clamp((t - from) / (to - from), 0, 1);
}

/**
 * Measure how close doom feels. A growing hole brings a third of it; a capture brings the rest as the hole draws its
 * prey in, and holds it there once the prey is gone, until the hole is. Dread follows at its own pace, so the scene
 * sinks into it and climbs back out rather than jumping.
 */
export function measureDread(world: World): void {
  const { delta } = world.get(Time)!;
  const hole = world.queryFirst(BlackHole)?.get(BlackHole);
  const captured = world.queryFirst(Captured)?.get(Captured);
  const taken = world.queryFirst(Swallowed) !== undefined;
  const drawing =
    captured === undefined ? (taken ? 1 : 0) : Math.min(captured.age / CAPTURE.duration, 1);
  const target = hole === undefined ? 0 : 0.35 * Math.min(hole.presence, 1) + 0.65 * drawing;
  const dread = world.get(Dread)!;
  world.set(Dread, {
    level: dread.level + (target - dread.level) * (1 - Math.exp(-DOOM.ease * delta)),
  });
}

/** A heartbeat's shape through one beat: a hard throb and a softer one after it, then quiet. */
function heartbeat(phase: number): number {
  const lub = Math.max(Math.sin(phase), 0) ** 8;
  const dub = Math.max(Math.sin(phase - 0.9), 0) ** 8;

  return Math.min(lub + 0.55 * dub, 1);
}

/**
 * Age each hole and work out what the scene reads from it: it tears open as a pinprick and grows, slowly and then
 * faster and faster, without end; it warms its pull, throbs like a heartbeat that quickens with dread, drags space
 * round with it faster the harder it pulls and the nearer doom is, and gulps each meal, swelling past its size and
 * settling back.
 */
export function advanceHoles(world: World): void {
  const { delta } = world.get(Time)!;
  const dread = world.get(Dread)!.level;

  world.query(BlackHole).updateEach(([hole]) => {
    hole.age += delta;

    const rate = DOOM.calm + (DOOM.frantic - DOOM.calm) * dread;
    const pulse = hole.pulse + delta * rate * Math.PI * 2;

    if (Math.floor(pulse / (Math.PI * 2)) > Math.floor(hole.pulse / (Math.PI * 2))) hole.beats++;

    hole.pulse = pulse;
    hole.throb = heartbeat(pulse % (Math.PI * 2));

    const open = easing.cubicOut(ramp(hole.age, 0, HOLE.open));
    const warm = easing.sineInOut(ramp(hole.age, 0.2, HOLE.warm));
    // Once it has eaten it settles: one slow swell as it gulps its meal down, and its breath and heart go still.
    const fed = hole.age - hole.fedAt;
    const settled = Number.isFinite(fed) ? Math.min(fed / HOLE.gulp, 1) : 0;
    const swallowing = Number.isFinite(fed) ? fed / (HOLE.gulp / 4) : 0;
    const gulp = HOLE.swell * swallowing * Math.exp(1 - swallowing);
    const breath = 1 + HOLE.breath * Math.sin(hole.age * 2.3) * (1 - settled);

    // It grows evenly in scale, from a pinprick to full, slowly at first and then faster and faster, and on past
    // full at a gentler pace.
    const growing = hole.age / HOLE.grow;
    const grown = growing < 1 ? growing ** 1.4 : 1 + 1.4 * HOLE.beyond * (growing - 1);
    const size = HOLE.pinprick * (HOLE.full / HOLE.pinprick) ** grown;
    hole.horizon = size * open * breath * (1 + DOOM.throb * hole.throb * (1 - settled)) * (1 + gulp);
    hole.presence = Math.min(grown, 1);
    hole.pull = warm * (1 + gulp);
    hole.swirl += delta * LENS.swirl * hole.pull * (1 + 2 * dread);
  });
}

const swallowed: Entity[] = [];
const coasted = vec3.create();

/**
 * Draw each captured body in. Whatever way it was flying, it coasts on a little as the pull brakes it; then it falls
 * straight toward the horizon, barely moving at first, then faster and faster, then slowing to hang just outside it
 * and sinking in at the last, and the nearer it is the harder the tide stretches it. Once its time is up the hole
 * has swallowed it, and the scene hears so.
 */
export function drawIn(world: World): void {
  const { delta } = world.get(Time)!;
  const { duration, fall, hang, edge, tide, brake } = CAPTURE;
  const shadow = world.queryFirst(BlackHole)?.get(BlackHole)?.horizon ?? HOLE.full;
  const horizon = shadow / SHADOW;

  world.query(Captured, Transform).updateEach(([captured, transform], entity) => {
    captured.age += delta;

    const progress = Math.min(captured.age / duration, 1);
    vec3.scaleAndAdd(
      coasted,
      captured.from,
      captured.drift,
      brake * (1 - Math.exp(-captured.age / brake))
    );
    const from = vec3.length(coasted);
    const floor = horizon * (1 + edge * (1 - progress ** 6));
    const distance = floor + (from - floor) * Math.exp(-hang * progress ** fall);
    vec3.scaleAndAdd(transform.position, captured.centre, coasted, distance / Math.max(from, 1e-3));

    const reached = clamp((tide.reach - distance / horizon) / (tide.reach - 1), 0, 1);
    captured.tide = tide.most * reached ** 1.5;

    if (progress >= 1) {
      transform.scale = 0;
      swallowed.push(entity);
    }
  });

  for (const entity of swallowed) {
    blackHoleActions(world).swallowBody(entity);
    sequenceActions(world).triggerSequence('swallowed');
  }

  swallowed.length = 0;
}

const projected = new Vector3();
const centre = new Vector3();

/**
 * Publish the hole to the post pass that traces the frame through it, and to the tide: where it is, how wide its
 * horizon is and how far it has dragged space round, the camera the frame is shot through and whether it has fallen
 * past the horizon, and where the hole's shadow sits on screen and how wide it is there.
 */
export function syncBlackHoleView(world: World): void {
  const view = world.get(BlackHoleView);

  if (view === undefined) return;

  const { camera } = view;
  const uniforms = holeUniforms;

  // The backdrop is shot through the same camera, blind to the foreground.
  camera.updateMatrixWorld();
  backdropCamera.copy(camera, false);
  backdropCamera.layers.set(0);
  const found = world.queryFirst(BlackHole, Transform);
  uniforms.uDread.value = world.get(Dread)!.level;

  if (found === undefined) {
    uniforms.uHoleRadius.value = 0;
    uniforms.uInfall.value = 0;
    uniforms.uHoleLens.value = 0;
    uniforms.uInside.value = 0;
    uniforms.uTide.value = 0;

    return;
  }

  const hole = found.get(BlackHole)!;
  centre.fromArray(found.get(Transform)!.position);
  const radius = hole.horizon / SHADOW;
  uniforms.uHoleCentre.value.copy(centre);
  uniforms.uHoleRadius.value = radius;
  uniforms.uSwirl.value = hole.swirl;

  camera.updateMatrixWorld();
  const distance = camera.position.distanceTo(centre);
  uniforms.uCameraPosition.value.copy(camera.position);
  uniforms.uCameraWorld.value.copy(camera.matrixWorld);
  uniforms.uCameraProjectionInverse.value.copy(camera.projectionMatrixInverse);
  uniforms.uCameraViewProjection.value.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  uniforms.uCameraClip.value.set(camera.near, camera.far);
  uniforms.uInfall.value = world.get(Shot)?.speed ?? 0;
  uniforms.uInside.value = radius > 0 && distance < radius ? 1 : 0;

  projected.copy(centre).project(camera);
  uniforms.uHoleScreen.value.set(projected.x / 2, -projected.y / 2);
  const halfHeight = Math.tan((camera.fov * Math.PI) / 360);
  uniforms.uHoleLens.value = hole.horizon / (2 * Math.max(distance, 1e-3) * halfHeight);

  const captured = world.queryFirst(Captured, Transform);

  if (captured === undefined) {
    uniforms.uTide.value = 0;

    return;
  }

  const { centre: into, tide } = captured.get(Captured)!;
  uniforms.uTideHole.value.fromArray(into);
  uniforms.uTideCentre.value.fromArray(captured.get(Transform)!.position);
  uniforms.uTideHorizon.value = Math.max(hole.horizon, 0.05);
  uniforms.uTide.value = tide;
  uniforms.uTideCurl.value = CAPTURE.tide.curl;
  uniforms.uTideWring.value = CAPTURE.tide.wring;
}
