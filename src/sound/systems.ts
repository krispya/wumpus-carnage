import { createAdded, type World } from 'koota';
import { clamp, lerp, vec3, type Vec3 } from 'math';
import { Bolt, Flare, Shell } from '../battle/traits';
import { CAPTURE } from '../black-hole/content';
import { BlackHole, Captured, Dread, Swallowed } from '../black-hole/traits';
import { INFALL } from '../director/content';
import { Framing, Shot } from '../director/traits';
import { Spin, Tether } from '../motion/traits';
import { Time } from '../time/traits';
import { Transform } from '../transform/traits';
import { Viewport } from '../viewport/traits';
import { Blinking, Fear } from '../wumpus/traits';
import { soundActions } from './actions';
import {
  CRUNCH,
  DISTANCE,
  DOOM_DRONE,
  CREAK,
  EXPLOSION,
  FREEZE,
  HEART,
  LAYERS,
  LEVELS,
  ORGAN,
  OWN,
  RISER,
  SWISH,
  TEAR,
  TONE,
  YELP_FRIGHT,
} from './content';
import { Sound, SoundView } from './traits';

const firedBolts = createAdded();
const firedShells = createAdded();
/** How quickly a cut layer fades out, in seconds: fast, but not so fast it clicks. */
const CUT_FADE = 0.02;
const burstFlares = createAdded();

/** A deterministic draw in [0, 1) from an index, so each shot keeps the pitch and take it was given. */
function jitter(index: number): number {
  const value = Math.sin(index * 12.9898 + 78.233) * 43_758.545_3;

  return value - Math.floor(value);
}

const ahead = vec3.create();
const right = vec3.create();
const offset = vec3.create();
const up = vec3.fromValues(0, 1, 0);
const middle = vec3.create();

/**
 * Where the camera hears a point from: how far off it is, and where it sits across the stereo field, from where it
 * falls across the frame, kept inside the speakers.
 */
function whereHeard(world: World, point: Vec3): { distance: number; pan: number } {
  const { position, target, fov } = world.get(Shot)!;
  const { aspect } = world.get(Viewport)!;
  vec3.normalize(ahead, vec3.subtract(ahead, target, position));
  vec3.normalize(right, vec3.cross(right, ahead, up));
  vec3.subtract(offset, point, position);
  const halfWidth = Math.max(vec3.dot(offset, ahead), 1) * Math.tan((fov * Math.PI) / 360) * aspect;

  return {
    distance: vec3.length(offset),
    pan: clamp(vec3.dot(offset, right) / halfWidth, -1, 1) * 0.85,
  };
}

/**
 * Listen to what the scene publishes, from wherever the camera is, and cue a sound for each change: every shot as it
 * fires, each bright flare, each blink, and each fright. A shot close to the camera cracks and rushes across the
 * stereo field from where it came to where it went; a distant one zings, or thumps if it is a beam, quieter, duller,
 * and deeper in the hall the further off it is, so the battle seen from far outside it is barely heard. Runs last in
 * the simulation, so everything this frame changed is heard.
 */
