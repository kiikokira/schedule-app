import { describe, it, expect } from 'vitest'
import { W1_STOPS, stopForNodeId, segmentStops, DWELL_SEC } from './rpgW1Stops'

describe('rpgW1Stops', () => {
  it('exposes 16 stops derived from graph nodes', () => {
    expect(W1_STOPS).toHaveLength(16)
    expect(stopForNodeId('n1')?.id).toBe('stop_n1')
    expect(stopForNodeId('n1')?.stageId).toBe('w1-stage-1')
    expect(stopForNodeId('n0')?.stageId).toBeUndefined()
  })

  it('uses wider radii for stages and start', () => {
    expect(stopForNodeId('n1')?.radius).toBe(2.4)
    expect(stopForNodeId('n11')?.radius).toBe(2.6)
    expect(stopForNodeId('n0')?.radius).toBe(2.2)
    expect(stopForNodeId('n2')?.radius).toBe(2.0)
  })

  it('segments a tapped route node-by-node', () => {
    expect(segmentStops(['n0', 'n1', 'n2'])).toEqual(['n0', 'n1', 'n2'])
    expect(DWELL_SEC).toBe(0.4)
  })
})
