// W1 procedural island: deterministic terrain height + river layout (pure, three-free).
// The checked-in world1_graph.json node heights must match terrainHeight (locked by test).

export type XZ = { x: number; z: number };

/** W1 river polyline (lake outlet to the south sea). The bridge path crosses it; all other paths keep clear. */
export const W1_RIVER: XZ[] = [
  { x: 2, z: -14 },
  { x: 0, z: -6 },
  { x: -1, z: 2 },
  { x: -4, z: 8 },
  { x: -6, z: 15 },
  { x: -7, z: 22 },
];

/** W1 river half-width (water) and blend range. Narrow enough to spare bridge banks. */
export const W1_RIVER_HALF = 1.2;
export const W1_RIVER_BLEND = 2.2;

/** Closest point on segment: distance + param t. */
export function closestOnSegment(x: number, z: number, a: XZ, b: XZ): { d: number; t: number } {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const t = Math.min(1, Math.max(0, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz || 1)));
  return { d: Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)), t };
}

/** W1 lake fed by the river. */
export const W1_LAKE = { x: 2, z: -14, r: 4 };

function hash2(ix: number, iz: number): number {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

function gauss(x: number, z: number, cx: number, cz: number, sigma: number): number {
  const dx = x - cx;
  const dz = z - cz;
  return Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma));
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Distance from (x,z) to a polyline. */
export function distToPolyline(x: number, z: number, line: XZ[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = line[i].x;
    const az = line[i].z;
    const bx = line[i + 1].x;
    const bz = line[i + 1].z;
    const abx = bx - ax;
    const abz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz || 1)));
    const dx = x - (ax + abx * t);
    const dz = z - (az + abz * t);
    const d = Math.hypot(dx, dz);
    if (d < best) best = d;
  }
  return best;
}

/** Distance from (x,z) to segment a-b. */
export function distToSegment(x: number, z: number, a: XZ, b: XZ): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const t = Math.min(1, Math.max(0, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz || 1)));
  return Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
}

/** Base island height WITHOUT path corridor (river/lake separate). */
function baseHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let h = 5.5 * Math.pow(Math.max(0, 1 - (r / 38) ** 2), 1.5) - 3.5 * smoothstep(32, 42, r);
  h += 1.0 * smoothstep(20, 28, r); // rim lift: start/exit nodes stay dry
  h += (vnoise(x * 0.11 + 7.3, z * 0.11 + 3.1) - 0.5) * 2.4;
  h += (vnoise(x * 0.31 + 1.7, z * 0.31 + 9.2) - 0.5) * 0.7;
  h += 2.5 * gauss(x, z, 8, -14, 7); // hut hill
  h += 1.5 * gauss(x, z, 13, -4, 5); // ladder ridge
  h += 3.5 * gauss(x, z, 12, -9, 3.5); // ladder cliff (keeps ladder non-flat)
  return h;
}

/** Ground height without corridor (base + river + lake). Nodes are baked from the final function. */
function groundHeight(x: number, z: number): number {
  return riverLake(baseHeight(x, z), x, z);
}

function riverLake(h: number, x: number, z: number): number {
  // river carve to bed
  const d = distToPolyline(x, z, W1_RIVER);
  const bed = -1.7;
  if (d < W1_RIVER_HALF) h = bed;
  else if (d < W1_RIVER_HALF + W1_RIVER_BLEND) {
    const t = (d - W1_RIVER_HALF) / W1_RIVER_BLEND;
    const s = t * t * (3 - 2 * t);
    h = bed + (h - bed) * s;
  }
  // lake bowl (blend reaches 1.5r so stage/ hill nodes stay dry)
  const dl = Math.hypot(x - W1_LAKE.x, z - W1_LAKE.z);
  if (dl < W1_LAKE.r) h = -1.8;
  else if (dl < W1_LAKE.r * 1.5) {
    const t = (dl - W1_LAKE.r) / (W1_LAKE.r * 0.5);
    const s = t * t * (3 - 2 * t);
    h = -1.8 + (h + 1.8) * s;
  }
  return h;
}

/** W1 terrain height. Path corridors carve shelves so roads stay on the ground. */
export function w1TerrainHeight(x: number, z: number): number {
  let h = baseHeight(x, z);
  // corridor shelf: continuous shelf along each path (target = chord of ground heights).
  // River/lake carve afterwards so water still wins at the crossing.
  // Nearest path wins so overlapping blend zones don't overwrite each other.
  let bestD = Infinity;
  let bestT = 0;
  let bestA = W1_LAYOUT.n0;
  let bestB = W1_LAYOUT.n0;
  for (const [ida, idb] of W1_PATH_PAIRS) {
    const a = W1_LAYOUT[ida];
    const b = W1_LAYOUT[idb];
    const c = closestOnSegment(x, z, a, b);
    if (c.d < bestD) {
      bestD = c.d;
      bestT = c.t;
      bestA = a;
      bestB = b;
    }
  }
  if (bestD < W1_CORRIDOR_HALF + W1_CORRIDOR_BLEND) {
    const target =
      groundHeight(bestA.x, bestA.z) * (1 - bestT) + groundHeight(bestB.x, bestB.z) * bestT;
    if (bestD < W1_CORRIDOR_HALF) h = target;
    else {
      const s = smoothstep(W1_CORRIDOR_HALF, W1_CORRIDOR_HALF + W1_CORRIDOR_BLEND, bestD);
      h = target + (h - target) * s;
    }
  }
  // river/lake carve afterwards so water still wins at the crossing
  return riverLake(h, x, z);
}

/** W1 path pairs (must match world1_graph.json topology; drift is caught by burial tests). */
const W1_PATH_PAIRS: [keyof typeof W1_LAYOUT, keyof typeof W1_LAYOUT][] = [
  ['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3a'], ['n3a', 'n3b'], ['n3b', 'n4'],
  ['n4', 'n5a'], ['n4', 'n5c'], ['n5c', 'n5d'], ['n5d', 'n6'], ['n5a', 'n5b'],
  ['n5b', 'n6'], ['n5b', 'n5d'], ['n6', 'n7'], ['n7', 'n8'], ['n8', 'n9'],
  ['n9', 'n10'], ['n10', 'n11'],
];

/** Path corridor half-width (fully carved shelf) and blend range. */
const W1_CORRIDOR_HALF = 2.2;
const W1_CORRIDOR_BLEND = 2.3;

/** New W1 node layout (same ids/kinds/stages as before, wider island). y is filled by generator. */
export const W1_LAYOUT: Record<string, { x: number; z: number }> = {
  n0: { x: -24, z: 18 },
  n1: { x: -17, z: 17 },
  n2: { x: -11, z: 13 },
  n3a: { x: -8, z: 9 },
  n3b: { x: 2, z: 5 },
  n4: { x: 8, z: 2 },
  n5a: { x: 10, z: -4 },
  n5c: { x: 14, z: -1 },
  n5d: { x: 13, z: -8 },
  n5b: { x: 9, z: -12 },
  n6: { x: 7, z: -18 },
  n7: { x: 12, z: -20 },
  n8: { x: 17, z: -20 },
  n9: { x: 12, z: -25 },
  n10: { x: 4, z: -26 },
  n11: { x: -6, z: -25 },
};
