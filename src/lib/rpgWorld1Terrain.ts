// W1 grassland: fully procedural island replacing the Blender GLB.
// Original low-poly design. Playable graph drives roads/props so the
// character always stays grounded on the visuals.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './rpgVista';
import { w1TerrainHeight, distToPolyline, W1_RIVER, W1_LAKE } from './rpgWorldGen';
import { pathLength3d, samplePath3d, w3NodeById, type W3Graph, type W3Path } from './rpgWorld3d';

const DIRT = new THREE.Color('#c9a06a');
const DIRT_EDGE = new THREE.Color('#8a6b45');
const WOOD = new THREE.Color('#8a5f36');
const WOOD_DARK = new THREE.Color('#6b4a2a');
const GRASS_A = new THREE.Color('#6fb457');
const GRASS_B = new THREE.Color('#5da94e');
const SAND = new THREE.Color('#d9c184');
const ROCK = new THREE.Color('#8d8d94');
const CREAM = new THREE.Color('#f5e6c8');
const ROOF = new THREE.Color('#c65f45');
const LEAF = new THREE.Color('#3f9e4d');
const LEAF_DARK = new THREE.Color('#35853f');

function paint(geo: THREE.BufferGeometry, c: THREE.Color): THREE.BufferGeometry {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = 0.94 + 0.06 * ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    arr[i * 3] = Math.min(1, c.r * v);
    arr[i * 3 + 1] = Math.min(1, c.g * v);
    arr[i * 3 + 2] = Math.min(1, c.b * v);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function box(w: number, h: number, d: number, c: THREE.Color, x: number, y: number, z: number, ry = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateY(ry);
  g.translate(x, y, z);
  return paint(g, c);
}

function slopeAt(x: number, z: number): number {
  const e = 0.6;
  const dx = w1TerrainHeight(x + e, z) - w1TerrainHeight(x - e, z);
  const dz = w1TerrainHeight(x, z + e) - w1TerrainHeight(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

function buildTerrain(): THREE.Mesh {
  const SIZE = 130;
  const SEG = 120;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = w1TerrainHeight(x, z);
    pos.setY(i, h);
    const s = slopeAt(x, z);
    const dr = distToPolyline(x, z, W1_RIVER);
    const dl = Math.hypot(x - W1_LAKE.x, z - W1_LAKE.z);
    if (h < 0.6 || (dr < 2.6 && h < 1.6) || dl < W1_LAKE.r + 1.2) c.copy(SAND);
    else if (s > 0.55) c.copy(ROCK);
    else {
      c.copy(GRASS_A).lerp(GRASS_B, (Math.sin(x * 0.35) * Math.sin(z * 0.33) + 1) / 2);
      if (dr < 6) c.lerp(new THREE.Color('#4f9e44'), 0.35);
    }
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  mat.name = 'W1_Terrain';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function ribbonGeometry(g: W3Graph, path: W3Path, fromId: string, half: number, lift: number): THREE.BufferGeometry {
  const len = pathLength3d(g, path.id, fromId);
  const pts: THREE.Vector3[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const pose = samplePath3d(g, path, fromId, (len * i) / N, undefined, undefined, len);
    pts.push(new THREE.Vector3(pose.pos[0], pose.pos[1] + lift, pose.pos[2]));
  }
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const p = pts[i];
    const q = pts[Math.min(N, i + 1)];
    const r = pts[Math.max(0, i - 1)];
    let dx = q.x - r.x;
    let dz = q.z - r.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    verts.push(p.x - dz * half, p.y, p.z + dx * half, p.x + dz * half, p.y, p.z - dx * half);
    if (i < N) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const uv = new Float32Array(((N + 1) * 2) * 2);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function buildRoads(g: W3Graph): THREE.Group {
  const group = new THREE.Group();
  const mat = (c: string) =>
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, name: c });
  // Per-path meshes (not merged across paths) so callers can dim only
  // beyond-next segments via `mesh.userData.pathId`. Draw calls grow
  // with path count (~dozens) but stay trivial for W1 scale.
  for (const p of g.paths) {
    const len = pathLength3d(g, p.id, p.from);
    const isBridge = p.kind === 'bridge';
    // jump runway stays on the ground (the character flies the arc above it)
    const ribbonPath = p.kind === 'jump' ? { ...p, kind: 'walk' as const, arcHeight: 0 } : p;
    const w = isBridge ? 1.2 : 1.1;
    const top = ribbonGeometry(g, ribbonPath, p.from, w, 0.07);
    paint(top, isBridge ? WOOD : DIRT);
    const topMesh = new THREE.Mesh(
      mergeGeometries([top])!,
      mat(isBridge ? 'W1_Wood' : 'W1_Road'),
    );
    topMesh.userData.pathId = p.id;
    topMesh.receiveShadow = true;
    if (isBridge) topMesh.castShadow = true;
    group.add(topMesh);
    if (!isBridge) {
      const skirt = ribbonGeometry(g, ribbonPath, p.from, w + 0.45, 0.035);
      paint(skirt, DIRT_EDGE);
      const edgeMesh = new THREE.Mesh(mergeGeometries([skirt])!, mat('W1_RoadEdge'));
      edgeMesh.userData.pathId = p.id;
      edgeMesh.receiveShadow = true;
      group.add(edgeMesh);
    } else {
      // bridge posts belong to the same path so the whole bridge dims together
      const posts: THREE.BufferGeometry[] = [];
      const n = Math.max(2, Math.floor(len / 2.5));
      for (let i = 0; i <= n; i++) {
        const pose = samplePath3d(g, p, p.from, (len * i) / n, undefined, undefined, len);
        const dirx = pose.dir[0];
        const dirz = pose.dir[2];
        const px = -dirz;
        const pz = dirx;
        for (const s of [-1, 1]) {
          // 橋脚は河床(-1.7)まで届く長さにする
          posts.push(box(0.24, 5.4, 0.24, WOOD_DARK, pose.pos[0] + px * s * 1.3, pose.pos[1] - 2.2, pose.pos[2] + pz * s * 1.3));
        }
      }
      if (posts.length > 0) {
        const postMesh = new THREE.Mesh(mergeGeometries(posts)!, mat('W1_Wood'));
        postMesh.userData.pathId = p.id;
        postMesh.castShadow = true;
        postMesh.receiveShadow = true;
        group.add(postMesh);
      }
    }
  }
  return group;
}

function facingYaw(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function makeGate(): THREE.Group {
  const g = new THREE.Group();
  const parts = [
    box(0.35, 2.6, 0.35, WOOD, -1.1, 1.3, 0),
    box(0.35, 2.6, 0.35, WOOD, 1.1, 1.3, 0),
    box(2.9, 0.28, 0.42, WOOD_DARK, 0, 2.7, 0),
    box(2.3, 0.2, 0.34, WOOD, 0, 2.3, 0),
  ];
  const m = new THREE.Mesh(
    mergeGeometries(parts)!,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  );
  m.castShadow = true;
  g.add(m);
  return g;
}

function makeHut(): THREE.Group {
  const g = new THREE.Group();
  const parts = [
    box(3.0, 2.2, 2.6, CREAM, 0, 1.1, 0),
    box(1.0, 1.6, 0.1, WOOD_DARK, 0, 0.8, 1.32),
  ];
  const roof = new THREE.ConeGeometry(2.5, 1.6, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(0, 3.0, 0);
  paint(roof, ROOF);
  parts.push(roof);
  const win = new THREE.BoxGeometry(0.7, 0.6, 0.1);
  win.translate(0.9, 1.4, 1.32);
  parts.push(paint(win, new THREE.Color('#bfe6ff')));
  const m = new THREE.Mesh(
    mergeGeometries(parts)!,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return g;
}

function makeLadder(a: THREE.Vector3, b: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-0.5, 0.5]) {
    const rail = new THREE.BoxGeometry(0.14, len, 0.14);
    rail.applyQuaternion(quat);
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(s);
    const mid = a.clone().add(b).multiplyScalar(0.5).add(side);
    rail.translate(mid.x, mid.y, mid.z);
    parts.push(paint(rail, WOOD));
  }
  const rungs = Math.max(3, Math.floor(len / 0.8));
  for (let i = 1; i < rungs; i++) {
    const p = a.clone().lerp(b, i / rungs);
    const rung = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6);
    rung.rotateX(Math.PI / 2);
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const yaw = Math.atan2(side.x, side.z);
    rung.rotateY(yaw);
    rung.translate(p.x, p.y, p.z);
    parts.push(paint(rung, WOOD_DARK));
  }
  const m = new THREE.Mesh(
    mergeGeometries(parts)!,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  );
  m.castShadow = true;
  g.add(m);
  return g;
}

function makeCave(): THREE.Group {
  const g = new THREE.Group();
  const rock = new THREE.Color('#6b7280');
  const dark = new THREE.Color('#3a4356');
  const parts = [
    box(1.1, 3.0, 1.6, rock, -1.6, 1.5, 0),
    box(1.1, 3.0, 1.6, rock, 1.6, 1.5, 0),
    box(4.3, 1.1, 1.7, rock, 0, 3.4, 0),
    box(2.2, 2.6, 0.4, new THREE.Color('#10141d'), 0, 1.3, 0.2),
    box(2.6, 0.5, 1.8, dark, 0, 0.25, 0.6),
  ];
  const m = new THREE.Mesh(
    mergeGeometries(parts)!,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
  m.castShadow = true;
  g.add(m);
  return g;
}

function makeFlag(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.CylinderGeometry(0.09, 0.11, 3.4, 8);
  pole.translate(0, 1.7, 0);
  paint(pole, WOOD_DARK);
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.5, -0.4), new THREE.Vector2(0, -0.8)]);
  const cloth = new THREE.ShapeGeometry(shape);
  cloth.translate(0.1, 3.3, 0);
  paint(cloth, new THREE.Color('#f2b134'));
  const m = new THREE.Mesh(
    mergeGeometries([pole, cloth])!,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
  );
  m.castShadow = true;
  g.add(m);
  return g;
}

type ScatterSpot = { x: number; y: number; z: number; s: number; r: number };

function scatterSpots(
  g: W3Graph,
  count: number,
  seed: number,
  clearance: number,
): ScatterSpot[] {
  const rng = mulberry32(seed);
  const segs = g.paths.map((p) => {
    const a = w3NodeById(g, p.from);
    const b = w3NodeById(g, p.to);
    return { a, b };
  });
  const nodes = g.nodes;
  const out: ScatterSpot[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 60) {
    const a = rng() * Math.PI * 2;
    const r = 4 + rng() * 27;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    let ok = true;
    for (const s of segs) {
      const dx = s.b.x - s.a.x;
      const dz = s.b.z - s.a.z;
      const t = Math.min(1, Math.max(0, ((x - s.a.x) * dx + (z - s.a.z) * dz) / (dx * dx + dz * dz || 1)));
      if (Math.hypot(x - (s.a.x + dx * t), z - (s.a.z + dz * t)) < clearance) {
        ok = false;
        break;
      }
    }
    if (ok) {
      for (const n of nodes) {
        if (Math.hypot(x - n.x, z - n.z) < 2.2) {
          ok = false;
          break;
        }
      }
    }
    if (ok) {
      const y = w1TerrainHeight(x, z);
      if (y < 0.2) ok = false;
      else {
        const e = 0.6;
        const slope =
          Math.hypot(w1TerrainHeight(x + e, z) - w1TerrainHeight(x - e, z), w1TerrainHeight(x, z + e) - w1TerrainHeight(x, z - e)) /
          (2 * e);
        if (slope > 0.85) ok = false;
        else out.push({ x, y, z, s: 0.7 + rng() * 0.9, r: rng() * Math.PI * 2 });
      }
    }
  }
  return out;
}

function instanced(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  spots: ScatterSpot[],
  yOff: number,
  colors?: THREE.Color[],
): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, spots.length);
  const d = new THREE.Object3D();
  spots.forEach((s, i) => {
    d.position.set(s.x, s.y + yOff * s.s, s.z);
    d.rotation.set(0, s.r, 0);
    d.scale.setScalar(s.s);
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
    if (colors) m.setColorAt(i, colors[i % colors.length]);
  });
  m.castShadow = true;
  return m;
}

