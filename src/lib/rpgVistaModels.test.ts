import { describe, it, expect } from 'vitest'
import { buildWindmill, buildBalloon } from './rpgVistaModels'

describe('rpgVistaModels (original W1 landmarks)', () => {
  it('builds a windmill group with tower, roof and 4 blades', () => {
    const g = buildWindmill()
    expect(g.name).toBe('VistaWindmill')
    expect(g.getObjectByName('MillTower')).toBeTruthy()
    expect(g.getObjectByName('MillRoof')).toBeTruthy()
    const blades = g.getObjectByName('MillBlades')
    expect(blades).toBeTruthy()
    expect(blades!.children).toHaveLength(4)
    expect(g.userData.blades).toBe(blades)
  })

  it('builds a balloon group with envelope and basket', () => {
    const g = buildBalloon()
    expect(g.name).toBe('VistaBalloon')
    expect(g.getObjectByName('BalloonEnvelope')).toBeTruthy()
    expect(g.getObjectByName('BalloonBasket')).toBeTruthy()
  })
})
