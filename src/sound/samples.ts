import { RECORDINGS, RISER } from './content';
import type { Loop, Recording, SoundDraw, Synth } from './traits';

/** A constant, or seconds and values alternating: held at the first value, then ramped exponentially onward. */
type Curve = number | readonly number[];

const files = import.meta.glob<string>('../../assets/sounds/**/*.mp3', {
  query: '?url',
  import: 'default',
  eager: true,
});

let samples: Promise<SoundDraw['samples']> | undefined;

/**
 * Every voice, baked or decoded once and shared. `use` needs the same promise on every render to see it settle, so
 * the first call starts the work and each later call returns its promise.
 */
export function loadSamples(): Promise<SoundDraw['samples']> {
  samples ??= Promise.all([bakeSynths(), loadRecordings()]).then(([synths, recordings]) => ({
    ...synths,
    ...recordings,
  }));

  return samples;
}

/** Decode each recorded voice's takes from the files the bundler emitted for them. */
async function loadRecordings(): Promise<Record<Recording, AudioBuffer[]>> {
  const decoder = new OfflineAudioContext(1, 1, 44_100);
  const urls = new Map(
    Object.entries(files).map(([path, url]) => [
      path.slice(path.lastIndexOf('/') + 1, -'.mp3'.length),
      url,
    ])
  );
  const decode = async (name: string) => {
    const url = urls.get(name);

    if (url === undefined) throw new Error(`No recording named ${name} in assets/sounds`);

    return decoder.decodeAudioData(await (await fetch(url)).arrayBuffer());
  };
  const voices = await Promise.all(
    Object.entries(RECORDINGS).map(async ([voice, names]) => [
      voice,
      await Promise.all(names.map(decode)),
    ])
  );

  return Object.fromEntries(voices) as Record<Recording, AudioBuffer[]>;
}

/**
 * Voices are rendered offline at full fidelity, 44.1 kHz and sixteen bits, and the mixer pitches them by playback
 * rate. What they play is space opera, struck rather than sustained: blasters that crack and zing like a struck guy
 * wire, turbolasers that thump, and explosions heard across a great distance, and the end, scored and felt as in
 * Gravity. Loops are baked twice over and repeat their settled second half, since every part of them repeats there.
 */
