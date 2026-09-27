import { mix, screenSize, screenUV, step, texture, uniform, vec2 } from 'three/tsl';
import { NoColorSpace, TextureLoader, type Node } from 'three/webgpu';
import { retained } from '../utils';
import { INSERT } from './content';

/**
 * The insert: how opaque it is, from 0, gone, to 1, how much larger than at rest it is drawn, its image's width over
 * its height, and the image itself, kept in the display's encoding. Kept across a hot module replacement.
 */
export const insertUniforms = retained('insert', () => {
  const uInsertAspect = uniform(1);
  const image = new TextureLoader().load(INSERT.src, (loaded) => {
    uInsertAspect.value = loaded.image.width / loaded.image.height;
  });
  image.colorSpace = NoColorSpace;

  return { uInsert: uniform(0), uInsertScale: uniform(1), uInsertAspect, image };
});

/**
 * Lay the insert over the finished frame, after it is tone mapped and encoded, so the image shows exactly as drawn:
 * centred, `INSERT.height` of the frame tall at rest and larger as it punches in, and as opaque as it is showing.
 */
export function overInsert(shown: Node<'vec3'>): Node<'vec3'> {
  const { uInsert, uInsertScale, uInsertAspect, image } = insertUniforms;
  const tall = uInsertScale.mul(INSERT.height);
  const centred = screenUV.sub(0.5).mul(vec2(screenSize.x.div(screenSize.y), 1));
  const at = centred.div(vec2(tall.mul(uInsertAspect), tall)).add(0.5);
  const inside = step(0, at.x).mul(step(at.x, 1)).mul(step(0, at.y)).mul(step(at.y, 1));
  const drawn = texture(image, vec2(at.x, at.y.oneMinus())).rgb;

  return mix(shown, drawn, inside.mul(uInsert));
}
