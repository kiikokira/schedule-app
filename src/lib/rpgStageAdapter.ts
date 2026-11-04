// 既存機能への薄い接続層。存在しないアクション本編は作らず、既存の画面・記録フローへ誘導する。
// ステージIDは `<theme>-stage-<1|2|3>` 形式。9ワールド共通。
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

const STAGE_TITLES: Record<string, string> = {
  'grass-stage-1': '丘の小屋', 'grass-stage-2': '風見の丘', 'grass-stage-3': '洞窟まえ',
  'desert-stage-1': '日干し小屋', 'desert-stage-2': '風紋の丘', 'desert-stage-3': '遺跡まえ',
  'snow-stage-1': '山小屋', 'snow-stage-2': '雪見の丘', 'snow-stage-3': '氷の洞窟',
  'sea-stage-1': '海のテント', 'sea-stage-2': '見晴らし丘', 'sea-stage-3': '洞窟まえ',
  'forest-stage-1': '森の小屋', 'forest-stage-2': '巨木の丘', 'forest-stage-3': '大樹の洞',
  'rock-stage-1': '山小屋', 'rock-stage-2': '岩の丘', 'rock-stage-3': '岩の洞窟',
  'cloud-stage-1': '雲の家', 'cloud-stage-2': '風見の丘', 'cloud-stage-3': '霧の洞',
  'lava-stage-1': '溶岩の小屋', 'lava-stage-2': '黒曜の丘', 'lava-stage-3': '炎の洞窟',
  'star-stage-1': '星屑の小屋', 'star-stage-2': '結晶の丘', 'star-stage-3': '結晶洞',
}

export function stageAppRoute(
  target: 'today' | 'book' | 'ranking',
  bookId: string | null | undefined,
): { name: 'today' } | { name: 'detail'; bookId: string } | null {
  if (target === 'today') return { name: 'today' }
  if (target === 'book') return bookId ? { name: 'detail', bookId } : null
  return null
}

export function stageActionFor(stageId: string, ctx: StageContext): StageAction | null {
  const title = STAGE_TITLES[stageId]
  if (!title) return null
  if (stageId.endsWith('-stage-1')) {
    return { stageId, target: 'today', title, hint: '今日の計画を開いて1ページ進めるとクエストクリア' }
  }
  if (stageId.endsWith('-stage-2')) {
    if (ctx.hasBooks && ctx.firstBookId) {
      return { stageId, target: 'book', title, hint: '参考書の記録を開いてページを記録する', bookId: ctx.firstBookId }
    }
    return { stageId, target: 'today', title, hint: '今日の計画を開いて記録する' }
  }
  if (stageId.endsWith('-stage-3')) {
    return { stageId, target: 'ranking', title, hint: 'ランキングのクエスト状況を確認する' }
  }
  return null
}
