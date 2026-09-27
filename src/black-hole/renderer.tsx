import { useThree } from '@react-three/fiber/webgpu';
import { useActions } from 'koota/react';
import { useLayoutEffect } from 'react';
import type { PerspectiveCamera } from 'three/webgpu';
import { blackHoleActions } from './actions';
import { FOREGROUND } from './content';

/**
 * The hole is not drawn in the scene at all: there is nothing there to draw. The post pass traces the frame through
 * it, seen through the camera handed to its view here, which sees the foreground too.
 */
export function BlackHoleRenderer() {
  const { mountBlackHoleView, unmountBlackHoleView } = useActions(blackHoleActions);
  const camera = useThree((state) => state.camera);

  useLayoutEffect(() => {
    camera.layers.enable(FOREGROUND);
    mountBlackHoleView({ camera: camera as PerspectiveCamera });

    return unmountBlackHoleView;
  }, [camera, mountBlackHoleView, unmountBlackHoleView]);

  return null;
}
