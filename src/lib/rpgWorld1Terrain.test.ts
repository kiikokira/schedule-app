import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildWorld1Terrain } from './rpgWorld1Terrain'
import { normalizeW3Graph, pathLength3d, samplePath3d, type W3Graph } from './rpgWorld3d'
import { w1TerrainHeight } from './rpgWorldGen'
import realGraphJson from '../../artifacts/3d/world1_graph.json'
import v3GraphJson from '../../public/rpg/world1_v3_graph.json'

// Blender build_world1_isle.py H/H_base/coast_rn port (Task5 baked y = H+0.05).
// sstep mirrors wkit.sstep.
function sstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const CX = -3.0
const CY = -5.0
const RX = 30.0
const RY = 33.0
const BAY_TH = -1.71
const BAY_A = 0.35
const BAY_W = 0.35
const RIVER: Array<[number, number]> = [
  [-1, 12], [-2, 4.5], [0, -1], [2, -5], [4, -9], [5, -12],
  [4, -15], [3.5, -18], [4, -21], [6, -23.5], [6, -27],
]
const RCARVE = [0.8, 2.2, 1.7] as const
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax
  const vz = bz - az
  const L2 = vx * vx + vz * vz
  const t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / L2))
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz))
}
function riverDist(x: number, z: number): number {
  let m = Infinity
  for (let i = 0; i < RIVER.length - 1; i++) {
    m = Math.min(m, segDist(x, z, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1]))
  }
  return m
}
function coastRn(x: number, z: number): number {
  const dx = (x - CX) / RX
  const dz = (z - CY) / RY
  const th = Math.atan2(z - CY, x - CX)
  const dth = ((th - BAY_TH + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
  const pinch = BAY_A * Math.exp(-((dth / BAY_W) ** 2))
  const wob = 1.0 + 0.025 * Math.sin(3 * th + 1.0) + 0.015 * Math.sin(5 * th + 2.5)
  return (dx * dx + dz * dz + pinch) / (wob * wob)
}
function Hbase(x: number, z: number): number {
  let h = 3.0
  h += 0.5 * Math.sin(x * 0.3 + 1.0) * Math.cos(z * 0.28)
  h += 0.25 * Math.sin(x * 0.7 + z * 0.4 + 0.7)
  const dmid = Math.hypot(x - 2.0, z - 2.0)
  h += 2.5 * (1.0 - sstep(8.0, 11.0, dmid))
  const dupp = Math.hypot(x - 12.0, z + 13.0)
  h += 6.0 * (1.0 - sstep(5.5, 9.5, dupp))
  const rn = coastRn(x, z)
  if (rn > 1.0) h -= (rn - 1.0) * 35.0
  return h
}
function blenderH(x: number, z: number): number {
  let h = Hbase(x, z)
  const d = riverDist(x, z)
  h -= RCARVE[2] * (1.0 - sstep(RCARVE[0], RCARVE[1], d))
  return h
}

describe('buildWorld1Terrain smoke', () => {
  const g = normalizeW3Graph(realGraphJson as unknown as W3Graph)
  const root = buildWorld1Terrain(g)

  it('builds a non-empty island group', () => {
    expect(root.children.length).toBeGreaterThanOrEqual(10)
  })

  it('has a terrain mesh spanning the new island', () => {
    const terrain = root.children.find(
      (o) => o instanceof THREE.Mesh && (o.material as THREE.Material).name === 'W1_Terrain',
    ) as THREE.Mesh | undefined
    expect(terrain).toBeDefined()
    terrain!.geometry.computeBoundingBox()
    const bb = terrain!.geometry.boundingBox!
    expect(bb.max.x - bb.min.x).toBeGreaterThan(60)
    expect(bb.max.z - bb.min.z).toBeGreaterThan(60)
  })

  it('contains no NaN vertices anywhere', () => {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) {
        const pos = (o as THREE.Mesh).geometry?.attributes?.position as THREE.BufferAttribute | undefined
        if (!pos) return
        for (let i = 0; i < pos.count; i++) {
          expect(Number.isNaN(pos.getX(i))).toBe(false)
          expect(Number.isNaN(pos.getY(i))).toBe(false)
          expect(Number.isNaN(pos.getZ(i))).toBe(false)
        }
      }
    })
  })

  it('road ribbons stay near the terrain (no deep burial / high float)', () => {
    const g = normalizeW3Graph(realGraphJson as unknown as W3Graph)
    let worstSink = 0
    let worstFloat = 0
    for (const p of g.paths) {
      // ジャンプは滑走路として描く（実装 buildWorld1Terrain と同一条件）
      const runway = p.kind === 'jump' ? { ...p, kind: 'walk' as const, arcHeight: 0 } : p
      const len = pathLength3d(g, p.id, p.from)
      for (let i = 0; i <= 14; i++) {
        const pose = samplePath3d(g, runway, p.from, (len * i) / 14, undefined, undefined, len)
        const ribbonY = pose.pos[1] + 0.07
        const th = w1TerrainHeight(pose.pos[0], pose.pos[2])
        worstSink = Math.max(worstSink, th - ribbonY)
        // 橋デッキは渓谷を渡すため浮くのが正解なので除外する
        if (p.kind !== 'bridge') worstFloat = Math.max(worstFloat, ribbonY - th)
      }
    }
    expect(worstSink, 'buried road depth').toBeLessThan(0.5)
    expect(worstFloat, 'floating road height').toBeLessThan(1.6)
  })

  it('places roads (ribbon vertex sanity)', () => {
    // road/wood meshes exist
    let roadVerts = 0
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const n = (o.material as THREE.Material).name
        if (n === 'W1_Road' || n === 'W1_RoadEdge' || n === 'W1_Wood') {
          roadVerts += o.geometry.attributes.position.count
        }
      }
    })
    expect(roadVerts).toBeGreaterThan(100)
  })

  it('v3 all nodes sit on the blender island (y ≈ H+0.05 within 0.6)', () => {
    const g = normalizeW3Graph(v3GraphJson as unknown as W3Graph)
    expect(g.nodes).toHaveLength(16)
    for (const n of g.nodes) {
      expect(Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)).toBe(true)
      const h = blenderH(n.x, n.z)
      expect(Math.abs(n.y - (h + 0.05))).toBeLessThan(0.6)
    }
  })
})
