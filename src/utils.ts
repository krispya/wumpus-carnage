/**
 * Keep one object across a hot module replacement. A uniform set is written every frame by a mounted view and read
 * once by the render pipeline when its node graph is built, and the two import it from the same module but
 * re-execute at their own times. A fresh set on replacement would leave the writer and the reader holding different
 * objects, so Vite hands the replaced module its predecessor's set instead. Outside development nothing is replaced
 * and every caller builds its own.
 */
export function retained<T extends object>(key: string, build: () => T): T {
  const store = import.meta.hot?.data as Record<string, T | undefined> | undefined;
  const kept = store?.[key];

  if (kept !== undefined) return kept;

  const made = build();

  if (store !== undefined) store[key] = made;

  return made;
}