async function bakeSynths(): Promise<Record<Synth | Loop, AudioBuffer[]>> {
  // The blaster, after the struck guy wire that gave the films theirs: struck hard, so it cracks with a tick of bright
  // noise and a thump beneath, then zings, diving fast from high to low, rung by frequency modulation, its second
  // partial trailing a hair behind the way a long wire spreads a strike out. It is gone almost as soon as it is heard.
  // Three takes, pitched and timed a little apart.
  const pew = (start: number, end: number, length: number) =>
    bake(length + 0.03, 44_100, 16, (context) => {
      const carrier = oscillator(
        context,
        'sine',
        [0, start, length * 0.45, end],
        [0, 1e-4, 0.001, 1, 0.03, 0.45, length, 1e-4]
      );
      oscillator(
        context,
        'sine',
        [0, start * 1.41, length * 0.45, end * 1.41],
        1,
        gain(context, [0, start * 0.9, length * 0.6, 20], carrier.frequency)
      );
      oscillator(
        context,
        'sine',
        [0, start * 0.72, length * 0.5, end * 0.8],
        [0, 1e-4, 0.006, 1e-4, 0.009, 0.5, length * 0.8, 1e-4]
      );
      oscillator(context, 'sine', [0, 190, 0.05, 55], [0, 1e-4, 0.001, 0.8, 0.06, 1e-4]);
      noise(context, [0, 0.7, 0.008, 1e-4], filter(context, 'highpass', 2600, 0.7));
    });
  const [
    pew1,
    pew2,
    pew3,
    snap,
    zap,
    pass,
    cannon,
    boom,
    blink,
    eep,
    charge,
    thoom,
    implode,
    gulp,
    scream,
    heartbeat,
    roar,
    drone,
    wilhelm,
    organ,
    strain,
    gasp,
  ] = await Promise.all([
    pew(2200, 500, 0.1),
    pew(2600, 600, 0.08),
    pew(1900, 420, 0.12),
    bake(0.08, 44_100, 16, (context) => {
      // A snap: a crack of noise through a band that falls as it dies, over a click of square that drops two octaves
      // in a few milliseconds. It is all attack.
      noise(context, [0, 1, 0.05, 1e-4], filter(context, 'bandpass', [0, 5000, 0.05, 1800], 0.8));
      oscillator(context, 'square', [0, 900, 0.02, 220], [0, 0.6, 0.03, 1e-4]);
    }),
    bake(0.34, 44_100, 16, (context) => {
      // A heavy blaster close by: a crack of noise and a punch in the chest, then a saw and a square diving through a
      // closing low-pass under a ringing FM zing, all of it done in a third of a second.
      noise(context, [0, 1, 0.02, 1e-4], filter(context, 'bandpass', 3000, 0.9));
      oscillator(context, 'sine', [0, 160, 0.08, 45], [0, 1e-4, 0.001, 1, 0.12, 1e-4]);
      const body = filter(context, 'lowpass', [0, 5000, 0.25, 300], 3);
      oscillator(context, 'sawtooth', [0, 1600, 0.2, 70], [0, 1e-4, 0.001, 0.8, 0.3, 1e-4], body);
      oscillator(context, 'square', [0, 800, 0.2, 45], [0, 1e-4, 0.001, 0.4, 0.26, 1e-4], body);
      const carrier = oscillator(
        context,
        'sine',
        [0, 2600, 0.18, 130],
        [0, 1e-4, 0.001, 0.7, 0.24, 1e-4]
      );
      oscillator(context, 'sine', 90, 1, gain(context, [0, 1800, 0.2, 10], carrier.frequency));
    }),
    bake(0.5, 44_100, 16, (context) => {
      // A shot tearing past: air rushing through a band that falls as it goes, swelling to the moment it passes, and a
      // whine that drops as it passes, the way a siren does going by.
      noise(
        context,
        [0, 1e-4, 0.14, 0.9, 0.5, 1e-4],
        filter(context, 'bandpass', [0, 3400, 0.5, 400], 1.4)
      );
      oscillator(
        context,
        'triangle',
        [0, 880, 0.12, 800, 0.22, 440, 0.5, 380],
        [0, 1e-4, 0.12, 0.5, 0.5, 1e-4]
      );
    }),
    bake(0.6, 44_100, 16, (context) => {
      // A turbolaser: a heavy thump and a crack, then a fat, buzzing zing diving through a closing band, and a crackle
      // of noise that burns off after it.
      oscillator(context, 'sine', [0, 130, 0.15, 38], [0, 1e-4, 0.001, 1, 0.22, 1e-4]);
      noise(context, [0, 0.9, 0.025, 1e-4], filter(context, 'highpass', 2000, 0.7));
      const band = filter(context, 'bandpass', [0, 3500, 0.35, 500], 2.5);
      const low = oscillator(
        context,
        'sawtooth',
        [0, 1500, 0.3, 85],
        [0, 1e-4, 0.002, 0.9, 0.45, 1e-4],
        band
      );
      const high = oscillator(
        context,
        'sawtooth',
        [0, 1530, 0.3, 87],
        [0, 1e-4, 0.002, 0.9, 0.45, 1e-4],
        band
      );
      const wobble = gain(context, [0, 60, 0.3, 4], low.frequency);
      wobble.connect(high.frequency);
      oscillator(context, 'sine', 34, 1, wobble);
      noise(context, [0, 0.4, 0.5, 1e-4], filter(context, 'lowpass', [0, 5000, 0.5, 600], 1));
    }),
    bake(1.5, 44_100, 16, (context) => {
      // An explosion a long way off: a crack at the front, then a sub drop under noise whose brightness drains away,
      // all of it dulled by the distance before it arrives.
      noise(context, [0, 1, 0.03, 1e-4], filter(context, 'highpass', 1500, 0.7));
      oscillator(context, 'sine', [0, 120, 0.4, 32], [0, 1e-4, 0.002, 1, 1.4, 1e-4]);
      noise(context, [0, 0.9, 1.1, 1e-4], filter(context, 'lowpass', [0, 2200, 0.9, 90], 0.9));
    }),
    bake(0.07, 44_100, 16, (context) => {
      // A blink, in the manner of a cartoon on a cartridge: a tiny sine that chirps up a fifth.
      oscillator(context, 'sine', [0, 1100, 0.035, 1650], [0, 1e-4, 0.004, 0.6, 0.065, 1e-4]);
    }),
    bake(0.22, 44_100, 16, (context) => {
      // A frightened squeak, the kind a cartoon on a cartridge lets out: a buzzing voice through two vowel formants
      // that jumps up a sixth, trembling as it goes, and trails off.
      const pitch = [0, 520, 0.03, 880, 0.2, 760];
      const level = [0, 1e-4, 0.01, 1, 0.15, 0.6, 0.22, 1e-4];
      const voice = oscillator(
        context,
        'sawtooth',
        pitch,
        level,
        filter(context, 'bandpass', 1200, 6, gain(context, 0.7))
      );
      const bright = oscillator(
        context,
        'sawtooth',
        pitch,
        level,
        filter(context, 'bandpass', 2600, 9, gain(context, 0.3))
      );
      const quaver = gain(context, 30, voice.frequency);
      quaver.connect(bright.frequency);
      oscillator(context, 'sine', 24, 1, quaver);
    }),
    bake(1.3, 44_100, 16, (context) => {
      // The black-hole gun charging: a whine climbing four octaves, faster as it goes and wobbling quicker as it
      // climbs, a buzz rising under it, and a hiss swelling with it, all cut dead the moment it is full.
      const whine = oscillator(
        context,
        'sine',
        [0, 160, 1.2, 2600],
        [0, 1e-4, 0.3, 0.5, 1.2, 1, 1.26, 1e-4]
      );
      oscillator(
        context,
        'sine',
        [0, 6, 1.2, 38],
        1,
        gain(context, [0, 30, 1.2, 400], whine.frequency)
      );
      oscillator(
        context,
        'sawtooth',
        [0, 80, 1.2, 1300],
        [0, 1e-4, 0.5, 0.15, 1.2, 0.35, 1.26, 1e-4],
        filter(context, 'lowpass', 3000, 2)
      );
      noise(
        context,
        [0, 1e-4, 1.1, 0.4, 1.25, 1e-4],
        filter(context, 'highpass', [0, 800, 1.2, 5000], 0.7)
      );
    }),
    bake(0.9, 44_100, 16, (context) => {
      // The gun firing: a sub that drops out from under a saw diving through a closing low-pass, and a burst of noise.
      oscillator(context, 'sine', [0, 90, 0.6, 30], [0, 1e-4, 0.002, 1, 0.85, 1e-4]);
      oscillator(
        context,
        'sawtooth',
        [0, 420, 0.4, 50],
        [0, 1e-4, 0.002, 0.6, 0.5, 1e-4],
        filter(context, 'lowpass', [0, 4000, 0.4, 200], 2)
      );
      noise(context, [0, 0.8, 0.3, 1e-4], filter(context, 'lowpass', [0, 5000, 0.3, 400], 0.8));
    }),
    bake(1.1, 44_100, 16, (context) => {
      // The shell imploding: air rushing in, swelling and brightening as though played backward, cut off by a thump.
      noise(
        context,
        [0, 1e-4, 0.75, 1, 0.78, 1e-4],
        filter(context, 'bandpass', [0, 300, 0.75, 4000], 1.2)
      );
      oscillator(
        context,
        'sine',
        [0, 90, 0.78, 90, 1.1, 28],
        [0, 1e-4, 0.76, 1e-4, 0.785, 1, 1.1, 1e-4]
      );
    }),
    bake(0.5, 44_100, 16, (context) => {
      // A gulp: a sine swallowing down past an octave with a wobble in its throat, and a little wet noise.
      const throat = oscillator(
        context,
        'sine',
        [0, 480, 0.32, 70],
        [0, 1e-4, 0.015, 0.9, 0.46, 1e-4]
      );
      oscillator(context, 'sine', 26, 1, gain(context, 45, throat.frequency));
      noise(context, [0, 0.3, 0.12, 1e-4], filter(context, 'lowpass', 500, 2));
    }),
    bake(1.8, 44_100, 16, (context) => {
      // A wail, the kind a cartoon on a cartridge lets out as it is dragged away: a buzzing voice through two vowel
      // formants that leaps up, holds, and falls away, quavering harder as it goes.
      const pitch = [0, 420, 0.15, 780, 1.2, 700, 1.8, 260];
      const level = [0, 1e-4, 0.05, 1, 1.4, 0.8, 1.8, 1e-4];
      const voice = oscillator(
        context,
        'sawtooth',
        pitch,
        level,
        filter(context, 'bandpass', 900, 6, gain(context, 0.7))
      );
      const bright = oscillator(
        context,
        'sawtooth',
        pitch,
        level,
        filter(context, 'bandpass', 2400, 9, gain(context, 0.3))
      );
      const quaver = gain(context, [0, 10, 1.8, 60], voice.frequency);
      quaver.connect(bright.frequency);
      oscillator(context, 'sine', 7, 1, quaver);
    }),
    bake(0.6, 44_100, 16, (context) => {
      // The wumpus's heart, heard as though in its own ears: a hard thump and a softer one after it, lub-dub, each a
      // body of low tone dropping away under a dull knock that carries on any speaker.
      oscillator(context, 'sine', [0, 120, 0.12, 48], [0, 1e-4, 0.004, 1, 0.16, 1e-4]);
      oscillator(
        context,
        'sine',
        [0, 104, 0.2, 104, 0.34, 44],
        [0, 1e-4, 0.2, 1e-4, 0.204, 0.7, 0.4, 1e-4]
      );
      noise(context, [0, 0.5, 0.04, 1e-4], filter(context, 'lowpass', 750, 1.2));
      noise(
        context,
        [0, 1e-4, 0.2, 1e-4, 0.204, 0.3, 0.24, 1e-4],
        filter(context, 'lowpass', 650, 1.2)
      );
    }),
    bake(6.5, 44_100, 16, (context) => {
      // Falling in: a roar that swells and climbs faster and faster, as though all of space were pouring down a drain.
      // Wind howls through a band climbing from a rumble to a shriek, a sub groans upward beneath it, two saws a hair
      // apart grind up through a low-pass that opens as they climb, and a siren wails over it all, quavering harder
      // and harder. It never ends. It is cut.
      noise(
        context,
        [0, 1e-3, 3, 0.15, 5.5, 1, 6.5, 1],
        filter(context, 'bandpass', [0, 180, 3, 700, 6, 4000], 1.6)
      );
      oscillator(context, 'sine', [0, 28, 6, 70], [0, 0.05, 4, 0.5, 6, 1]);
      const grind = filter(context, 'lowpass', [0, 200, 6, 4500], 4);
      oscillator(context, 'sawtooth', [0, 45, 6, 240], [0, 0.02, 4, 0.25, 6, 0.7], grind);
      oscillator(context, 'sawtooth', [0, 45.7, 6, 244], [0, 0.02, 4, 0.25, 6, 0.7], grind);
      const siren = oscillator(context, 'sine', [0, 220, 6, 1400], [0, 1e-3, 3, 0.1, 6, 0.5]);
      oscillator(context, 'sine', [0, 3, 6, 14], 1, gain(context, [0, 8, 6, 120], siren.frequency));
    }),
    bake(8, 44_100, 16, (context) => {
      // Doom: a sub groaning under two saws a quarter hertz apart, which beat once every four seconds, wind sweeping
      // through a band that rises and falls on the same slow cycle, and a growl far beneath. Nothing sustains the same
      // way twice inside a cycle, and everything repeats each four seconds.
      const groan = oscillator(context, 'sine', 36, 0.6);
      oscillator(context, 'sine', 0.25, 1, gain(context, 1.5, groan.frequency));
      const body = filter(context, 'lowpass', 240, 3);
      oscillator(context, 'sine', 0.25, 1, gain(context, 120, body.frequency));
      oscillator(context, 'sawtooth', 48, 0.2, body);
      oscillator(context, 'sawtooth', 48.25, 0.2, body);
      const wind = filter(context, 'bandpass', 500, 3);
      oscillator(context, 'sine', 0.25, 1, gain(context, 350, wind.frequency));
      noise(context, 0.3, wind);
      oscillator(context, 'square', 24, 0.15, filter(context, 'lowpass', 90, 1));
    }),
    bake(1.3, 44_100, 16, (context) => {
      // The last scream, after the Wilhelm scream: a throat's buzz through the formants of an open "ah", yelped up
      // from low, hitching higher, and falling away, with a quaver and a breath of air through it.
      const mouth = gain(context, 1);
      const first = filter(context, 'bandpass', 760, 6, gain(context, 1, mouth));
      const glottis = gain(context, 1, first);
      glottis.connect(filter(context, 'bandpass', 1180, 8, gain(context, 0.6, mouth)));
      glottis.connect(filter(context, 'bandpass', 2600, 10, gain(context, 0.3, mouth)));
      const pitch = [0, 430, 0.07, 860, 0.28, 780, 0.36, 920, 0.68, 700, 1.02, 510, 1.25, 360];
      const loudness = [0, 1e-3, 0.03, 1, 0.3, 0.85, 0.38, 1, 0.8, 0.7, 1.25, 1e-3];
      const throat = oscillator(context, 'sawtooth', pitch, loudness, glottis);
      oscillator(context, 'sine', 6.5, 1, gain(context, 14, throat.frequency));
      noise(context, [0, 1e-3, 0.03, 0.12, 0.9, 0.08, 1.25, 1e-3], glottis);
    }),
    bake(8, 44_100, 16, (context) => {
      // The organ, as in Interstellar's score: a pipe organ's principal with its octave and twelfth, a sixteen-foot
      // pedal beneath, holding A minor with a ninth, each pipe doubled a quarter hertz sharp so the ranks shimmer
      // against each other, under a slow tremulant. Every pitch in it repeats each four seconds.
      const wave = context.createPeriodicWave(
        new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0]),
        new Float32Array([0, 1, 0.55, 0.3, 0.22, 0.08, 0.1, 0, 0.06])
      );
      const ranks = gain(context, 0.9);
      oscillator(context, 'sine', 5.5, 1, gain(context, 0.07, ranks.gain));
      const chord = [
        [55, 0.5],
        [82.5, 0.3],
        [110, 0.6],
        [164.75, 0.45],
        [220, 0.4],
        [261.5, 0.35],
        [329.75, 0.3],
        [494, 0.2],
      ];

      for (const [frequency, level] of chord) {
        for (const [shimmer, share] of [
          [0, 1],
          [0.25, 0.6],
        ]) {
          const pipe = context.createOscillator();
          pipe.setPeriodicWave(wave);
          pipe.frequency.value = frequency! + shimmer!;
          pipe.connect(gain(context, level! * share!, ranks));
          pipe.start();
        }
      }
    }),
    bake(8, 44_100, 16, (context) => {
      // The wumpus's body under the tide, heard as though through it: a rubbery groan wandering low, and sinew
      // creaking and popping as it is drawn out. Everything in it repeats each four seconds.
      const groan = oscillator(context, 'sawtooth', 52, 0.45, filter(context, 'lowpass', 380, 4));
      oscillator(context, 'sine', 0.25, 1, gain(context, 9, groan.frequency));
      oscillator(context, 'sine', 0.75, 1, gain(context, 4, groan.frequency));
      const creaks = [
        [0.3, 900, 0.18],
        [0.9, 1500, 0.1],
        [1.35, 700, 0.25],
        [2.1, 1800, 0.08],
        [2.6, 1100, 0.2],
        [3.2, 600, 0.3],
        [3.7, 1400, 0.12],
      ];

      for (const cycle of [0, 4]) {
        for (const [at, pitch, length] of creaks) {
          const start = cycle + at!;
          noise(
            context,
            [0, 1e-4, start, 1e-4, start + 0.01, 0.9, start + length!, 1e-4],
            filter(context, 'bandpass', pitch!, 14)
          );
        }
      }
    }),
    bake(0.6, 44_100, 16, (context) => {
      // A panicked gasp, as close as the wumpus's own breath: air dragged in through a tight throat, rising, and
      // shoved out again, shorter.
      const throat = filter(context, 'bandpass', [0, 900, 0.25, 1400, 0.3, 1100, 0.55, 800], 3);
      noise(context, [0, 1e-3, 0.22, 1, 0.26, 0.05, 0.3, 0.6, 0.55, 1e-3], throat);
      noise(context, [0, 1e-3, 0.22, 0.3, 0.26, 1e-3], filter(context, 'bandpass', 2600, 4));
    }),
  ]);

  return {
    pew: [pew1, pew2, pew3],
    snap: [snap],
    zap: [zap],
    pass: [pass],
    cannon: [cannon],
    boom: [boom],
    blink: [blink],
    eep: [eep],
    charge: [charge],
    thoom: [thoom],
    implode: [implode],
    gulp: [gulp],
    scream: [scream],
    heartbeat: [heartbeat],
    roar: [roar],
    drone: [drone],
    wilhelm: [wilhelm],
    organ: [organ],
    strain: [strain],
    gasp: [gasp],
    riser: [shepard(RISER.seconds, RISER.octaves, 32_000)],
  };
}

