// 歩けるSFCキャンパスRPG（worldId 10）のドメインロジック（three.js非依存・純粋関数）。
//
// 役割の線引き:
// - campusは「見る＋解放される」だけのビューであり、EXP/進行の原資は seasonStore と
//   rpgProgressV2/records 側。ここでは EXP を一切加算しない（二重計上防止）。
// - 進行の一次ソースはグラフJSON（public/rpg/campus_graph.json）。Blender由来の
//   `stage` キーは normalizeW3Graph で `stageId` へ正規化して使う。
// - 解放は「クエストクリア→パス開放」。未解放ノードは見学可だが立ち入り不可の扱い。

import campusGraphJson from '../../public/rpg/campus_graph.json'
import { normalizeW3Graph, type W3Graph, type W3Node, type W3Path } from './rpgWorld3d'

/** キャンパス用ワールドID（RankingのRPGタブから開くworldId）。 */
export const CAMPUS_WORLD_ID = 10
/** 進行保存キー（他ワールドと同じ progressKey 体系）。 */
export const CAMPUS_PROGRESS_KEY = '3d-10'

/** クエスト＝ステージの順序（解放は左から順に進む）。 */
export const CAMPUS_STAGE_ORDER = [
  'campus-stage-1',
  'campus-stage-2',
  'campus-stage-3',
  'campus-stage-4',
] as const

export type CampusStageId = (typeof CAMPUS_STAGE_ORDER)[number]

/**
 * 各ステージが立つノード（グラフの stageId と一致する）。
 * メイン動線は n0→n1→n2→n3→n5→n7（c0..c4）、n4(食堂)/n6(研究棟) は c5/c6 の支線。
 */
export const CAMPUS_STAGE_NODE: Record<string, string> = {
  'campus-stage-1': 'n2', // 図書館
  'campus-stage-2': 'n3', // 教室棟
  'campus-stage-3': 'n5', // グラウンド
  'campus-stage-4': 'n7', // 展望デッキ
}

/** ステージ表示名（節点名と一致させる）。 */
export const CAMPUS_STAGE_TITLES: Record<string, string> = {
  'campus-stage-1': '図書館',
  'campus-stage-2': '教室棟',
  'campus-stage-3': 'グラウンド',
  'campus-stage-4': '展望デッキ',
}

/** 初期解放は正門→並木道のみ（クエスト看板は並木道）。 */
export const CAMPUS_INITIAL_PATHS: string[] = ['c0']

/**
 * ステージクリアで開く区間。
 * - campus-stage-1 → [c1(並木道→図書館), c2(図書館→教室棟)]
 * - campus-stage-2 → [c3(教室棟→グラウンド)]
 * - campus-stage-3 → [c4(グラウンド→展望デッキ)]
 * - campus-stage-4 → []（最終クリア＝展望デッキでの祝い）
 * c5(教室棟→食堂)/c6(グラウンド→研究棟) は解放表に無い支線（終始見学可・立ち入り不可）。
 */
export const CAMPUS_UNLOCKS: Record<string, string[]> = {
  'campus-stage-1': ['c1', 'c2'],
  'campus-stage-2': ['c3'],
  'campus-stage-3': ['c4'],
  'campus-stage-4': [],
}

const rawCampusGraph = campusGraphJson as unknown as {
  nodes: (W3Node & { stage?: string })[]
  paths: W3Path[]
}

/** 正規化済みキャンパスグラフ（stageId 付き）。 */
export const campusGraph: W3Graph = normalizeW3Graph(rawCampusGraph)

/** ノード表示名（グラフJSONの label を正とする）。 */
export const CAMPUS_NODE_LABELS: Record<string, string> = Object.fromEntries(
  campusGraph.nodes.map((n) => [n.id, n.label ?? n.id]),
)

/** クリア済みステージから解放済みパス集合を求める。 */
export function campusUnlockedPaths(cleared: readonly string[]): string[] {
  const open = new Set<string>(CAMPUS_INITIAL_PATHS)
  for (const stage of cleared) {
    for (const pathId of CAMPUS_UNLOCKS[stage] ?? []) open.add(pathId)
  }
  return [...open]
}

/** 次の未クリアステージ（全クリア後は null）。 */
export function campusNextStage(cleared: readonly string[]): string | null {
  const done = new Set(cleared)
  for (const stage of CAMPUS_STAGE_ORDER) {
    if (!done.has(stage)) return stage
  }
  return null
}

/** ステージの状態（クリア済み／次に挑める／未解放）。 */
export function campusStageStatus(
  cleared: readonly string[],
  stageId: string,
): 'cleared' | 'next' | 'locked' {
  if (cleared.includes(stageId)) return 'cleared'
  return campusNextStage(cleared) === stageId ? 'next' : 'locked'
}
