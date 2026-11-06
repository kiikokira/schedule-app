import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { W3Graph } from './rpgWorld3d'
import { w3NodeById } from './rpgWorld3d'
import { w1TerrainHeight } from './rpgWorldGen'

// W1追加装飾：島の厚み（側面）＋最終塔・中間砦。
// 既存 buildWorld1Terrain は触らず、RpgWorld3d のW1分岐で add する。

function paint(geo: THREE.BufferGeometry, c: THREE.Color): THREE.BufferGeometry {
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

/** 島の側面：上が草、下が土→岩の逆円錐スカート。 */
export function buildW1IslandSkirt(): THREE.Mesh {
  const top = new THREE.CylinderGeometry(46, 30, 9, 24, 1, true)
  top.translate(0, -4.2, 0)
  paint(top, new THREE.Color('#8a6b45'))
  const bottom = new THREE.ConeGeometry(30, 12, 24)
  bottom.rotateX(Math.PI)
  bottom.translate(0, -14, 0)
  paint(bottom, new THREE.Color('#6b5a4a'))
  const geo = mergeGeometries([top, bottom])!
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
  )
  mesh.receiveShadow = true
  return mesh
}

function towerAt(x: number, z: number, scale: number, roofColor: string): THREE.Group {
  const g = new THREE.Group()
  const y = w1TerrainHeight(x, z)
  const stone = new THREE.Color('#cfd6e4')
  const stoneD = new THREE.Color('#9aa3b8')
  const roof = new THREE.Color(roofColor)
  const parts: THREE.BufferGeometry[] = []
  const base = new THREE.CylinderGeometry(1.6 * scale, 2.0 * scale, 4.2 * scale, 10)
  base.translate(0, 2.1 * scale, 0)
  parts.push(paint(base, stone))
  const trim = new THREE.CylinderGeometry(1.75 * scale, 1.75 * scale, 0.4 * scale, 10)
  trim.translate(0, 4.3 * scale, 0)
  parts.push(paint(trim, stoneD))
  const cap = new THREE.ConeGeometry(2.1 * scale, 1.8 * scale, 10)
  cap.translate(0, 5.4 * scale, 0)
  parts.push(paint(cap, roof))
  const door = new THREE.BoxGeometry(0.9 * scale, 1.6 * scale, 0.2)
  door.translate(0, 0.9 * scale, 1.85 * scale)
  parts.push(paint(door, new THREE.Color('#4a3320')))
  const m = new THREE.Mesh(
    mergeGeometries(parts)!,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  )
  m.castShadow = true
  m.receiveShadow = true
  g.add(m)
  g.position.set(x, y, z)
  return g
}

/** 最終塔（n11）＋中間砦（n10）を配置。向きは進行方向へ。 */
export function buildW1Forts(g: W3Graph): THREE.Group {
  const root = new THREE.Group()
  try {
    const n11 = w3NodeById(g, 'n11')
    const n10 = w3NodeById(g, 'n10')
    const fort = towerAt(n11.x, n11.z, 1.15, '#5a4a8a')
    root.add(fort)
    const mid = towerAt(n10.x + 1.8, n10.z + 0.6, 0.7, '#c65f45')
    root.add(mid)
  } catch {
    /* graphなしでも落とさない */
  }
  return root
}