/**
 * The rise: a Shepard tone, `octaves` of sine partials an octave apart, every one gliding up an octave each `seconds`,
 * loudest in the middle of the range and fading to nothing at its ends, so that it climbs without ever getting
 * anywhere. It is rendered over two climbs at `rate`, its lowest pitch set so that every partial turns a whole number
 * of times in a climb, so its second climb loops seamlessly.
 */
function shepard(seconds: number, octaves: number, rate: number): AudioBuffer {
  const length = Math.round(2 * seconds * rate);
  const buffer = new AudioBuffer({ length, sampleRate: rate });
  const data = buffer.getChannelData(0);
  // Turns of the lowest partial in a climb, about 40 hertz, and a multiple of four, since two partials start below it.
  const turns = 4 * Math.round((40 * seconds) / Math.LN2 / 4);
  const middle = octaves / 2;
  const spread = octaves / 4;
  let peak = 0;

  for (let index = 0; index < length; index++) {
    const time = index / rate;
    const climbed = 2 ** (time / seconds) - 1;
    let sample = 0;

    for (let partial = -2; partial <= octaves; partial++) {
      const place = partial + time / seconds;
      sample +=
        Math.exp(-(((place - middle) / spread) ** 2)) *
        Math.sin(2 * Math.PI * turns * 2 ** partial * climbed);
    }

    data[index] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }

  for (let index = 0; index < length; index++) data[index] = (data[index]! / peak) * 0.95;

  return buffer;
}

