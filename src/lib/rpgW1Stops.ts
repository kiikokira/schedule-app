// W1円形停止点の登録表。座標はグラフ参照のみ（複製しない）。
import { W1_STAGE_NODE, type W1StageId } from './rpgW1Stages'

export const DWELL_SEC = 0.4

export type W1StopType = 'start' | 'stage' | 'junction' | 'bridge' | 'stairs' | 'stop' | 'fort' | 'final'

export type W1Stop = {
  id: string
  nodeId: string
  type: W1StopType
  radius: number
  stageId?: W1StageId
}

const DEFS: [string, W1StopType, number, W1StageId?][] = [
  ['n0', 'start', 2.2],
  ['n1', 'stage', 2.4, 'w1-stage-1'],
  ['n2', 'stop', 2.0],
  ['n3a', 'bridge', 2.0],
  ['n3b', 'bridge', 2.0],
  ['n4', 'junction', 2.4, 'w1-stage-2'],
  ['n5a', 'stairs', 2.0],
  ['n5b', 'stop', 2.0],
  ['n5c', 'stairs', 2.0],
  ['n5d', 'stairs', 2.0],
  ['n6', 'stage', 2.4, 'w1-stage-3'],
  ['n7', 'stage', 2.4, 'w1-stage-4'],
  ['n8', 'stage', 2.4, 'w1-stage-5'],
  ['n9', 'stage', 2.4, 'w1-stage-6'],
  ['n10', 'fort', 2.4, 'w1-stage-7'],
  ['n11', 'final', 2.6, 'w1-stage-8'],
]

export const W1_STOPS: W1Stop[] = DEFS.map(([nodeId, type, radius, stageId]) => ({
  id: `stop_${nodeId}`,
  nodeId,
  type,
  radius,
  ...(stageId ? { stageId } : {}),
}))

const byNode = new Map(W1_STOPS.map((s) => [s.nodeId, s]))

export function stopForNodeId(nodeId: string): W1Stop | undefined {
  return byNode.get(nodeId)
}

/** タップ経路を円単位に分割する（現状は恒等写像、将来の停止条件分岐の受口）。 */
export function segmentStops(nodeIds: string[]): string[] {
  return [...nodeIds]
}

/** stageIdとW1_STAGE_NODEの対応がずれていないことの自己診断。 */
export function validateW1Stops(): string[] {
  const issues: string[] = []
  for (const s of W1_STOPS) {
    if (s.stageId && W1_STAGE_NODE[s.stageId] !== s.nodeId) {
      issues.push(`stage mismatch: ${s.id}`)
    }
  }
  return issues
}