export function listenForSounds(world: World): void {
  const sound = world.get(Sound);

  if (sound === undefined) return;

  const cue = soundActions(world).cueSound;

  // An added entity may already be gone by the time it is heard, as a shot that burst on impact is.
  for (const entity of world.query(firedBolts(Bolt))) {
    const bolt = entity.get(Bolt);

    if (bolt === undefined) continue;

    const { distance, pan } = whereHeard(
      world,
      vec3.scaleAndAdd(middle, bolt.from, bolt.heading, bolt.span / 2)
    );
    const delay = Math.max(-bolt.age, 0);
    const variation = jitter(entity);

    if (distance < DISTANCE.near) {
      cue('flyby', {
        pan: whereHeard(world, bolt.from).pan,
        panTo: whereHeard(world, vec3.scaleAndAdd(middle, bolt.from, bolt.heading, bolt.span)).pan,
        rate: 0.9 + 0.2 * variation,
        gain: LEVELS.flyby,
        delay,
        space: 0.3,
      });
      continue;
    }

    // The further off a shot, the likelier it is lost in the din, so a busy battle never turns to a wall of noise.
    const nearness = DISTANCE.closest / distance;

    if (jitter(entity + 2) > DISTANCE.heard + (1 - DISTANCE.heard) * nearness ** 2) continue;

    cue(bolt.beam ? 'beam' : 'shot', {
      take: Math.floor(jitter(entity + 1) * 12),
      pan,
      rate: 0.85 + 0.35 * variation,
      gain: (bolt.beam ? LEVELS.beam : LEVELS.shot) * Math.max(nearness ** 1.3, DISTANCE.faint),
      delay,
      tone: clamp(0.35 + 0.65 * nearness, 0, 1),
      space: lerp(0.9, 0.45, nearness),
    });
  }

  for (const entity of world.query(burstFlares(Flare))) {
    const flare = entity.get(Flare);

    // Only the brightest bursts carry, and only as rumbles through the void.
    if (flare === undefined || flare.energy < DISTANCE.boom) continue;

    const { distance, pan } = whereHeard(world, flare.position);
    const nearness = Math.min(DISTANCE.closest / distance, 1);
    const [nearTone, farTone] = EXPLOSION.tone;
    cue('hit', {
      take: Math.floor(jitter(entity + 1) * 12),
      pan,
      rate: 0.8 + 0.4 * jitter(entity),
      gain: LEVELS.hit * nearness,
      attack: EXPLOSION.attack,
      tone: lerp(farTone, nearTone, clamp((nearness - 0.46) / 0.54, 0, 1)),
      space: EXPLOSION.space,
      expanse: EXPLOSION.expanse,
    });
  }

  // The gun fires with a heavy thoom from where it stands.
  for (const entity of world.query(firedShells(Shell))) {
    const shell = entity.get(Shell);

    if (shell === undefined) continue;

    cue('launch', { pan: whereHeard(world, shell.from).pan, gain: LEVELS.launch, space: 0.35 });
  }

  // The hole hums while it is open, its drone climbing as it draws the wumpus in, and roaring as the camera falls in
  // after it; the wumpus wails as it is caught, and the hole gulps it down.
  const hole = world.queryFirst(BlackHole, Transform);
  const holeState = hole?.get(BlackHole);
  const holeAt = hole?.get(Transform)?.position;
  const holePan = holeAt === undefined ? 0 : whereHeard(world, holeAt).pan;
  const capture = world.queryFirst(Captured)?.get(Captured);

  const prey = world.queryFirst(Captured, Transform);
  const caught = prey !== undefined;

  if (caught && !sound.heard.caught) {
    cue('scream', {
      pan: whereHeard(world, prey.get(Transform)!.position).pan,
      gain: LEVELS.scream,
      delay: 0.25,
      space: 0.3,
    });
  }

  sound.heard.caught = caught;

  const swallowed = world.queryFirst(Swallowed) !== undefined;

  if (swallowed && !sound.heard.swallowed)
    cue('gulp', { pan: holePan, gain: LEVELS.gulp, space: 0.4 });

  sound.heard.swallowed = swallowed;

  const dread = world.get(Dread)!.level;
  sound.drone = holeState === undefined ? 0 : Math.min(holeState.presence, 1) * (0.25 + 0.75 * dread);
  sound.dronePan = holePan;
  sound.dread = dread;
  sound.fall = world.get(Shot)!.speed / INFALL;

  // The end: how hard the tide has the wumpus, held once it is gone, and how fast it tumbles; and once it is gone,
  // the hush, until the hole sucks the camera in after it.
  const tumbling = world.queryFirst(Captured, Spin)?.get(Spin);
  sound.torment =
    holeState === undefined
      ? 0
      : capture === undefined
        ? sound.torment
        : capture.tide / CAPTURE.tide.most;
  sound.spin = tumbling === undefined ? 0 : vec3.length(tumbling.velocity) / (2 * Math.PI);
  sound.gone = world.get(Framing)!.lost;
  sound.hush = sound.gone ? 1 - Math.min(sound.fall * 4, 1) : 0;

  // Over the last of its fall time slows for the wumpus, as heard from outside.
  const nearing = capture === undefined ? 0 : capture.age / CAPTURE.duration;
  sound.dilation = sound.gone
    ? 1
    : Math.min(Math.max((nearing - (1 - FREEZE.from)) / FREEZE.from, 0), 1) ** 2;
  const slowed = 1 - FREEZE.voice * sound.dilation;

  // The wumpus's heart keeps the beat once it is flung and the camera is with it: racing as it tumbles, dropping to a
  // slow, deep pulse once the hole opens and quickening as the hole grows, racing again as the tide takes it,
  // stretching out as time slows for it, and stopping dead once it is gone. It swishes through its tumble: as it
  // tumbles free, and once the hole has it, once each turn, more and more strained. And as the tide draws it out, its
  // body creaks.
  const { delta, elapsed } = world.get(Time)!;
  const flung = world.queryFirst(Fear, Transform);
  const alive =
    flung !== undefined &&
    !flung.has(Tether) &&
    !flung.has(Swallowed) &&
    world.get(Framing)!.shot === 'flight' &&
    !sound.silenced;

  if (alive) {
    const growing = Math.min(holeState?.presence ?? 0, 1);
    const pace =
      holeState === undefined
        ? HEART.racing
        : HEART.slow +
          (HEART.quick - HEART.slow) * growing +
          (HEART.frantic - HEART.quick) * sound.torment;
    const slowness = 1 - Math.min(Math.max((pace - HEART.slow) / (HEART.racing - HEART.slow), 0), 1);

    if ((sound.heart -= delta) <= 0) {
      cue('heartbeat', {
        gain: LEVELS.heartbeat * (1 + (HEART.deep - 1) * slowness),
        rate: (1 - 0.1 * slowness) * slowed,
        tone: HEART.muffled,
      });
      sound.heart = Math.max(sound.heart, 0) + 1 / (pace * (1 - FREEZE.heart * sound.dilation));
    }

    if ((sound.breath -= delta) <= 0) {
      const variation = jitter(Math.floor(elapsed * 13));
      cue('swish', {
        take: Math.floor(variation * 12),
        gain: LEVELS.swish,
        rate: (0.9 + 0.2 * variation) * (1 + SWISH.strain * sound.torment) * slowed,
        space: 0.15,
      });
      sound.breath =
        capture === undefined
          ? SWISH.interval + SWISH.scatter * (variation * 2 - 1)
          : Math.min(Math.max(1 / Math.max(sound.spin, 1e-3), SWISH.quickest), SWISH.slowest);
    }

    if (sound.torment > CREAK.from && (sound.creak -= delta) <= 0) {
      const variation = jitter(Math.floor(elapsed * 17) + 5);
      const [often, seldom] = CREAK.interval;
      cue('creak', {
        take: Math.floor(variation * 12),
        gain: LEVELS.creak * sound.torment,
        rate: (0.85 + 0.3 * variation) * slowed,
        space: 0.2,
      });
      sound.creak = (often + (seldom - often) * variation) * (1.5 - sound.torment);
    }
  } else {
    sound.heart = 0;
    sound.breath = 0;
    sound.creak = 0;
  }

  sound.rise =
    capture === undefined
      ? holeState === undefined
        ? 0
        : sound.rise
      : Math.min(capture.age / CAPTURE.duration, 1);

  // The wumpus's own small sounds carry only so far: from far off, none of them is heard.
  const heard = sound.heard;
  const wumpusAt = world.queryFirst(Fear, Transform)?.get(Transform)?.position;
  const near = wumpusAt !== undefined && whereHeard(world, wumpusAt).distance < DISTANCE.voice;
  const blinking = world.queryFirst(Blinking)?.get(Blinking);
  const shutting = blinking !== undefined && blinking.since >= 0;

  if (near && shutting && !heard.blinking) cue('blink', { gain: LEVELS.blink, space: 0.15 });

  heard.blinking = shutting;

  // A close call wrings a squeak out of the wumpus as it flinches.
  const fear = world.queryFirst(Fear)?.get(Fear);
  const frightened = fear !== undefined && fear.startle > YELP_FRIGHT;

  if (near && frightened && !heard.frightened) {
    cue('yelp', {
      rate: 0.92 + 0.2 * jitter(fear.jolt * 1000),
      gain: LEVELS.yelp,
      delay: 0.04,
      space: 0.2,
    });
  }

  heard.frightened = frightened;
  world.set(Sound, sound);
}

