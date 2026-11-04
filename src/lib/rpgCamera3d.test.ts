import { describe, it, expect } from 'vitest'
import { resolveCameraCollision, CAMERA_COLLISION_MARGIN } from './rpgCamera3d'

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