function buildVegetation(g: W3Graph): THREE.Group {
  const grp = new THREE.Group();
  const rng = mulberry32(99);
  void rng;
  const treeSpots = scatterSpots(g, 44, 101, 2.6);
  const trunk = new THREE.CylinderGeometry(0.22, 0.34, 1.6, 7);
  const trunkMesh = instanced(
    trunk,
    new THREE.MeshStandardMaterial({ color: '#7a4e2e', roughness: 0.9 }),
    treeSpots,
    0.8,
  );
  grp.add(trunkMesh);
  const canopy = new THREE.IcosahedronGeometry(1.5, 1);
  const greens = [LEAF, LEAF_DARK, new THREE.Color('#55b765')];
  const canopyMesh = instanced(
    canopy,
    new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    treeSpots,
    2.4,
    greens,
  );
  // vary canopy color per instance
  const cc = new THREE.Color();
  treeSpots.forEach((_, i) => {
    cc.copy(greens[i % greens.length]).offsetHSL(0, 0, ((i * 37) % 10) / 100 - 0.05);
    canopyMesh.setColorAt(i, cc);
  });
  grp.add(canopyMesh);
  const rockSpots = scatterSpots(g, 24, 202, 2.2);
  const rockMesh = instanced(
    new THREE.DodecahedronGeometry(0.7, 0),
    new THREE.MeshStandardMaterial({ roughness: 0.95 }),
    rockSpots,
    0.2,
    [new THREE.Color('#9aa3b2'), new THREE.Color('#7d8590')],
  );
  grp.add(rockMesh);
  const flowerSpots = scatterSpots(g, 70, 303, 2.2);
  const stemMesh = instanced(
    new THREE.BoxGeometry(0.07, 0.5, 0.07),
    new THREE.MeshStandardMaterial({ color: '#3f9e4d', roughness: 0.9 }),
    flowerSpots,
    0.25,
  );
  grp.add(stemMesh);
  const headMesh = instanced(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    flowerSpots,
    0.55,
    [new THREE.Color('#ff8fb3'), new THREE.Color('#ffd94d'), new THREE.Color('#ffffff')],
  );
  grp.add(headMesh);
  const grassSpots = scatterSpots(g, 150, 404, 2.0);
  const grassMesh = instanced(
    new THREE.ConeGeometry(0.16, 0.7, 5),
    new THREE.MeshStandardMaterial({ color: '#55b765', roughness: 0.9 }),
    grassSpots,
    0.3,
  );
  grp.add(grassMesh);
  return grp;
}

