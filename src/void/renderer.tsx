import { useThree } from '@react-three/fiber/webgpu';
import { useLayoutEffect } from 'react';
import { SUN } from './content';
import { bakeNebula, voidBackground } from './materials';

/** The void and its light. The nebula is baked before the void is first seen. */
export function Void() {
  const scene = useThree((state) => state.scene);
  const renderer = useThree((state) => state.renderer);

  useLayoutEffect(() => bakeNebula(renderer), [renderer]);

  useLayoutEffect(() => {
    scene.backgroundNode = voidBackground;

    return () => {
      scene.backgroundNode = null;
    };
  }, [scene]);

  return <Lighting />;
}

/**
 * Nothing in a void bounces light, so every light is placed: a cream key from the sun, a cornflower rim behind to
 * cut the silhouette out of the dark, a warm khaki rim from below, and a faint indigo fill so the shadowed side
 * keeps its colour.
 */
function Lighting() {
  const [x, y, z] = SUN.direction;

  return (
    <>
      <directionalLight
        name="void-key"
        color="#fff3dc"
        intensity={2.3}
        position={[x * 10, y * 10, z * 10]}
      />
      <directionalLight name="void-rim-blue" color="#6a86ff" intensity={4} position={[6, 4, -6]} />
      <directionalLight
        name="void-rim-khaki"
        color="#d9b27a"
        intensity={2.4}
        position={[-7, -4, -5]}
      />
      <hemisphereLight name="void-fill" args={['#1e1a48', '#06050f', 0.75]} />
    </>
  );
}
