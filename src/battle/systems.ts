import type { Entity, World } from 'koota';
import type { InstancedBufferAttribute } from 'three/webgpu';
import { clamp, vec3, type Vec3 } from 'math';
import { mulberry32 } from 'math/random';
import { Framing } from '../director/traits';
import { Time } from '../time/traits';
import { frameAt } from '../viewport/content';
import { sequenceActions } from '../sequence/actions';
import { Viewport } from '../viewport/traits';
import { battleActions, type Shot } from './actions';
import {
  BLAST,
  BLAST_CAPACITY,
  BOLT_CAPACITY,
  BOLT_COLORS,
  CLOSE,
  FAR,
  FLARE_CAPACITY,
  FLARE_COLORS,
  FLARES,
  type FlareStyle,
  NEAR,
  SHELL,
  type ShotStyle,
  VAST,
  VAST_FLARES,
} from './content';
import { Battle, BattleView, Blast, Bolt, Flare, Shell } from './traits';
import { plasmaUniforms } from './plasma';
import { openingBattleFrame, orientBattle, placeBattle, type BattleFrame } from './framing';

type Draw = () => number;
type Range = readonly [number, number];

const between = (draw: Draw, [low, high]: Range) => low + (high - low) * draw();

function pick<T extends { weight: number }>(draw: Draw, options: readonly T[]): T {
  let roll = draw() * options.reduce((sum, option) => sum + option.weight, 0);

  for (const option of options) if ((roll -= option.weight) < 0) return option;

  return options[options.length - 1]!;
}

const aside = vec3.create();
const offset = vec3.create();
const forward = vec3.fromValues(0, 0, 1);

/**
 * Aim and fire one shot of a style, or a volley of them: a random depth, a random heading across the frame that
 * tips a little toward or away from the camera, and a path centred somewhere in the frame. A shot that impacts
 * ends its path inside the frame instead, where its flare can be seen.
 */
function fire(world: World, draw: Draw, style: ShotStyle, aspect: number, frame?: BattleFrame): void {
  const z = between(draw, style.depth);
  const [restWidth, restHeight] = frameAt(z, aspect);
  const halfHeight =
    frame === undefined ? restHeight : (frame.distance - z) * frame.halfHeightPerDistance;
  const halfWidth = halfHeight * aspect;
  const angle = draw() * Math.PI * 2;
  const heading = vec3.normalize(
    vec3.create(),
    vec3.fromValues(Math.cos(angle), Math.sin(angle), (draw() - 0.5) * 0.5)
  );
  const span = between(draw, style.span) * 2 * halfWidth;
  const beam = draw() < style.beam.chance;
  const impact = !beam && draw() < style.impact;
  const reach = impact ? 0.85 : style.reach;
  const target =
    style.miss === undefined
      ? vec3.fromValues(
          (draw() * 2 - 1) * reach * halfWidth,
          (draw() * 2 - 1) * reach * halfHeight,
          z
        )
      : passing(draw, heading, between(draw, style.miss));
  if (frame !== undefined) {
    placeBattle(target, target, frame);
    orientBattle(heading, heading, frame);
  }
  const from = vec3.scaleAndAdd(vec3.create(), target, heading, impact ? -span : -span / 2);
  // Keep traversal time stable as the opening's world-space footprint expands.
  const speed = (beam ? style.beam.speed : between(draw, style.bolt.speed)) * (halfWidth / restWidth);
  const length = beam ? span * 2 : between(draw, style.bolt.length);
  const shot: Shot = {
    from,
    heading,
    span,
    speed,
    length,
    width: between(draw, style.bolt.width),
    energy: between(draw, style.bolt.energy),
    color: vec3.fromValues(...pick(draw, BOLT_COLORS).color),
    delay: 0,
    life: beam ? between(draw, style.beam.life) : (span + length) / speed,
    beam,
    impact,
  };
  const volley = draw() < style.volley.chance ? Math.round(between(draw, style.volley.count)) : 1;
  const spacing = between(draw, style.volley.spacing);

  vec3.normalize(aside, vec3.cross(aside, heading, frame?.back ?? forward));

  for (let index = 0; index < volley; index++) {
    vec3.scale(offset, aside, (index - (volley - 1) / 2) * spacing);
    battleActions(world).fireBolt({
      ...shot,
      from: vec3.add(vec3.create(), from, offset),
      delay: index * between(draw, style.volley.stagger),
      impact: impact && index === 0,
    });
  }
}

/** A point `miss` units from the frame's focus, off to a random side of a path along `heading`. */
function passing(draw: Draw, heading: Vec3, miss: number): Vec3 {
  const side = vec3.fromValues(draw() - 0.5, draw() - 0.5, (draw() - 0.5) * 0.4);
  vec3.scaleAndAdd(side, side, heading, -vec3.dot(side, heading));

  return vec3.scale(side, vec3.normalize(side, side), miss);
}

