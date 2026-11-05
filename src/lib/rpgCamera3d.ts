/** 追従カメラの地形めり込み補正（純粋関数）。 */

/** 注視点方向へ戻すマージン(m)。 */
export const CAMERA_COLLISION_MARGIN = 0.6

/** overviewの基準画角(度)。RpgWorld3dのPerspectiveCamera(55)と一致させる。 */
export const CAMERA_FOV_DEG = 55

/** overviewの基準仰角。従来値(0,27,16)->(0.5,0,-1)の方向を維持する。 */
const OVERVIEW_DIR: Vec3Tuple = [0, 27 / Math.hypot(27, 17), 17 / Math.hypot(27, 17)]

export type FramingNode = { x: number; y: number; z: number }

export type WorldFraming = {
  /** ワールド中心（グラフbounds基準） */
  center: [number, number, number]
  /** ワールド半径（半幅の最大、最低4m） */
  radius: number
  /** overviewの注視点（ワールド中心） */
  overviewLook: [number, number, number]
  /** overviewのカメラ位置（aspect=16/10基準。狭い画面は overviewDistance で再計算） */
  overviewPos: [number, number, number]
  /** followカメラの後方距離（キャラ中心固定・全ワールド共通） */
  followBack: number
  /** followカメラの高さ */
  followUp: number
  /** follow注視点の前方距離 */
  followFwd: number
  /** follow注視点の高さ */
  followLookUp: number
}

export type FollowPose = {
  /** キャラ位置 */
  pos: [number, number, number]
  /** キャラyaw */
  yaw: number
}

/**
 * 追従カメラの目標位置/注視点（純粋関数。tick内の計算と同一）。
 * キャラ後方から見下ろし、キャラを画角中央付近に保つ。
 */
export function followCameraTargets(
  pose: FollowPose,
  frame: WorldFraming,
): { camPos: [number, number, number]; camLook: [number, number, number] } {
  const fx = Math.sin(pose.yaw + Math.PI)
  const fz = Math.cos(pose.yaw + Math.PI)
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  return {
    camPos: [
      clamp(pose.pos[0] - fx * frame.followBack, frame.center[0] - 16, frame.center[0] + 16),
      Math.max(2.5, pose.pos[1] + frame.followUp),
      clamp(pose.pos[2] - fz * frame.followBack, frame.center[2] - 15, frame.center[2] + 15),
    ],
    camLook: [
      pose.pos[0] + fx * frame.followFwd,
      pose.pos[1] + frame.followLookUp,
      pose.pos[2] + fz * frame.followFwd,
    ],
  }
}

/**
 * ワールド全体が画面に収まる距離。半径rの球が画角に収まる距離r/sin(halfMin)に余裕を掛けたもの。
 */
export function overviewDistance(
  radius: number,
  aspect: number,
  fovDeg: number = CAMERA_FOV_DEG,
  margin: number = 1.18,
): number {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 10
  const tanV = Math.tan((fovDeg * Math.PI) / 360)
  const halfMin = Math.min(Math.atan(tanV), Math.atan(tanV * a))
  return (Math.max(1, radius) / Math.sin(halfMin)) * margin
}

/**
 * グラフのノードboundsからカメラのフレーミングを求める（純粋関数）。
 * 固定マジック数値(0,27,16等)の代わりにワールド実寸から決めることで、
 * 空だけ・地形が隅に小さい表示を構造的に起こさない。
 */
