// src/lib/rpgW1Visual.ts
import { w1StageStatus, w1NextStage, normalizeW1Cleared, W1_STAGE_NODE, type W1StageId } from './rpgW1Stages'
export type W1VisualStatus = 'cleared' | 'next' | 'future'
export const W1_YELLOW_RING = '#ffd233'
export const W1_FUTURE_CENTER = '#20242c'
export function w1VisualFor(stageId: string | undefined, cleared: readonly string[]): W1VisualStatus {
  if (!stageId) return 'cleared'
  const s = w1StageStatus(stageId, cleared)
  if (s === 'cleared') return 'cleared'
  if (s === 'next') return 'next'
  return 'future'
}
export function isPathBeyondNext(fromId: string, toId: string, cleared: readonly string[]): boolean {
  const norm = normalizeW1Cleared([...cleared])
  const next = w1NextStage(norm)
  if (!next) return false
  const nextNode = (W1_STAGE_NODE as Record<string, string>)[next as W1StageId]
  const order = ['n0','n1','n2','n3a','n3b','n4','n5a','n5b','n5c','n5d','n6','n7','n8','n9','n10','n11']
  const ni = order.indexOf(nextNode)
  const fi = order.indexOf(fromId)
  const ti = order.indexOf(toId)
  return Math.min(fi, ti) >= ni
}