/** Burst a flare of a style somewhere in the frame. */
function burst(
  world: World,
  draw: Draw,
  style: FlareStyle,
  aspect: number,
  frame?: BattleFrame
): void {
  const z = between(draw, style.depth);
  const [, restHeight] = frameAt(z, aspect);
  const halfHeight =
    frame === undefined ? restHeight : (frame.distance - z) * frame.halfHeightPerDistance;
  const position = vec3.fromValues(
    (draw() * 2 - 1) * halfHeight * aspect,
    (draw() * 2 - 1) * halfHeight,
    z
  );
  if (frame !== undefined) placeBattle(position, position, frame);
  const color = vec3.fromValues(...pick(draw, FLARE_COLORS).color);

  battleActions(world).burstFlare(
    position,
    color,
    between(draw, style.radius),
    between(draw, style.energy),
    between(draw, style.life)
  );
}

/** Fire whatever shots and flares have come due, each on its own clock that the battle's heat runs faster. */
export function wageBattle(world: World): void {
  const battle = world.get(Battle);

  if (battle === undefined) return;

  const { delta } = world.get(Time)!;
  const { aspect } = world.get(Viewport)!;
  const frame = world.get(Framing)?.shot === 'system' ? openingBattleFrame(aspect) : undefined;
  const draw = () => mulberry32.sample(battle.random);
  const step = delta * battle.heat;

  for (battle.far -= step; battle.far <= 0; battle.far += between(draw, FAR.interval)) {
    fire(world, draw, FAR, aspect, frame);
  }

  for (battle.near -= step; battle.near <= 0; battle.near += between(draw, NEAR.interval)) {
    fire(world, draw, NEAR, aspect);
  }

  for (battle.close -= step; battle.close <= 0; battle.close += between(draw, CLOSE.interval)) {
    fire(world, draw, CLOSE, aspect);
  }

  for (battle.flare -= step; battle.flare <= 0; battle.flare += between(draw, FLARES.interval)) {
    burst(world, draw, FLARES, aspect, frame);
  }

  for (battle.vast -= step; battle.vast <= 0; battle.vast += between(draw, VAST.interval)) {
    fire(world, draw, VAST, aspect, frame);
  }

  for (
    battle.vastFlare -= step;
    battle.vastFlare <= 0;
    battle.vastFlare += between(draw, VAST_FLARES.interval)
  ) {
    burst(world, draw, VAST_FLARES, aspect, frame);
  }

  world.set(Battle, battle);
}

const spent: Entity[] = [];
const end = vec3.create();

/** Fly each shot along its path. A shot that impacts bursts where its path ends. The rest fade out. */
export function advanceBolts(world: World): void {
  const { delta } = world.get(Time)!;

  world.query(Bolt).updateEach(([bolt], entity) => {
    bolt.age += delta;
    bolt.travelled += bolt.speed * delta;

    if (bolt.impact && bolt.travelled >= bolt.span) {
      vec3.scaleAndAdd(end, bolt.from, bolt.heading, bolt.span);
      battleActions(world).burstFlare(end, bolt.color, bolt.width * 4, bolt.energy, 0.9);
      spent.push(entity);
    } else if (bolt.age >= bolt.life) spent.push(entity);
  });

  for (const entity of spent) entity.destroy();

  spent.length = 0;
}

/** Fly each shell toward where it lands. There it bursts in a blinding flash, and the scene hears it has landed. */
export function flyShells(world: World): void {
  const { delta } = world.get(Time)!;

  world.query(Shell).updateEach(([shell], entity) => {
    shell.age += delta;
    vec3.lerp(shell.position, shell.from, shell.to, Math.min(shell.age / shell.flight, 1));

    if (shell.age >= shell.flight) spent.push(entity);
  });

  for (const entity of spent) {
    const { to } = entity.get(Shell)!;
    const { color, radius, energy, life } = SHELL.flash;
    battleActions(world).burstFlare(to, vec3.fromValues(...color), radius, energy, life);
    entity.destroy();
    sequenceActions(world).triggerSequence('shell-landed');
  }

  spent.length = 0;
}

/** Burn each flare down and drift it along, removing it once it is out. */
export function ageFlares(world: World): void {
  const { delta } = world.get(Time)!;

  world.query(Flare).updateEach(([flare], entity) => {
    flare.age += delta;
    vec3.scaleAndAdd(flare.position, flare.position, flare.velocity, delta);

    if (flare.age >= flare.life) spent.push(entity);
  });

  for (const entity of spent) entity.destroy();

  spent.length = 0;
}

/** Age each blast, removing it once even its remnant has faded. */
export function ageBlasts(world: World): void {
  const { delta } = world.get(Time)!;

  world.query(Blast).updateEach(([blast], entity) => {
    blast.age += delta;

    if (blast.age >= BLAST.life) spent.push(entity);
  });

  for (const entity of spent) entity.destroy();

  spent.length = 0;
}

/** How lit a shot is at `age` into its life: up almost at once, then fading through the end of its life. */
function lit(age: number, life: number): number {
  if (age <= 0) return 0;

  return Math.min(age / 0.03, 1) * clamp((life - age) / (life * 0.3), 0, 1);
}

const point = vec3.create();

