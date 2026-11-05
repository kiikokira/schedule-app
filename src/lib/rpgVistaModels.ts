import * as THREE from 'three'

/**
 * W1草原用のオリジナル・ランドマーク（プロシージャル）。
 * 任天堂等の既存デザインの複製は含まない。
 */

/** 風車小屋。userData.blades に回転対象の羽根グループを格納する。 */
export function buildWindmill(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'VistaWindmill'
  const stone = new THREE.MeshBasicMaterial({ color: '#9aa3b2' })
  const wood = new THREE.MeshBasicMaterial({ color: '#b0894f' })
  const roofMat = new THREE.MeshBasicMaterial({ color: '#c25a4a' })
  const bladeMat = new THREE.MeshBasicMaterial({ color: '#f2e6c8' })

  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 1.6, 8), stone)
  base.name = 'MillBase'
  base.position.y = 0.8
  g.add(base)

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 5.2, 8), wood)
  tower.name = 'MillTower'
  tower.position.y = 1.6 + 2.6
  g.add(tower)

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.8, 8), roofMat)
  roof.name = 'MillRoof'
  roof.position.y = 1.6 + 5.2 + 0.9
  g.add(roof)

  const hubY = 1.6 + 4.4
  const blades = new THREE.Group()
  blades.name = 'MillBlades'
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.4, 0.12), bladeMat)
    const a = (i / 4) * Math.PI * 2
    blade.position.set(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0)
    blade.rotation.z = a - Math.PI / 2
    blades.add(blade)
  }
  blades.position.set(0, hubY, 1.55)
  g.add(blades)
  g.userData.blades = blades
  return g
}

/** 気球。ゆっくり周回させる想定。 */
export function buildBalloon(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'VistaBalloon'
  const envelope = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 14, 12),
    new THREE.MeshBasicMaterial({ color: '#f2a541' }),
  )
  envelope.name = 'BalloonEnvelope'
  envelope.scale.y = 1.15
  g.add(envelope)
  const band = new THREE.Mesh(
    new THREE.SphereGeometry(2.24, 14, 6, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.16),
    new THREE.MeshBasicMaterial({ color: '#f7e8c8' }),
  )
  band.scale.y = 1.15
  g.add(band)
  const basket = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.9, 1.1),
    new THREE.MeshBasicMaterial({ color: '#7a4e22' }),
  )
  basket.name = 'BalloonBasket'
  basket.position.y = -3.4
  g.add(basket)
  const ropeMat = new THREE.MeshBasicMaterial({ color: '#5b3a1a' })
  for (const [rx, rz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]] as const) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4), ropeMat)
    rope.position.set(rx, -2.5, rz)
    g.add(rope)
  }
  return g
}
