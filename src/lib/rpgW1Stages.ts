// W1 8ステージ厳密順次進行ロジック（three.js非依存・純粋関数）。
// 既存16ノード/17パスの幾何は変えず、中間ノードをステージに昇格させる。
// グローバルpath ID（p0..p16）はW2〜9と共有のため、W1の可否は
// clearedStages + frontier で判定し、path unlock とは独立させる。

export const W1_STAGE_ORDER = [
  'w1-stage-1',
  'w1-stage-2',
  'w1-stage-3',
  'w1-stage-4',
  'w1-stage-5',
  'w1-stage-6',
  'w1-stage-7',
  'w1-stage-8',
] as const

export type W1StageId = (typeof W1_STAGE_ORDER)[number]

export const W1_STAGE_NODE: Record<W1StageId, string> = {
  'w1-stage-1': 'n1',
  'w1-stage-2': 'n4',
  'w1-stage-3': 'n6',
  'w1-stage-4': 'n7',
  'w1-stage-5': 'n8',
  'w1-stage-6': 'n9',
  'w1-stage-7': 'n10',
  'w1-stage-8': 'n11',
}

export const W1_STAGE_TITLES: Record<W1StageId, string> = {
  'w1-stage-1': '花畑のはじまり',
  'w1-stage-2': 'わかれ道の森',
  'w1-stage-3': '丘の小屋',
  'w1-stage-4': '崖っぷちチャレンジ',
  'w1-stage-5': '風見の丘',
  'w1-stage-6': '洞窟まえ',
  'w1-stage-7': '中間砦',
  'w1-stage-8': '最終塔',
}

/** 各ステージクリアで開く区間（既存path ID）。直列＋s2→s3の分岐両ルートを同時開放。 */
export const W1_UNLOCKS: Record<W1StageId, string[]> = {
  'w1-stage-1': ['p1', 'p2', 'p3', 'p4'],
  'w1-stage-2': ['p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p16'],
  'w1-stage-3': ['p11'],
  'w1-stage-4': ['p12'],
  'w1-stage-5': ['p13'],
  'w1-stage-6': ['p14'],
  'w1-stage-7': ['p15'],
  'w1-stage-8': [],
}

/** W1初期開放はスタート→s1のみ。 */
export const W1_INITIAL_PATHS = ['p0']

/** 旧3ステージクリアの移行先（n6/n8/n9 は新 s3/s5/s6 に対応）。 */
const LEGACY_MAP: Record<string, W1StageId> = {
  'grass-stage-1': 'w1-stage-3',
  'grass-stage-2': 'w1-stage-5',
  'grass-stage-3': 'w1-stage-6',
}

export type W1StageStatus = 'cleared' | 'next' | 'locked'

/** 旧セーブ混在を新8段階に正規化：最大到達までの全ステージを cleared とみなす。 */
export function normalizeW1Cleared(rawCleared: string[]): W1StageId[] {
  const hit = new Set<W1StageId>()
  for (const id of rawCleared) {
    if ((W1_STAGE_ORDER as readonly string[]).includes(id)) hit.add(id as W1StageId)
    const mapped = LEGACY_MAP[id]
    if (mapped) hit.add(mapped)
  }
  if (hit.size === 0) return []
  let maxIdx = -1
  for (const s of hit) maxIdx = Math.max(maxIdx, W1_STAGE_ORDER.indexOf(s))
  return W1_STAGE_ORDER.slice(0, maxIdx + 1)
}

export function w1NextStage(cleared: readonly string[]): W1StageId | null {
  const norm = normalizeW1Cleared([...cleared])
  if (norm.length >= W1_STAGE_ORDER.length) return null
  return W1_STAGE_ORDER[norm.length]
}

export function w1StageStatus(stageId: string, cleared: readonly string[]): W1StageStatus {
  const norm = normalizeW1Cleared([...cleared])
  if ((norm as string[]).includes(stageId)) return 'cleared'
  return w1NextStage(norm) === stageId ? 'next' : 'locked'
}

/** 指定ステージに入れるか（cleared再戦可・next可・locked不可・全クリア後は全可）。 */
export function w1CanEnter(stageId: string, cleared: readonly string[]): boolean {
  const s = w1StageStatus(stageId, cleared)
  return s === 'cleared' || s === 'next'
}

export function w1IsComplete(cleared: readonly string[]): boolean {
  return normalizeW1Cleared([...cleared]).length >= W1_STAGE_ORDER.length
}

/** frontier（到達可能な最先端ノード集合）。locked stage ノード自体は除外する。 */
export function w1AllowedNodeIds(cleared: readonly string[]): Set<string> {
  const norm = normalizeW1Cleared([...cleared])
  const next = w1NextStage(norm)
  //  backbone 到達範囲：next までの全 stage ノード＋中間ノード
  const order = ['n0', 'n1', 'n2', 'n3a', 'n3b', 'n4', 'n5a', 'n5b', 'n5c', 'n5d', 'n6']
  const allowed = new Set<string>(order)
  const reachedIdx = norm.length // 0..8
  // s3以降は直列ノードを順次追加
  const tail: string[] = ['n7', 'n8', 'n9', 'n10', 'n11']
  // norm に s3 が含まれれば n7 を、s4 が含まれれば n8 を…という形で
  // next自体は到達可能（赤）、その先は不可（灰）
  const tailUnlockAt = [3, 4, 5, 6, 7] // norm.length がこの値以上で対応tailを追加
  tail.forEach((nodeId, i) => {
    if (reachedIdx >= tailUnlockAt[i] - 1 + 1 || (next && W1_STAGE_NODE[next] === nodeId)) {
      // next ノード自体は常に追加、それより先は cleared がある場合のみ
      if (W1_STAGE_NODE[next as W1StageId] === nodeId) allowed.add(nodeId)
      else if (reachedIdx > tailUnlockAt[i] - 1) allowed.add(nodeId)
    }
  })
  // locked stage ノードを除外（next と cleared 以外）
  const keepStages = new Set<string>([
    ...norm.map((s) => W1_STAGE_NODE[s]),
    ...(next ? [W1_STAGE_NODE[next]] : []),
  ])
  for (const s of W1_STAGE_ORDER) {
    if (!keepStages.has(W1_STAGE_NODE[s])) allowed.delete(W1_STAGE_NODE[s])
  }
  void next
  return allowed
}