function write(
  array: ArrayLike<number> & { [index: number]: number },
  index: number,
  values: Vec3
): void {
  array[index * 3] = values[0];
  array[index * 3 + 1] = values[1];
  array[index * 3 + 2] = values[2];
}

/** Upload only the instances drawn this frame, replacing any range left by a skipped pass. */
function upload(attribute: InstancedBufferAttribute, count: number): void {
  attribute.clearUpdateRanges();

  if (count === 0) return;

  attribute.addUpdateRange(0, count * attribute.itemSize);
  attribute.needsUpdate = true;
}

/** Write each lit shot's stretch and each flare into the view's instance buffers. */
export function syncBattleView(world: World): void {
  const view = world.get(BattleView);

  if (view === undefined) return;

  const starts = view.boltStart.array as Float32Array;
  const ends = view.boltEnd.array as Float32Array;
  const shapes = view.boltShape.array as Float32Array;
  const colors = view.boltColor.array as Float32Array;
  let bolts = 0;

  world.query(Bolt).readEach(([bolt]) => {
    const head = clamp(bolt.travelled, 0, bolt.span);
    const tail = clamp(bolt.travelled - bolt.length, 0, bolt.span);
    const energy = bolt.energy * lit(bolt.age, bolt.life);

    if (bolts === BOLT_CAPACITY || head <= tail || energy <= 0) return;

    write(starts, bolts, vec3.scaleAndAdd(point, bolt.from, bolt.heading, tail));
    write(ends, bolts, vec3.scaleAndAdd(point, bolt.from, bolt.heading, head));
    write(colors, bolts, bolt.color);
    shapes[bolts * 3] = bolt.width;
    shapes[bolts * 3 + 1] = energy;
    // A streaking bolt's tail is dimmer than its head. A beam is lit evenly.
    shapes[bolts * 3 + 2] = bolt.beam ? 1 : 0.08;
    bolts++;
  });

  const centres = view.flareCentre.array as Float32Array;
  const glows = view.flareColor.array as Float32Array;
  const flareShapes = view.flareShape.array as Float32Array;
  let flares = 0;

  world.query(Flare).readEach(([flare]) => {
    if (flares === FLARE_CAPACITY) return;

    // A flare flashes up at once, swells a little as it burns, and dies away.
    const burn = flare.age / flare.life;
    const flash = Math.min(flare.age / 0.06, 1) * (1 - burn) ** 2;
    centres.set(flare.position, flares * 4);
    centres[flares * 4 + 3] = flare.radius * (0.7 + 0.3 * Math.sqrt(burn));
    glows.set(flare.color, flares * 4);
    glows[flares * 4 + 3] = flare.energy * flash;
    flareShapes[flares * 2] = flare.fragment ? flare.age * flare.spin + flare.radius * 47 : 0;
    flareShapes[flares * 2 + 1] = flare.fragment ? 1 : 0;
    flares++;
  });

  // Shells draw as flares too: a crackling orb, its size and brightness flickering.
  world.query(Shell).readEach(([shell]) => {
    if (flares === FLARE_CAPACITY) return;

    const crackle = 1 + 0.15 * Math.sin(shell.age * 45) + 0.1 * Math.sin(shell.age * 71);
    centres.set(shell.position, flares * 4);
    centres[flares * 4 + 3] = SHELL.radius * crackle;
    glows.set(SHELL.color, flares * 4);
    glows[flares * 4 + 3] = SHELL.energy * crackle;
    flareShapes[flares * 2] = 0;
    flareShapes[flares * 2 + 1] = 0;
    flares++;
  });

  const blastCentres = view.blastCentre.array as Float32Array;
  const blastStates = view.blastState.array as Float32Array;
  let blasts = 0;
  plasmaUniforms.centre.value.w = 0;

  let light = 0;

  world.query(Blast).readEach(([blast]) => {
    if (blasts === BLAST_CAPACITY) return;

    // Its fire lights everything round it, fading as it cools.
    view.glow.position.fromArray(blast.position);
    light = Math.max(light, BLAST.light.intensity * Math.exp(-blast.age * 0.12));

    blastCentres.set(blast.position, blasts * 4);
    blastCentres[blasts * 4 + 3] = BLAST.radius;
    blastStates[blasts * 3] = blast.age;
    blastStates[blasts * 3 + 1] = blast.seed;
    blastStates[blasts * 3 + 2] = clamp((BLAST.life - blast.age) / BLAST.fade, 0, 1);
    if (blasts === 0) {
      plasmaUniforms.centre.value.set(...blast.position, BLAST.radius);
      plasmaUniforms.state.value.set(blast.age, blast.seed, blastStates[2]!);
    }
    blasts++;
  });

  view.glow.intensity = light;
  view.bolts.count = bolts;
  view.flares.count = flares;
  view.blasts.count = blasts;
  upload(view.blastCentre, blasts);
  upload(view.blastState, blasts);

  for (const attribute of [view.boltStart, view.boltEnd, view.boltShape, view.boltColor]) {
    upload(attribute, bolts);
  }

  upload(view.flareCentre, flares);
  upload(view.flareColor, flares);
  upload(view.flareShape, flares);
}