/**
 * Play this frame's cues through the mounted mixer, each as its layers, and set its loop and master from the scene.
 * A cue's take picks each layer's take in turn, so layers with different numbers of takes pair up differently.
 */
export function playSounds(world: World): void {
  const view = world.get(SoundView);

  if (view === undefined) return;

  const sound = world.get(Sound)!;
  const { queue } = sound;
  const { context } = view;
  const now = context.currentTime;

  // Audio waits for a gesture. A suspended context would hold these and play them all at once when it resumed.
  if (context.state === 'running') {
    for (let index = 0; index < queue.count; index++) {
      const cue = queue.cues[index]!;

      for (const layer of LAYERS[cue.sound]) {
        const takes = view.samples[layer.voice];
        const buffer = takes[cue.take % takes.length]!;
        const rate = cue.rate * (layer.rate ?? 1);
        const start = now + cue.delay + (layer.delay ?? 0);
        const crunched = layer.bus === 'crunch';
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        let voice: AudioNode = source;

        // A gritty voice is crunched first, so its distance dulls the grit along with everything else.
        if (crunched) {
          const drive = context.createGain();
          drive.gain.value = CRUNCH.drive;
          const shaper = context.createWaveShaper();
          shaper.curve = view.crunch;
          shaper.oversample = '4x';
          voice = voice.connect(drive).connect(shaper);
        }

        const tone = context.createBiquadFilter();
        tone.type = 'lowpass';
        const cutoff = TONE.floor * (TONE.ceiling / TONE.floor) ** cue.tone;
        tone.frequency.value = crunched ? Math.min(cutoff, CRUNCH.ceiling) : cutoff;
        const level = context.createGain();
        const gain = cue.gain * layer.gain * (crunched ? CRUNCH.level : 1);

        if (cue.attack > 0) {
          level.gain.setValueAtTime(0, start);
          level.gain.linearRampToValueAtTime(gain, start + cue.attack);
        } else level.gain.setValueAtTime(gain, start);

        // A cut layer fades out fast once it has struck, and stops once it is silent.
        if (layer.cut !== undefined) {
          level.gain.setValueAtTime(gain, start + layer.cut);
          level.gain.linearRampToValueAtTime(0, start + layer.cut + CUT_FADE);
        }

        const pan = context.createStereoPanner();
        pan.pan.setValueAtTime(cue.pan, start);
        pan.pan.linearRampToValueAtTime(cue.panTo, start + buffer.duration / rate);
        voice
          .connect(tone)
          .connect(level)
          .connect(pan)
          .connect(OWN.has(cue.sound) ? view.own.input : view.input);
        send(pan, cue.space, view.reverb);
        send(pan, cue.expanse, view.expanse);
        source.start(start, Math.min(cue.offset, buffer.duration));

        if (layer.cut !== undefined) source.stop(start + layer.cut + CUT_FADE);
      }
    }
  }

  soundActions(world).clearSoundCues();

  // Doom's drone opens up as dread rises and climbs as the hole draws the wumpus in, faster toward the end, and
  // further as the tide takes it, and the tritone above it joins as the end nears. Once it is gone it falls back. As
  // the camera falls in it swells, climbs further, and opens to a roar. Past the horizon everything stops dead.
  const { fall } = DOOM_DRONE;
  const { torment, hush } = sound;
  const falling = sound.fall ** 1.5;
  const climb =
    2 **
    ((DOOM_DRONE.climb * sound.rise ** 1.4 + DOOM_DRONE.torment * torment + fall.climb * falling) /
      12);
  const [muffled, open] = DOOM_DRONE.tone;
  const tone = muffled * (open / muffled) ** sound.dread * (fall.tone / open) ** falling;
  const quiet = sound.silenced ? 0 : 1;
  const swell = (1 + (fall.swell - 1) * falling) * (1 - (1 - DOOM_DRONE.hush) * hush) * quiet;
  const settle = sound.silenced ? 0.004 : 0.25;

  for (const [voice, level, rate] of [
    [view.drone, sound.drone, climb],
    [view.tritone, sound.drone * DOOM_DRONE.tritone * sound.dread ** 2, climb * 2 ** (6 / 12)],
  ] as const) {
    voice.level.gain.setTargetAtTime(level * swell * LEVELS.drone, now, settle);
    voice.source.playbackRate.setTargetAtTime(rate, now, 0.2);
    voice.tone.frequency.setTargetAtTime(Math.min(tone, context.sampleRate / 2), now, 0.3);
    voice.pan.pan.setTargetAtTime(sound.dronePan, now, 0.2);
  }
  // The end, scored as Gravity is. As the tide takes the wumpus its body groans and creaks, and as it tumbles a rise
  // climbs without end, faster and louder the faster it turns; and space itself tears, saturating everything. Once it
  // is gone it all falls away to a low organ, and as the camera is sucked in the rise and the tearing come back,
  // harder, to the horizon.
  const { riser, strain, organ, tear, own } = view;
  const whirl = Math.min(sound.spin / RISER.spin, 1) * torment;
  const rising = Math.min(whirl ** 1.2 * (1 - hush) + falling, 1) * quiet;
  const [dull, bright] = RISER.tone;
  riser.level.gain.setTargetAtTime(rising * LEVELS.riser, now, settle);
  riser.source.playbackRate.setTargetAtTime(
    1 + RISER.spinning * whirl + RISER.fall * falling,
    now,
    0.3
  );
  riser.tone.frequency.setTargetAtTime(dull * (bright / dull) ** Math.max(whirl, falling), now, 0.3);
  const straining = sound.gone ? 0 : torment ** 1.2 * quiet;
  strain.level.gain.setTargetAtTime(straining * LEVELS.strain, now, settle);
  strain.source.playbackRate.setTargetAtTime(1 - FREEZE.voice * sound.dilation, now, 0.3);

  // As time slows for the wumpus its sounds darken; at the horizon they are caught and held there, looping on
  // themselves, stretching and reddening as they fade, as its light does. With the next fall they run free again.
  const [clear, red] = FREEZE.redshift;
  own.tone.frequency.setTargetAtTime(clear * (FREEZE.dark / clear) ** sound.dilation, now, 0.2);

  if (sound.gone && !own.caught) {
    own.caught = true;
    own.gate.gain.setValueAtTime(0, now);
    own.live.gain.setTargetAtTime(0, now, 0.02);
    own.loop.gain.setValueAtTime(FREEZE.feedback, now);
    own.held.gain.setValueAtTime(1, now);
    own.held.gain.linearRampToValueAtTime(0, now + FREEZE.seconds);
    own.hold.delayTime.setValueAtTime(FREEZE.grain, now);
    own.hold.delayTime.linearRampToValueAtTime(FREEZE.grain * FREEZE.stretch, now + FREEZE.seconds);
    own.redshift.frequency.setValueAtTime(clear, now);
    own.redshift.frequency.exponentialRampToValueAtTime(red, now + FREEZE.seconds);
  } else if (!sound.gone && own.caught) {
    own.caught = false;

    for (const param of [own.loop.gain, own.held.gain, own.hold.delayTime, own.redshift.frequency])
      param.cancelScheduledValues(now);

    own.loop.gain.setValueAtTime(0, now);
    own.held.gain.setValueAtTime(0, now);
    own.hold.delayTime.setValueAtTime(FREEZE.grain, now);
    own.redshift.frequency.setValueAtTime(clear, now);
    own.gate.gain.setValueAtTime(1, now);
    own.live.gain.cancelScheduledValues(now);
    own.live.gain.setValueAtTime(1, now);
  }

  const [dim, full] = ORGAN.tone;
  const swelling = Math.min(ORGAN.hush * hush + ORGAN.fall * falling, 1) * quiet;
  organ.level.gain.setTargetAtTime(swelling * LEVELS.organ, now, sound.silenced ? 0.004 : 0.8);
  organ.tone.frequency.setTargetAtTime(dim * (full / dim) ** falling, now, 0.3);

  const tearing = Math.min(TEAR.torment * torment * (1 - hush) + falling, 1) * quiet;
  tear.clean.gain.setTargetAtTime(1 - 0.6 * tearing, now, 0.3);
  tear.drive.gain.setTargetAtTime(1 + (TEAR.drive - 1) * tearing, now, 0.3);
  tear.torn.gain.setTargetAtTime(0.5 * tearing, now, 0.3);

  view.master.gain.setTargetAtTime(
    sound.muted || sound.silenced ? 0 : LEVELS.master,
    now,
    sound.silenced ? 0.004 : 0.05
  );
}

/** Send `amount` of a voice into one of the mix's spaces. */
function send(from: AudioNode, amount: number, into: AudioNode): void {
  if (amount === 0) return;

  const level = from.context.createGain();
  level.gain.value = amount;
  from.connect(level).connect(into);
}
