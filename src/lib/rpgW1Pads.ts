import * as THREE from 'three'
import { w1TerrainHeight } from './rpgWorldGen'
import type { W1StageStatus } from './rpgW1Stages'
import { W1_YELLOW_RING, W1_FUTURE_CENTER, type W1VisualStatus } from './rpgW1Visual'

export const W1_PAD_COLORS: Record<W1StageStatus, string> = {
  cleared: '#2f7bff',
  next: '#ef2d2d',
  locked: '#9aa3b2',
}

export const W1_PAD_COLORS_EXT: Record<W1VisualStatus, string> = {
  cleared: '#2f7bff',
  next: '#ef2d2d',
  future: '#20242c',
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

export function buildW1StopPadV3(status: W1VisualStatus, radius: number): THREE.Group {
  const g = buildW1StopPad(status === 'future' ? 'locked' : status, radius)
  const outer = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 0.28, 48),
    new THREE.MeshStandardMaterial({ color: W1_YELLOW_RING, roughness: 0.6, side: THREE.DoubleSide }),
  )
  outer.rotation.x = -Math.PI / 2
  outer.position.y = 0.09
  g.add(outer)
  if (status === 'future') {
    // children[0]=ring, children[1]=inner dirt, children[2]=center, children[3]=yellow outer.
    // Direct refs (no getStyle string compare — brittle across three versions).
    for (const idx of [0, 2]) {
      const m = g.children[idx]
      if (m instanceof THREE.Mesh && m.material instanceof THREE.MeshStandardMaterial) {
        m.material.color.set(W1_FUTURE_CENTER)
      }
    }
  }
  return g
}
