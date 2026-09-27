import { useWorld } from 'koota/react';
import { Suspense, use, useEffect, useState } from 'react';
import { soundActions } from './actions';
import { CRUNCH, EXPANSE, FREEZE, HALL } from './content';
import { loadSamples } from './samples';
import type { LoopDraw, SoundDraw } from './traits';

/**
 * The gestures a browser lets start audio. A phone trusts a touch only once it lifts, so a press alone won't do
 * there.
 */
const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

/**
 * The scene's sound: console-era samples through a modern mix. Browsers hold audio until a gesture, so the first
 * press, tap, or key in the page starts it, even while the samples are still baking, and nothing cued before then
 * plays late. M mutes it.
 */
export function SoundRenderer() {
  const world = useWorld();
  const [context, setContext] = useState<AudioContext>();

  useEffect(() => {
    // An iPhone plays the page as media, as it would a film, rather than as sound effects its silent switch mutes.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;

    if (session !== undefined) session.type = 'playback';

    const context = new AudioContext({ latencyHint: 'interactive' });
    const actions = soundActions(world);

    // Some browsers let audio start on its own. The rest wait for the unlock below. A phone can also suspend it
    // again, as for a call, so any later gesture starts it once more.
    const running = () => {
      if (context.state === 'running') actions.unlockSound();
    };
    const unlock = () => {
      if (context.state === 'running' || context.state === 'closed') return;

      void context.resume();
      // Older iPhones start a context only once a sound has started inside the gesture, so start a silent one.
      const nudge = context.createBufferSource();
      nudge.buffer = context.createBuffer(1, 1, context.sampleRate);
      nudge.connect(context.destination);
      nudge.start();
    };

    running();
    context.addEventListener('statechange', running);
    const key = (event: KeyboardEvent) => {
      if (event.key === 'm' || event.key === 'M') actions.toggleSound();
    };

    for (const gesture of GESTURES) window.addEventListener(gesture, unlock, true);

    window.addEventListener('keydown', key);
    setContext(context);

    return () => {
      context.removeEventListener('statechange', running);

      for (const gesture of GESTURES) window.removeEventListener(gesture, unlock, true);

      window.removeEventListener('keydown', key);
      void context.close();
    };
  }, [world]);

  // The scene never waits on its sound: the samples bake beside it and join when they are ready.
  return context === undefined ? null : (
    <Suspense fallback={null}>
      <Mixer context={context} />
    </Suspense>
  );
}

/** The mix, once its samples are baked, mounted on the page's audio. */
function Mixer({ context }: { readonly context: AudioContext }) {
  const world = useWorld();
  const samples = use(loadSamples());

  useEffect(() => {
    const actions = soundActions(world);
    const view = mix(context, samples);
    actions.mountSoundView(view);

    return () => {
      actions.unmountSoundView();
      view.master.disconnect();

      for (const voice of [view.drone, view.tritone, view.riser, view.strain, view.organ])
        voice.source.stop();
    };
  }, [world, context, samples]);

  return null;
}

/**
 * The mix. Everything meets at the input, passes a compressor that glues the battle together, and reaches the
 * master, clean or, as space tears at the end, driven into saturation. A hall in the manner of the PlayStation's
 * reverb and the void return to the input from their sends, and doom's drone, the rise, and the organ wait under it
 * all for a hole to open.
 */
