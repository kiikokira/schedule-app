import { GRASS_STAGES } from './rpgGrassWorld'

// 既存機能への薄い接続層。存在しないアクション本編は作らず、既存の画面・記録フローへ誘導する。
export type StageTarget = 'today' | 'book' | 'ranking'

export type StageAction = {
  stageId: string
  target: StageTarget
  title: string
  hint: string
  bookId?: string
}

export type StageContext = {
  hasBooks: boolean
  firstBookId: string | null
  todayPages: number
  totalPages: number
}

export function stageActionFor(stageId: string, ctx: StageContext): StageAction | null {
  const def = GRASS_STAGES.find((s) => s.id === stageId)
  const desert = !def && stageId.startsWith('desert-stage-')
  if (!def && !desert) return null
  const title = def?.title ?? desertTitle(stageId)
  if (stageId === 'grass-stage-1' || stageId === 'desert-stage-1') {
    return { stageId, target: 'today', title, hint: '今日の計画を開いて1ページ進めるとクエストクリア' }
  }
  if (stageId === 'grass-stage-2' || stageId === 'desert-stage-2') {
    if (ctx.hasBooks && ctx.firstBookId) {
      return { stageId, target: 'book', title, hint: '参考書の記録を開いてページを記録する', bookId: ctx.firstBookId }
    }
    return { stageId, target: 'today', title, hint: '今日の計画を開いて記録する' }
  }
  if (stageId === 'grass-stage-3' || stageId === 'desert-stage-3') {
    return { stageId, target: 'ranking', title, hint: 'ランキングのクエスト状況を確認する' }
  }
  return null
}

function desertTitle(stageId: string): string {
  if (stageId === 'desert-stage-1') return '日干し小屋'
  if (stageId === 'desert-stage-2') return '風紋の丘'
  return '遺跡まえ'
}
