import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildWorld1Terrain } from './rpgWorld1Terrain'
import { normalizeW3Graph, pathLength3d, samplePath3d, type W3Graph } from './rpgWorld3d'
import { w1TerrainHeight } from './rpgWorldGen'
import realGraphJson from '../../artifacts/3d/world1_graph.json'

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
})
