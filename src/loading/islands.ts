import { BufferGeometry, Vector3 } from 'three/webgpu';

export interface Island {
  /** The island's triangles, sharing the source geometry's attributes. */
  geometry: BufferGeometry;
  /** The mean of the island's vertices. */
  centroid: Vector3;
}

/**
 * Split an indexed geometry into its separate pieces. Triangles belong together when they share a vertex, or a
 * position, since a smooth piece still duplicates the vertices along its UV seams.
 */
export function splitIslands(source: BufferGeometry): Island[] {
  const index = source.getIndex()!;
  const position = source.getAttribute('position');
  const parent = Int32Array.from({ length: position.count }, (_, vertex) => vertex);
  const find = (vertex: number): number => {
    while (parent[vertex] !== vertex) vertex = parent[vertex] = parent[parent[vertex]!]!;

    return vertex;
  };
  const join = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  for (let corner = 0; corner < index.count; corner += 3) {
    join(index.getX(corner), index.getX(corner + 1));
    join(index.getX(corner + 1), index.getX(corner + 2));
  }

  const seen = new Map<string, number>();

  for (let vertex = 0; vertex < position.count; vertex++) {
    const key = `${position.getX(vertex).toFixed(4)},${position.getY(vertex).toFixed(4)},${position.getZ(vertex).toFixed(4)}`;
    const first = seen.get(key);

    if (first === undefined) seen.set(key, vertex);
    else join(vertex, first);
  }

  const corners = new Map<number, number[]>();

  for (let corner = 0; corner < index.count; corner++) {
    const vertex = index.getX(corner);
    const root = find(vertex);
    let list = corners.get(root);

    if (list === undefined) corners.set(root, (list = []));

    list.push(vertex);
  }

  return [...corners.values()].map((list) => {
    const geometry = new BufferGeometry();

    for (const [name, attribute] of Object.entries(source.attributes))
      geometry.setAttribute(name, attribute);

    geometry.setIndex(list);

    const vertices = new Set(list);
    const centroid = new Vector3();

    for (const vertex of vertices) centroid.add(new Vector3().fromBufferAttribute(position, vertex));

    return { geometry, centroid: centroid.divideScalar(vertices.size) };
  });
}
