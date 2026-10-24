// 仮想全国ランキングの母集団・順位計算（純粋関数、通信なし）。
// 母集団は分布モデル。個人シミュレーションは近傍のみ。
// 日次分布（中央値8p）と累計分布（中央値150p）の2系統を持つ。
// 累計は減らず、最下位スタートで貯めるほど上がる。
import { facultiesFor, universitiesForRank } from '../data/universities'
export const RANK_POPULATION = 200000

// 簡易ハッシュ＋mulberry32（日付シード決定的乱数）
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 対数正規分布のCDF近似（中央値8ページ、σ=0.9）。仕様書§3の統計を写像した固定値。
function populationCdf(pages: number): number {
  if (pages <= 0) return 0
  const mu = Math.log(8)
  const sigma = 0.9
  const z = (Math.log(pages) - mu) / sigma
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (z > 0) p = 1 - p
  return Math.min(Math.max(p, 0), 1)
}

export function dailyPagesToRank(pages: number, _dateIso: string): number {
  const rank = Math.round(RANK_POPULATION * (1 - populationCdf(pages)))
  return Math.min(Math.max(rank, 1), RANK_POPULATION)
}

// 累計分布のCDF（中央値180ページ、σ=0.9）。
// 実測（進研模試偏差値51.7相当の学習量≒220ページ前後で偏差値52前後になるよう調整）。
function populationCdfTotal(pages: number): number {
  if (pages <= 0) return 0
  const mu = Math.log(180)
  const sigma = 0.9
  const z = (Math.log(pages) - mu) / sigma
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (z > 0) p = 1 - p
  return Math.min(Math.max(p, 0), 1)
}

export function totalPagesToRank(totalPages: number): number {
  const rank = Math.round(RANK_POPULATION * (1 - populationCdfTotal(totalPages)))
  return Math.min(Math.max(rank, 1), RANK_POPULATION)
}

export function totalActivity(records: { pages: number; date?: string }[]): number {
  return records.reduce((sum, r) => sum + (r.pages ?? 0), 0)
}

// 節目の順位（上位ほど小さい）。現在の順位より1つ上の節目を返す。1位ならnull。
export const RANK_MILESTONES = [100000, 50000, 10000, 5000, 1000, 100, 10, 1]

export function nextRankMilestone(rank: number): number | null {
  return RANK_MILESTONES.find((m) => m < rank) ?? null
}

export function rankToDeviation(rank: number): number {
  const p = 1 - (rank - 0.5) / RANK_POPULATION
  const capped = Math.min(Math.max(p, 1e-6), 1 - 1e-6)
  // probit近似（Acklam近似の簡易版で十分な精度）
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.38357751867269e+02, -3.066479806614716e+01, 2.506628277459239e+00]
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
  const plow = 0.02425
  const phigh = 1 - plow
  let z: number
  if (capped < plow) {
    const q = Math.sqrt(-2 * Math.log(capped))
    z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (capped <= phigh) {
    const q = capped - 0.5
    const r = q * q
    z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - capped))
    z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  return Math.round((50 + 10 * z) * 10) / 10
}

export const RIVAL_GRADES = ['高1', '高2', '高3', '浪人']

function rivalLabel(rand: () => number, rank = 100000): { univ: string; faculty: string; grade: string } {
  const pool = universitiesForRank(rank)
  const univ = pool[Math.floor(rand() * pool.length)]
  const faculties = facultiesFor(univ)
  return {
    univ,
    faculty: faculties[Math.floor(rand() * faculties.length)],
    grade: RIVAL_GRADES[Math.floor(rand() * RIVAL_GRADES.length)],
  }
}

// 順位→ページ数の逆変換（分布の二分法）。近傍ボードの連続順位用。
export function pagesForRank(rank: number): number {
  const clamped = Math.min(Math.max(rank, 1), RANK_POPULATION)
  const target = 1 - clamped / RANK_POPULATION
  let lo = 0
  let hi = 400
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (populationCdf(mid) < target) lo = mid
    else hi = mid
  }
  return Math.max(0, Math.round((lo + hi) / 2))
}

// 累計版の逆変換（二分法、上限20000、中央値180ページ基準）
export function totalPagesForRank(rank: number): number {
  const clamped = Math.min(Math.max(rank, 1), RANK_POPULATION)
  const target = 1 - clamped / RANK_POPULATION
  let lo = 0
  let hi = 20000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (populationCdfTotal(mid) < target) lo = mid
    else hi = mid
  }
  return Math.max(0, Math.round((lo + hi) / 2))
}

export type BoardEntry = { rank: number; boardRank: number; name: string; faculty: string; grade: string; pages: number; you: boolean }

// 自分の前後half件ずつの近傍ボード。順位は1ずつ連続し、ページには
// 決定的ジッターを付けて攻防のバラつきを出す。表示順位はdense方式。
// 累計スケール（totalPagesForRank）で生成する。
export function sampleNearBoard(
  userPages: number,
  userRank: number,
  dateIso: string,
  half = 15,
): BoardEntry[] {
  const clampedRank = Math.min(Math.max(userRank, 1), RANK_POPULATION)
  const from = Math.max(1, clampedRank - half)
  const to = Math.min(RANK_POPULATION, clampedRank + half)
  const raw: BoardEntry[] = []
  for (let rank = from; rank <= to; rank++) {
    if (rank === clampedRank) continue
    const rand = mulberry32(hashSeed(`board-${dateIso}-${rank}`))
    const label = rivalLabel(rand, rank)
    raw.push({ rank, boardRank: 0, name: label.univ, faculty: label.faculty, grade: label.grade, pages: totalPagesForRank(rank), you: false })
  }
  raw.push({ rank: clampedRank, boardRank: 0, name: 'あなた', faculty: '', grade: '', pages: userPages, you: true })
  raw.sort((a, b) => a.rank - b.rank)
  let boardRank = 0
  let prevPages = -1
  for (const entry of raw) {
    if (entry.pages !== prevPages) {
      boardRank += 1
      prevPages = entry.pages
    }
    entry.boardRank = boardRank
  }
  return raw
}

// 上位ボード（1位からの連番、ページ降順、日付シードで決定的）。
// 累計スケール（約4000〜6500ページ帯）。
export function sampleTopRivals(dateIso: string, count = 10): BoardEntry[] {
  const rand = mulberry32(hashSeed(`top-${dateIso}`))
  const out: BoardEntry[] = []
  let pages = 6000 + Math.floor(rand() * 800)
  for (let rank = 1; rank <= count; rank++) {
    const label = rivalLabel(rand, rank)
    out.push({ rank, boardRank: rank, name: label.univ, faculty: label.faculty, grade: label.grade, pages, you: false })
    pages = Math.max(0, pages - (150 + Math.floor(rand() * 250)))
  }
  return out
}
