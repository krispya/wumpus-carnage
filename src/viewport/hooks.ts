import { useThree } from '@react-three/fiber/webgpu';
import type { World } from 'koota';
import { useLayoutEffect } from 'react';
import { viewportActions } from './actions';

/** Publish the frame's shape to the world whenever the canvas resizes. */
export function useViewport(world: World): void {
  const aspect = useThree((state) => state.size.width / state.size.height);

  useLayoutEffect(() => {
    viewportActions(world).setViewport(aspect);
  }, [world, aspect]);
}
