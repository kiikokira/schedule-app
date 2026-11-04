/** 追従カメラの地形めり込み補正（純粋関数）。 */

/** 注視点方向へ戻すマージン(m)。 */
export const CAMERA_COLLISION_MARGIN = 0.6

export type Vec3Tuple = readonly [number, number, number]

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