/**
 * Render `seconds` of a patch at `rate`, bring its peak up to full scale so the quiet ones keep every step of their
 * depth, and keep `bits` of it. How loud each voice plays is the mixer's to set.
 */
async function bake(
  seconds: number,
  rate: number,
  bits: number,
  patch: (context: OfflineAudioContext) => void
): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
  patch(context);
  const buffer = await context.startRendering();
  const data = buffer.getChannelData(0);
  let peak = 0;

  for (let index = 0; index < data.length; index++) peak = Math.max(peak, Math.abs(data[index]!));

  const steps = 2 ** (bits - 1) - 1;
  const scale = (steps * 0.95) / peak;

  for (let index = 0; index < data.length; index++)
    data[index] = Math.round(data[index]! * scale) / steps;

  return buffer;
}

function shape(param: AudioParam, curve: Curve): void {
  if (typeof curve === 'number') {
    param.value = curve;

    return;
  }

  param.setValueAtTime(curve[1]!, curve[0]!);

  for (let index = 2; index < curve.length; index += 2) {
    param.exponentialRampToValueAtTime(curve[index + 1]!, curve[index]!);
  }
}

/** A gain stage into `into`, which may be another node's parameter, as when one oscillator modulates another. */
function gain(
  context: OfflineAudioContext,
  level: Curve,
  into: AudioNode | AudioParam = context.destination
): GainNode {
  const node = context.createGain();
  shape(node.gain, level);

  // `connect` is overloaded for nodes and parameters, so each is connected through its own overload.
  if (into instanceof AudioParam) node.connect(into);
  else node.connect(into);

  return node;
}

function oscillator(
  context: OfflineAudioContext,
  type: OscillatorType,
  frequency: Curve,
  level: Curve,
  into: AudioNode = context.destination
): OscillatorNode {
  const source = context.createOscillator();
  source.type = type;
  shape(source.frequency, frequency);
  source.connect(gain(context, level, into));
  source.start();

  return source;
}

/** Deterministic noise in [0, 1) from an index, so every bake of a voice is the same. */
function jitter(index: number): number {
  const value = Math.sin(index * 12.9898 + 78.233) * 43_758.545_3;

  return value - Math.floor(value);
}

/** White noise from a second-long buffer on repeat, so a loop holding it repeats exactly each second. */
function noise(context: OfflineAudioContext, level: Curve, into: AudioNode): void {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < data.length; index++) data[index] = jitter(index) * 2 - 1;

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain(context, level, into));
  source.start();
}

function filter(
  context: OfflineAudioContext,
  type: BiquadFilterType,
  frequency: Curve,
  q: number,
  into: AudioNode = context.destination
): BiquadFilterNode {
  const node = context.createBiquadFilter();
  node.type = type;
  node.Q.value = q;
  shape(node.frequency, frequency);
  node.connect(into);

  return node;
}
