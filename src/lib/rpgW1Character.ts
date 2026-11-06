import * as THREE from 'three'

// W1専用 procedural 冒険者（GLB不使用・絵文字不使用・既存キャラ非模倣）。
// 頭・胴・腕・脚の関節グループを持ち、tick側の時間駆動で待機/歩行を表現する。

export type W1Anim = 'idle' | 'walk' | 'run' | 'turn' | 'arrive'

export type W1Adventurer = {
  group: THREE.Group
  refs: {
    body: THREE.Object3D
    head: THREE.Group
    armL: THREE.Group
    armR: THREE.Group
    legL: THREE.Group
    legR: THREE.Group
  }
}

function mat(color: string, roughness = 0.8): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 })
}

export function buildW1Adventurer(): W1Adventurer {
  const group = new THREE.Group()
  const skin = mat('#f2c89b')
  const tunic = mat('#3f8f4f')
  const belt = mat('#7a4e2e')
  const boots = mat('#5a3a22')
  const hat = mat('#2f6e3e')

  const body = new THREE.Group()
  group.add(body)

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 6, 12), tunic)
  torso.position.y = 1.05
  torso.castShadow = true
  body.add(torso)

  const beltM = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12), belt)
  beltM.position.y = 0.85
  body.add(beltM)

  const head = new THREE.Group()
  head.position.y = 1.75
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), skin)
  skull.castShadow = true
  head.add(skull)
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.35, 12), hat)
  cap.position.y = 0.28
  cap.castShadow = true
  head.add(cap)
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16), hat)
  brim.position.y = 0.12
  head.add(brim)
  // 目（遠方視認用のシンプルな2点）
  const eyeM = mat('#223322', 0.6)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeM)
    eye.position.set(0.1 * s, 0.02, 0.23)
    head.add(eye)
  }
  body.add(head)

  const mkLimb = (upperColor: THREE.Material, len: number, r: number) => {
    const pivot = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), upperColor)
    mesh.position.y = -len / 2
    mesh.castShadow = true
    pivot.add(mesh)
    return pivot
  }

  const armL = mkLimb(tunic, 0.42, 0.11)
  armL.position.set(-0.42, 1.3, 0)
  body.add(armL)
  const armR = mkLimb(tunic, 0.42, 0.11)
  armR.position.set(0.42, 1.3, 0)
  body.add(armR)

  const legL = mkLimb(boots, 0.5, 0.13)
  legL.position.set(-0.16, 0.72, 0)
  body.add(legL)
  const legR = mkLimb(boots, 0.5, 0.13)
  legR.position.set(0.16, 0.72, 0)
  body.add(legR)

  // 足元影（blob shadow＋Directional影の二重で接地を強調）
  const shadowTex = (() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30)
    g.addColorStop(0, 'rgba(0,0,0,0.35)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    const t = new THREE.CanvasTexture(c)
    return t
  })()
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  )
  blob.rotation.x = -Math.PI / 2
  blob.position.y = 0.03
  group.add(blob)

  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.matrixAutoUpdate = true
  })
  return { group, refs: { body, head, armL, armR, legL, legR } }
}

/** tick駆動のアニメ更新。phaseは移動状態、tは経過秒。 */
export function updateW1Adventurer(a: W1Adventurer, anim: W1Anim, t: number): void {
  const { body, head, armL, armR, legL, legR } = a.refs
  if (anim === 'idle' || anim === 'arrive') {
    const b = Math.sin(t * 2.2) * 0.03
    body.position.y = b
    body.rotation.y = Math.sin(t * 0.6) * 0.08
    head.rotation.y = Math.sin(t * 0.45) * 0.35
    armL.rotation.x = Math.sin(t * 2.2) * 0.06
    armR.rotation.x = -Math.sin(t * 2.2) * 0.06
    legL.rotation.x = 0
    legR.rotation.x = 0
  } else if (anim === 'turn') {
    body.rotation.y = Math.sin(t * 9) * 0.12
    armL.rotation.x = 0.25
    armR.rotation.x = -0.25
    legL.rotation.x = 0.15
    legR.rotation.x = -0.15
  } else {
    const freq = anim === 'run' ? 11 : 8
    const amp = anim === 'run' ? 0.7 : 0.55
    const s = Math.sin(t * freq)
    legL.rotation.x = s * amp
    legR.rotation.x = -s * amp
    armL.rotation.x = -s * amp * 0.8
    armR.rotation.x = s * amp * 0.8
    body.position.y = Math.abs(Math.cos(t * freq)) * 0.05
    body.rotation.y = 0
    head.rotation.y = 0
  }
}
