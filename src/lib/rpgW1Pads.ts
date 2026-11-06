import * as THREE from 'three'
import { w1TerrainHeight } from './rpgWorldGen'
import type { W1StageStatus } from './rpgW1Stages'

export const W1_PAD_COLORS: Record<W1StageStatus, string> = {
  cleared: '#2f7bff',
  next: '#ef2d2d',
  locked: '#9aa3b2',
}

const INNER = '#c9a06a'

function disc(r: number, h: number, color: string, y: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, h, 28)
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  const m = new THREE.Mesh(geo, mat)
  m.position.y = y
  m.receiveShadow = true
  return m
}

/** 円形台座（外周リング＋内側敷石＋中央マーク）。中心はローカル原点。 */
export function buildW1StopPad(status: W1StageStatus, radius: number): THREE.Group {
  const g = new THREE.Group()
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.35, radius, 40),
    new THREE.MeshStandardMaterial({ color: W1_PAD_COLORS[status], roughness: 0.7, side: THREE.DoubleSide }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.09
  g.add(ring)
  g.add(disc(radius - 0.35, 0.08, INNER, 0.05))
  const center =
    status === 'locked'
      ? disc(0.28, 0.5, W1_PAD_COLORS.locked, 0.3)
      : disc(0.42, 0.12, W1_PAD_COLORS[status], 0.12)
  g.add(center)
  return g
}

/** 台座の接地Y（地形＋0.05）。 */
export function w1PadY(x: number, z: number): number {
  return w1TerrainHeight(x, z) + 0.05
}
