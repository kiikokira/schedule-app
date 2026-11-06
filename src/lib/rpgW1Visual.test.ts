// src/lib/rpgW1Visual.test.ts
import { describe, it, expect } from 'vitest'
import { w1VisualFor, isPathBeyondNext, w1BeyondPathIds, w1NearestPathId, w1ShouldDimRoadSamples, W1_YELLOW_RING } from './rpgW1Visual'
import { normalizeW3Graph, type W3Graph } from './rpgWorld3d'
import v3Json from '../../public/rpg/world1_v3_graph.json'
const v3 = normalizeW3Graph(v3Json as unknown as W3Graph)
describe('rpgW1Visual', () => {
  it('maps cleared/next/future correctly', () => {
    expect(w1VisualFor('w1-stage-1', ['w1-stage-1'])).toBe('cleared')
    expect(w1VisualFor('w1-stage-2', ['w1-stage-1'])).toBe('next')
    expect(w1VisualFor('w1-stage-3', ['w1-stage-1'])).toBe('future')
  })
  it('non-stage nodes are cleared (no yellow dims)', () => {
    expect(w1VisualFor(undefined, [])).toBe('cleared')
  })
  it('yellow ring constant exists', () => {
    expect(W1_YELLOW_RING).toBe('#ffd233')
  })
  it('paths beyond next are marked translucent', () => {
    expect(isPathBeyondNext('n6', 'n7', ['w1-stage-1'])).toBe(true)
    expect(isPathBeyondNext('n0', 'n1', [])).toBe(false)
  })
  it('branch: stairs (p5) vs ladder (p7) both beyond before stage-2, opaque at next', () => {
    // cleared=[] next=s1 → s2 unlocks (p5/p7) are strictly after next → beyond
    expect(isPathBeyondNext('n4', 'n5a', [])).toBe(true)
    expect(isPathBeyondNext('n4', 'n5c', [])).toBe(true)
    // cleared=[s1] next=s2 → p5/p7 are next's own unlocks → opaque
    expect(isPathBeyondNext('n4', 'n5a', ['w1-stage-1'])).toBe(false)
    expect(isPathBeyondNext('n4', 'n5c', ['w1-stage-1'])).toBe(false)
    // tail still beyond
    expect(isPathBeyondNext('n6', 'n7', ['w1-stage-1'])).toBe(true)
  })
  it('branch: shortcut p16 follows stage-2 unlocks', () => {
    expect(isPathBeyondNext('n5b', 'n5d', [])).toBe(true)
    expect(isPathBeyondNext('n5b', 'n5d', ['w1-stage-1'])).toBe(false)
    expect(isPathBeyondNext('n5b', 'n5d', ['w1-stage-1', 'w1-stage-2'])).toBe(false)
  })
  it('tail unlocks shift after each clear (p11 opaque once next=s3)', () => {
    expect(isPathBeyondNext('n6', 'n7', ['w1-stage-1', 'w1-stage-2'])).toBe(false)
    expect(isPathBeyondNext('n7', 'n8', ['w1-stage-1', 'w1-stage-2'])).toBe(true)
    expect(w1BeyondPathIds(['w1-stage-1', 'w1-stage-2', 'w1-stage-3', 'w1-stage-4', 'w1-stage-5', 'w1-stage-6', 'w1-stage-7', 'w1-stage-8']).size).toBe(0)
  })
  it('GLB proximity dimming fires for beyond-next spans (v3 graph + helper)', () => {
    // p11 midpoint (8.5,-18) is beyond when cleared=[s1]; p0 midpoint (-17,15) is not.
    const beyondSamples = [{ x: 8.5, z: -18 }, { x: 8.6, z: -18.1 }, { x: 8.4, z: -17.9 }]
    const startSamples = [{ x: -17, z: 15 }, { x: -17.1, z: 15.1 }]
    expect(w1NearestPathId(8.5, -18, v3)).toBe('p11')
    expect(w1NearestPathId(-17, 15, v3)).toBe('p0')
    expect(w1ShouldDimRoadSamples(beyondSamples, ['w1-stage-1'], v3)).toBe(true)
    expect(w1ShouldDimRoadSamples(startSamples, ['w1-stage-1'], v3)).toBe(false)
    expect(w1ShouldDimRoadSamples(startSamples, [], v3)).toBe(false)
  })
})