function buildFences(g: W3Graph): THREE.Group {
  const grp = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  const FENCE_PATHS = new Set(['p0', 'p1', 'p2', 'p5']);
  for (const p of g.paths) {
    if (!FENCE_PATHS.has(p.id)) continue;
    const len = pathLength3d(g, p.id, p.from);
    const n = Math.max(2, Math.floor(len / 2.2));
    for (let i = 0; i <= n; i++) {
      const pose = samplePath3d(g, p, p.from, (len * i) / n, undefined, undefined, len);
      const px = -pose.dir[2];
      const pz = pose.dir[0];
      for (const s of [-1.7, 1.7]) {
        const fx = pose.pos[0] + px * s;
        const fz = pose.pos[2] + pz * s;
        // 地面に接地させる
        parts.push(box(0.14, 0.9, 0.14, WOOD, fx, w1TerrainHeight(fx, fz) + 0.45, fz));
      }
    }
  }
  if (parts.length > 0) {
    const m = new THREE.Mesh(
      mergeGeometries(parts)!,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    );
    m.castShadow = true;
    grp.add(m);
  }
  return grp;
}

/** W1 procedural island group. Graph-driven so roads/props match movement. */
export function buildWorld1Terrain(g: W3Graph): THREE.Group {
  const root = new THREE.Group();
  root.add(buildTerrain());
  root.add(buildRoads(g));
  root.add(buildVegetation(g));
  root.add(buildFences(g));
  const n0 = w3NodeById(g, 'n0');
  const n1 = w3NodeById(g, 'n1');
  const gate0 = makeGate();
  gate0.position.set(n0.x, w1TerrainHeight(n0.x, n0.z), n0.z);
  gate0.rotation.y = facingYaw(n0, n1);
  root.add(gate0);
  const n11 = w3NodeById(g, 'n11');
  const n10 = w3NodeById(g, 'n10');
  const gate1 = makeGate();
  gate1.position.set(n11.x, w1TerrainHeight(n11.x, n11.z), n11.z);
  gate1.rotation.y = facingYaw(n11, n10);
  root.add(gate1);
  const n6 = w3NodeById(g, 'n6');
  const hut = makeHut();
  const hutPos = { x: n6.x - 2.5, z: n6.z - 1.5 };
  hut.position.set(hutPos.x, w1TerrainHeight(hutPos.x, hutPos.z), hutPos.z);
  hut.rotation.y = facingYaw(hutPos, n6);
  root.add(hut);
  const n9 = w3NodeById(g, 'n9');
  const n8 = w3NodeById(g, 'n8');
  const cave = makeCave();
  const cyaw = facingYaw(n9, n8);
  cave.position.set(n9.x + Math.sin(cyaw) * 2.4, w1TerrainHeight(n9.x, n9.z), n9.z + Math.cos(cyaw) * 2.4);
  cave.rotation.y = cyaw + Math.PI;
  root.add(cave);
  const p8 = g.paths.find((p) => p.id === 'p8')!;
  const ladLen = pathLength3d(g, 'p8', p8.from);
  const ladA = samplePath3d(g, p8, p8.from, 0, undefined, undefined, ladLen);
  const ladB = samplePath3d(g, p8, p8.from, ladLen, undefined, undefined, ladLen);
  root.add(
    makeLadder(
      new THREE.Vector3(ladA.pos[0], ladA.pos[1] + 0.1, ladA.pos[2]),
      new THREE.Vector3(ladB.pos[0], ladB.pos[1] + 0.1, ladB.pos[2]),
    ),
  );
  const n7 = w3NodeById(g, 'n7');
  const flag = makeFlag();
  flag.position.set(n7.x + 1.5, w1TerrainHeight(n7.x + 1.5, n7.z), n7.z);
  root.add(flag);
  return root;
}
