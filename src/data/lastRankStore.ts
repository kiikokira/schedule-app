const KEY = 'schedule-app-last-rank'
const MODEL_KEY = 'schedule-app-last-rank-model'
// 順位モデルの版。母集団パラメータを変えたら上げる。
// 版が違う基準値とは比較しない（モデル変更直後の見かけのDOWN表示を防ぐ）。
export const RANK_MODEL_VERSION = 3

export function loadLastRank(): number | null {
  try {
    if (localStorage.getItem(MODEL_KEY) !== String(RANK_MODEL_VERSION)) return null
    const raw = localStorage.getItem(KEY)
    if (raw == null) return null
    const n = Number(raw)
    return Number.isInteger(n) && n >= 1 ? n : null
  } catch {
    return null
  }
}

export function saveLastRank(rank: number): void {
  try {
    localStorage.setItem(KEY, String(rank))
    localStorage.setItem(MODEL_KEY, String(RANK_MODEL_VERSION))
  } catch {
  }
}