export function fitCameraToBounds(
  nodes: FramingNode[],
  opts?: { aspect?: number; fovDeg?: number },
): WorldFraming {
  const aspect = opts?.aspect ?? 16 / 10
  const fovDeg = opts?.fovDeg ?? CAMERA_FOV_DEG
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const n of nodes) {
    if (minX > n.x) minX = n.x
    if (maxX < n.x) maxX = n.x
    if (minY > n.y) minY = n.y
    if (maxY < n.y) maxY = n.y
    if (minZ > n.z) minZ = n.z
    if (maxZ < n.z) maxZ = n.z
  }
  if (!Number.isFinite(minX)) {
    minX = -12
    maxX = 12
    minY = -2
    maxY = 6
    minZ = -12
    maxZ = 12
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const cz = (minZ + maxZ) / 2
  // 半径はboundsの半対角（コーナーまで収める）。最低4m。
  const radius = Math.max(Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2, 4)
  const dist = overviewDistance(radius, aspect, fovDeg)
  const overviewPos: [number, number, number] = [
    cx + OVERVIEW_DIR[0] * dist,
    cy + OVERVIEW_DIR[1] * dist,
    cz + OVERVIEW_DIR[2] * dist,
  ]
  // 追従カメラはキャラを見失わない固定距離（ワールドの大きさに連動させない）
  return {
    center: [cx, cy, cz],
    radius,
    overviewLook: [cx, cy, cz],
    overviewPos,
    followBack: 9,
    followUp: 5.5,
    followFwd: 3,
    followLookUp: 0.8,
  }
}

export type Vec3Tuple = readonly [number, number, number]

/** タップとみなす条件（ドラッグとの判別用）。UIとテストの共通契約。 */
export const TAP_MAX_MOVE_PX = 8
export const TAP_MAX_MS = 600

/** 短い・小さいポインタ操作だけをタップ選択にする。 */
export function isTapGesture(moved: boolean, durationMs: number): boolean {
  return !moved && durationMs < TAP_MAX_MS
}

export type OrbitOffset = {
  /** 注視点回りの水平旋回角（ラジアン） */
  yaw: number
  /** カメラ高さの加算（m） */
  pitch: number
  /** 注視点からの距離倍率 */
  zoom: number
}

/**
 * 自由視点の適用（純粋関数）。注視点を中心にカメラ位置を旋回・拡縮する。
 * 注視点は動かさない。カメラが注視点の高さ以下に落ちないよう下限を守る。
 */
export function orbitView(
  pos: [number, number, number],
  look: [number, number, number],
  offset: OrbitOffset,
): { pos: [number, number, number]; look: [number, number, number] } {
  const zoom = Math.min(2.2, Math.max(0.6, offset.zoom))
  const dx = pos[0] - look[0]
  const dy = pos[1] - look[1]
  const dz = pos[2] - look[2]
  const cos = Math.cos(offset.yaw)
  const sin = Math.sin(offset.yaw)
  const h = Math.hypot(dx, dz) * zoom
  const dist = Math.hypot(dx, dz) || 1
  const nx = (dx * cos - dz * sin) / dist
  const nz = (dx * sin + dz * cos) / dist
  const y = Math.max(look[1] + 1.5, look[1] + dy * zoom + offset.pitch)
  return { pos: [look[0] + nx * h, y, look[2] + nz * h], look: [look[0], look[1], look[2]] }
}

/**
 * 注視点→希望カメラ位置のレイが地形にヒットした場合、希望位置を
 * 「ヒット点から注視点方向へ margin 戻した位置」に寄せる。
 * - hitDistance が null / 希望距離以上なら補正なし（従来通り desired を返す）
 * - ヒットが注視点至近で margin を引くと0以下になる場合は注視点に寄せる（裏返り防止）
 * - look と desired がほぼ一致する場合は desired をそのまま返す
 */
export function resolveCameraCollision(
  look: Vec3Tuple,
  desired: Vec3Tuple,
  hitDistance: number | null,
  margin: number = CAMERA_COLLISION_MARGIN,
): [number, number, number] {
  const dx = desired[0] - look[0]
  const dy = desired[1] - look[1]
  const dz = desired[2] - look[2]
  const want = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (want < 1e-6) return [desired[0], desired[1], desired[2]]
  if (hitDistance === null || Number.isNaN(hitDistance) || hitDistance >= want) {
    return [desired[0], desired[1], desired[2]]
  }
  const corrected = hitDistance - margin
  if (corrected <= 0) return [look[0], look[1], look[2]]
  const s = corrected / want
  return [look[0] + dx * s, look[1] + dy * s, look[2] + dz * s]
}
