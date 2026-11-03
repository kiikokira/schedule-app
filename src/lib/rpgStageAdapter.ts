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
  if (!def) return null
  if (def.id === 'grass-stage-1') {
    return { stageId, target: 'today', title: def.title, hint: '今日の計画を開いて1ページ進めるとクエストクリア' }
  }
  if (def.id === 'grass-stage-2') {
    if (ctx.hasBooks && ctx.firstBookId) {
      return { stageId, target: 'book', title: def.title, hint: '参考書の記録を開いてページを記録する', bookId: ctx.firstBookId }
    }
    return { stageId, target: 'today', title: def.title, hint: '今日の計画を開いて記録する' }
  }
  if (def.id === 'grass-stage-3') {
    return { stageId, target: 'ranking', title: def.title, hint: 'ランキングのクエスト状況を確認する' }
  }
  return null
}
