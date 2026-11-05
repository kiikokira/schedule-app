import { describe, it, expect } from 'vitest'
import {
  resolveCameraCollision,
  CAMERA_COLLISION_MARGIN,
  fitCameraToBounds,
  overviewDistance,
} from './rpgCamera3d'

const graphModules = import.meta.glob('../../artifacts/3d/world*_graph.json', { eager: true }) as Record<
  string,
  { default: { nodes: { id: string; x: number; y: number; z: number }[] } }
>

function sub(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
function norm(a: number[]): number[] {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** 全ノードが画角（NDC±0.98）に入るか。near=0.1 */
function allNodesInFrame(
  nodes: { x: number; y: number; z: number }[],
  pos: [number, number, number],
  look: [number, number, number],
  aspect: number,
  fovDeg: number,
): boolean {
  const f = norm(sub(look, pos))
  const r = norm(cross(f, [0, 1, 0]))
  const u = cross(r, f)
  const tanV = Math.tan((fovDeg * Math.PI) / 360)
  const tanH = tanV * aspect
  return nodes.every((n) => {
    const v = [n.x - pos[0], n.y - pos[1], n.z - pos[2]]
    const z = dot(v, f)
    if (z < 0.1) return false
    return Math.abs(dot(v, r) / z) <= tanH * 0.98 && Math.abs(dot(v, u) / z) <= tanV * 0.98
  })
}

describe('resolveCameraCollision', () => {
  it('returns desired when there is no hit', () => {
    expect(resolveCameraCollision([0, 1, 0], [0, 5, 9], null)).toEqual([0, 5, 9])
  })

  it('returns desired when hit is beyond the desired distance (no regression)', () => {
    // look(0,0,0)->desired(3,4,0) = 5m。ヒット6mはカメラより遠いので補正なし
    expect(resolveCameraCollision([0, 0, 0], [3, 4, 0], 6)).toEqual([3, 4, 0])
  })

  it('pulls the camera to hit point minus 0.6m margin', () => {
    expect(CAMERA_COLLISION_MARGIN).toBe(0.6)
    // look(0,0,0)->desired(0,0,10)=10m、ヒット6mなら 5.4m 地点に寄る
    expect(resolveCameraCollision([0, 0, 0], [0, 0, 10], 6)).toEqual([0, 0, 5.4])
  })

  it('clamps to the look point when the hit is too close (no flip behind)', () => {
    expect(resolveCameraCollision([1, 2, 3], [1, 2, 13], 0.3)).toEqual([1, 2, 3])
  })

  it('returns desired when look equals desired', () => {
    expect(resolveCameraCollision([1, 1, 1], [1, 1, 1], 0.5)).toEqual([1, 1, 1])
  })
})

describe('fitCameraToBounds (world fills the frame)', () => {
  const worlds = Object.entries(graphModules).map(([file, mod]) => ({
    file,
    nodes: mod.default.nodes,
  }))

  it('fits every node of all 9 worlds in landscape frames', () => {
    expect(worlds).toHaveLength(9)
    for (const { file, nodes } of worlds) {
      const fit = fitCameraToBounds(nodes, { aspect: 16 / 10 })
      expect(
        allNodesInFrame(nodes, fit.overviewPos, fit.overviewLook, 16 / 10, 55),
        `${file} nodes outside overview frame`,
      ).toBe(true)
    }
  })

  it('fits every node of all 9 worlds in narrow frames', () => {
    for (const { file, nodes } of worlds) {
      for (const aspect of [1.0, 0.75]) {
        const fit = fitCameraToBounds(nodes, { aspect })
        expect(
          allNodesInFrame(nodes, fit.overviewPos, fit.overviewLook, aspect, 55),
          `${file} aspect=${aspect} nodes outside frame`,
        ).toBe(true)
      }
    }
  })

  it('keeps follow distances in a playable range for all worlds', () => {
    for (const { file, nodes } of worlds) {
      const fit = fitCameraToBounds(nodes, { aspect: 16 / 10 })
      expect(fit.followBack, file).toBeGreaterThanOrEqual(6)
      expect(fit.followBack, file).toBeLessThanOrEqual(14)
      expect(fit.radius, file).toBeGreaterThan(0)
    }
  })

  it('overviewDistance grows when the frame narrows', () => {
    const wide = overviewDistance(10, 16 / 10)
    const narrow = overviewDistance(10, 0.75)
    expect(narrow).toBeGreaterThan(wide)
  })
})
