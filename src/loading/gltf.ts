import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LoadingManager } from 'three/webgpu';

/**
 * Point a .gltf's sidecar files at the URLs the bundler emitted for them. A .gltf names its buffers relative to
 * itself, but a build fingerprints every file on its own, so the loader finds each one by its file name instead.
 */
export function withSidecars(files: Record<string, string>): (loader: GLTFLoader) => void {
  const byName = new Map(Object.entries(files).map(([path, url]) => [basename(path), url]));
  const manager = new LoadingManager();
  manager.setURLModifier((url) => byName.get(basename(url)) ?? url);

  return (loader) => {
    loader.manager = manager;
  };
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
