import { describe, it, expect } from 'vitest'
import {
  CAMPUS_INITIAL_PATHS,
  CAMPUS_STAGE_NODE,
  CAMPUS_STAGE_ORDER,
  CAMPUS_STAGE_TITLES,
  CAMPUS_UNLOCKS,
  campusGraph,
  campusNextStage,
  campusStageStatus,
  campusUnlockedPaths,
} from './rpgCampus'
import { findRoute3d, validateWorld3dGraph, type W3Graph } from './rpgWorld3d'
import graph from '../../public/rpg/campus_graph.json'

const rawGraph = graph as unknown as W3Graph

describe('campus domain', () => {
  it('graph validates with zero issues', () => {
    expect(validateWorld3dGraph(rawGraph)).toEqual([])
    expect(validateWorld3dGraph(campusGraph)).toEqual([])
  })

  it('first stage is next when cleared is empty', () => {
    expect(campusNextStage([])).toBe(CAMPUS_STAGE_ORDER[0])
  })

  it('status transitions cleared/next/locked', () => {
    expect(campusStageStatus([], CAMPUS_STAGE_ORDER[0])).toBe('next')
    expect(campusStageStatus([CAMPUS_STAGE_ORDER[0]], CAMPUS_STAGE_ORDER[0])).toBe('cleared')
    expect(campusStageStatus([], CAMPUS_STAGE_ORDER[2])).toBe('locked')
  })

  it('has 8 nodes and 7 walk/run paths with positive speed and no jump', () => {
    expect(campusGraph.nodes).toHaveLength(8)
    expect(campusGraph.paths).toHaveLength(7)
    expect(campusGraph.paths.map((p) => p.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'])
    for (const p of campusGraph.paths) {
      expect(['walk', 'run']).toContain(p.kind)
      expect(p.speed).toBeGreaterThan(0)
    }
  })

  it('maps campus-stage-1..4 to the graph stage nodes', () => {
    expect(CAMPUS_STAGE_ORDER).toEqual([
      'campus-stage-1',
      'campus-stage-2',
      'campus-stage-3',
      'campus-stage-4',
    ])
    expect(CAMPUS_STAGE_NODE).toEqual({
      'campus-stage-1': 'n2',
      'campus-stage-2': 'n3',
      'campus-stage-3': 'n5',
      'campus-stage-4': 'n7',
    })
    const byId = new Map(campusGraph.nodes.map((n) => [n.id, n]))
    for (const stage of CAMPUS_STAGE_ORDER) {
      const nodeId = CAMPUS_STAGE_NODE[stage]
      expect(byId.get(nodeId)?.stageId).toBe(stage)
      expect(byId.get(nodeId)?.kind).toBe('stage')
      expect(CAMPUS_STAGE_TITLES[stage]).toBeTruthy()
    }
    // ステージ以外のノードは start / stop
    for (const n of campusGraph.nodes) {
      if (Object.values(CAMPUS_STAGE_NODE).includes(n.id)) continue
      expect(['start', 'stop']).toContain(n.kind)
    }
  })

  it('opens only the first path initially and the specified paths per stage', () => {
    expect(CAMPUS_INITIAL_PATHS).toEqual(['c0'])
    expect(CAMPUS_UNLOCKS['campus-stage-1']).toEqual(['c1', 'c2'])
    expect(CAMPUS_UNLOCKS['campus-stage-2']).toEqual(['c3'])
    expect(CAMPUS_UNLOCKS['campus-stage-3']).toEqual(['c4'])
    expect(CAMPUS_UNLOCKS['campus-stage-4']).toEqual([])
    expect(campusUnlockedPaths([])).toEqual(['c0'])
    expect(campusUnlockedPaths(['campus-stage-1'])).toEqual(['c0', 'c1', 'c2'])
  })

  it('every stage node becomes reachable once its quest is cleared', () => {
    let cleared: string[] = []
    for (const stage of CAMPUS_STAGE_ORDER) {
      cleared = [...cleared, stage]
      const open = new Set(campusUnlockedPaths(cleared))
      const route = findRoute3d(campusGraph, 'n0', CAMPUS_STAGE_NODE[stage], open)
      expect(route).not.toBeNull()
      expect(route![route!.length - 1]).toBe(CAMPUS_STAGE_NODE[stage])
    }
  })

  it('advances one stage at a time and ends with no next stage', () => {
    let cleared: string[] = []
    for (const stage of CAMPUS_STAGE_ORDER) {
      expect(campusNextStage(cleared)).toBe(stage)
      expect(campusStageStatus(cleared, stage)).toBe('next')
      cleared = [...cleared, stage]
      expect(campusStageStatus(cleared, stage)).toBe('cleared')
    }
    expect(campusNextStage(cleared)).toBeNull()
    expect(campusStageStatus(cleared, 'campus-stage-1')).toBe('cleared')
  })
})
