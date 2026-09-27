import { createActions } from 'koota';
import { vec3, type Vec3 } from 'math';
import { mulberry32 } from 'math/random';
import { BLAST, CLOSE, FAR, FLARES, NEAR, SHELL } from './content';
import { Battle, BattleView, Blast, Bolt, Flare, Shell, type BattleDraw } from './traits';

export interface Shot {
  from: Vec3;
  heading: Vec3;
  span: number;
  speed: number;
  length: number;
  width: number;
  energy: number;
  color: Vec3;
  /** Seconds before it fires, and seconds it lives once fired. */
  delay: number;
  life: number;
  beam: boolean;
  impact: boolean;
}

export const battleActions = createActions((world) => ({
  initializeBattle: () => {
    world.add(
      Battle({
        random: mulberry32.create(23),
        far: FAR.interval[0],
        near: NEAR.interval[0],
        close: CLOSE.interval[0],
        flare: FLARES.interval[0],
      })
    );
  },
  /** Fire one shot. A delayed shot waits behind its start, so it enters its path on time. */
  fireBolt: (shot: Shot) => {
    world.spawn(
      Bolt({
        from: vec3.clone(shot.from),
        heading: vec3.clone(shot.heading),
        span: shot.span,
        travelled: -shot.delay * shot.speed,
        speed: shot.speed,
        length: shot.length,
        width: shot.width,
        energy: shot.energy,
        color: vec3.clone(shot.color),
        age: -shot.delay,
        life: shot.life,
        beam: shot.beam,
        impact: shot.impact,
      })
    );
  },
  /** Fire the black-hole gun: its shell flies from `from` to `to` over `flight` seconds, trailing a heavy bolt. */
  fireShell: (from: Vec3, to: Vec3, flight: number) => {
    const heading = vec3.subtract(vec3.create(), to, from);
    const span = vec3.length(heading);
    const speed = span / flight;
    vec3.scale(heading, heading, 1 / span);
    world.spawn(
      Shell({ from: vec3.clone(from), to: vec3.clone(to), position: vec3.clone(from), flight })
    );
    world.spawn(
      Bolt({
        from: vec3.clone(from),
        heading,
        span,
        speed,
        length: SHELL.trail.length,
        width: SHELL.trail.width,
        energy: SHELL.trail.energy,
        color: vec3.fromValues(...SHELL.color),
        life: flight + SHELL.trail.length / speed,
      })
    );
  },
  clearShells: () => {
    world.query(Shell).forEach((entity) => entity.destroy());
  },
  /**
   * A capital ship goes up at `at`: a blinding flash, a fireball that billows out and cools, and shrapnel streaking
   * away from it in every direction.
   */
  detonate: (at: Vec3) => {
    const battle = world.get(Battle)!;
    const draw = () => mulberry32.sample(battle.random);
    const between = ([low, high]: readonly [number, number]) => low + (high - low) * draw();
    const position = vec3.clone(at);
    const { shrapnel, flash, colors } = BLAST;
    world.spawn(Blast({ position: vec3.clone(position), seed: draw() * 100 }));
    world.spawn(
      Flare({
        position: vec3.clone(position),
        color: vec3.fromValues(...colors.core),
        radius: flash.radius,
        energy: flash.energy,
        life: flash.life,
      })
    );

    for (let index = 0; index < shrapnel.count; index++) {
      const heading = vec3.normalize(
        vec3.create(),
        vec3.fromValues(draw() * 2 - 1, draw() * 2 - 1, draw() * 2 - 1)
      );
      const speed = between(shrapnel.speed);
      const life = between(shrapnel.life);
      const length = between(shrapnel.length);
      world.spawn(
        Bolt({
          from: vec3.scaleAndAdd(vec3.create(), position, heading, BLAST.radius * 0.1),
          heading,
          span: speed * life,
          speed,
          length,
          width: between(shrapnel.width),
          energy: between(shrapnel.energy),
          color: vec3.fromValues(...(draw() < 0.6 ? colors.fire : colors.ember)),
          life: life + length / speed,
        })
      );
    }
  },
  /**
   * Burning fragments of the blast tumble away round `at` with something it has flung along `velocity`: scattered
   * about it, and flying some faster and some slower, so they stream past it.
   */
  scatterDebris: (at: Vec3, velocity: Vec3) => {
    const battle = world.get(Battle)!;
    const draw = () => mulberry32.sample(battle.random);
    const between = ([low, high]: readonly [number, number]) => low + (high - low) * draw();
    const { debris, colors } = BLAST;
    const around = () => vec3.fromValues(draw() * 2 - 1, draw() * 2 - 1, draw() * 2 - 1);

    for (let index = 0; index < debris.count; index++) {
      const drift = vec3.scale(vec3.create(), velocity, between(debris.speed));
      vec3.scaleAndAdd(drift, drift, around(), debris.spread);
      world.spawn(
        Flare({
          position: vec3.scaleAndAdd(vec3.create(), at, around(), debris.reach),
          velocity: drift,
          fragment: true,
          spin: between([-4, 4]),
          color: vec3.fromValues(...(draw() < 0.5 ? colors.fire : colors.ember)),
          radius: between(debris.radius),
          energy: between(debris.energy),
          life: between(debris.life),
        })
      );
    }
  },
  clearBlasts: () => {
    world.query(Blast).forEach((entity) => entity.destroy());
    world.query(Flare).forEach((entity) => entity.destroy());
  },
  burstFlare: (position: Vec3, color: Vec3, radius: number, energy: number, life: number) => {
    world.spawn(
      Flare({ position: vec3.clone(position), color: vec3.clone(color), radius, energy, life })
    );
  },
  /** Some time later: every shot and flare in the air is gone, and the battle runs at `heat`. */
  quietBattle: (heat: number) => {
    world.query(Bolt).forEach((entity) => entity.destroy());
    world.query(Flare).forEach((entity) => entity.destroy());
    world.set(Battle, { ...world.get(Battle)!, heat });
  },
  /** How hot the battle runs, as a multiple of every firing rate. */
  setBattleHeat: (heat: number) => {
    world.set(Battle, { ...world.get(Battle)!, heat });
  },
  mountBattleView: (view: BattleDraw) => {
    world.add(BattleView(view));
  },
  unmountBattleView: () => {
    world.remove(BattleView);
  },
}));