function mix(context: AudioContext, samples: SoundDraw['samples']): SoundDraw {
  const input = context.createGain();
  const glue = context.createDynamicsCompressor();
  glue.threshold.value = -18;
  glue.knee.value = 10;
  glue.ratio.value = 4;
  glue.attack.value = 0.004;
  glue.release.value = 0.25;
  const master = context.createGain();
  master.gain.value = 0;
  glue.connect(master).connect(context.destination);

  // Space tearing: the mix runs clean, and alongside, driven into a hard saturation the scene brings in at the end.
  const clean = context.createGain();
  const drive = context.createGain();
  const saturate = context.createWaveShaper();
  saturate.curve = Float32Array.from({ length: 2048 }, (_, index) =>
    Math.tanh(4 * ((index / 2047) * 2 - 1))
  );
  saturate.oversample = '2x';
  const torn = context.createGain();
  torn.gain.value = 0;
  input.connect(clean).connect(glue);
  input.connect(drive).connect(saturate).connect(torn).connect(glue);

  // The crunch: a warm soft clip, which each gritty voice's own shaper plays through, oversampled so it stays clean.
  const crunch = Float32Array.from({ length: 2048 }, (_, index) => {
    const x = (index / 2047) * 2 - 1;

    return Math.tanh(CRUNCH.warmth * x) / Math.tanh(CRUNCH.warmth);
  });

  // The hall waits a moment before it answers, as a real room does.
  const reverb = context.createGain();
  const predelay = context.createDelay(0.1);
  predelay.delayTime.value = HALL.predelay;
  const hall = context.createConvolver();
  hall.buffer = room(context, HALL.seconds, HALL.decay, HALL.darkening, true);
  const wet = context.createGain();
  wet.gain.value = HALL.wet;
  reverb.connect(predelay).connect(hall).connect(wet).connect(input);

  // The void answers after a long moment, swells in, and rings dark for seconds, so whatever is sent into it sounds
  // as though it reached the wumpus from very far away.
  const expanse = context.createGain();
  const distance = context.createDelay(0.5);
  distance.delayTime.value = EXPANSE.predelay;
  const vast = context.createConvolver();
  vast.buffer = room(context, EXPANSE.seconds, EXPANSE.decay, EXPANSE.darkening, false);
  const murk = context.createBiquadFilter();
  murk.type = 'lowpass';
  murk.frequency.value = EXPANSE.ceiling;
  const far = context.createGain();
  far.gain.value = EXPANSE.wet;
  expanse.connect(distance).connect(vast).connect(murk).connect(far).connect(input);

  const drone = loop(context, samples.drone[0]!, input);
  const tritone = loop(context, samples.drone[0]!, input);
  drone.pan.connect(reverb);
  tritone.pan.connect(reverb);

  // The rise sounds in the void and the wumpus's body close by. The organ fills the hall.
  const riser = loop(context, samples.riser[0]!, input);
  riser.pan.connect(expanse);
  // The wumpus's own sounds pass through here, so that at the horizon they can be caught and held there, as its
  // light is: they play live, and feed a short line that can be closed on them and left looping on itself.
  const own = context.createGain();
  const live = context.createGain();
  const tone = context.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = FREEZE.redshift[0];
  own.connect(tone).connect(live).connect(input);
  const gate = context.createGain();
  const hold = context.createDelay(1);
  hold.delayTime.value = FREEZE.grain;
  const again = context.createGain();
  again.gain.value = 0;
  const redshift = context.createBiquadFilter();
  redshift.type = 'lowpass';
  redshift.frequency.value = FREEZE.redshift[0];
  const held = context.createGain();
  held.gain.value = 0;
  own.connect(gate).connect(hold);
  hold.connect(redshift).connect(again).connect(hold);
  redshift.connect(held).connect(input);
  held.connect(expanse);

  const strain = loop(context, samples.strain[0]!, own);
  strain.pan.connect(reverb);
  const organ = loop(context, samples.organ[0]!, input);
  organ.pan.connect(reverb);

  return {
    context,
    samples,
    input,
    crunch,
    reverb,
    expanse,
    master,
    drone,
    tritone,
    riser,
    strain,
    organ,
    tear: { clean, drive, torn },
    own: { input: own, live, tone, gate, hold, loop: again, redshift, held, caught: false },
  };
}

/** A voice looping its settled second half, silent until the scene sets its level. */
function loop(context: AudioContext, buffer: AudioBuffer, into: AudioNode): LoopDraw {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = buffer.duration / 2;
  source.loopEnd = buffer.duration;
  const tone = context.createBiquadFilter();
  tone.type = 'lowpass';
  const level = context.createGain();
  level.gain.value = 0;
  const pan = context.createStereoPanner();
  source.connect(tone).connect(level).connect(pan).connect(into);
  source.start(0, buffer.duration / 2);

  return { source, tone, level, pan };
}

/**
 * A stereo space's impulse: a dense tail of noise, different in each ear, that dies at `decay` a second over
 * `seconds` and darkens at `darkening` a second, since air takes the highs first. A room with walls answers first
 * with a few sparse early reflections. A space without them has none, and its tail swells in rather than starting
 * at once.
 */
function room(
  context: AudioContext,
  seconds: number,
  decay: number,
  darkening: number,
  walls: boolean
): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = context.createBuffer(2, length, rate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let low = 0;

    for (let index = 0; index < length; index++) {
      const time = index / rate;
      low += (Math.random() * 2 - 1 - low) * (0.05 + 0.9 * Math.exp(-time * darkening));
      data[index] = low * Math.exp(-time * decay) * (walls ? 1 : 1 - Math.exp(-time / 0.15));
    }

    if (!walls) continue;

    for (let tap = 0; tap < 6; tap++) {
      data[Math.floor((0.011 + tap * 0.017 + channel * 0.007) * rate)]! +=
        (tap % 2 === 0 ? 0.7 : -0.5) * (1 - tap / 8);
    }
  }

  return buffer;
}
