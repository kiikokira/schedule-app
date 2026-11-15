import { useEffect, useRef } from 'react'

export const OPENING_DURATION_MS = 5000

/**
 * 実ロゴ画像そのもの。public/keiologo-pens.png をそのまま使う
 * （トレース・自作SVGの上書きなし）。相対パスで base './' ビルドに対応。
 */
const LOGO_SRC = 'keiologo-pens.png'

// ---- `.superpowers/brainstorm/pen-options18.html` の
//      classify / frame / drawFrame / init を React へ移植した定数 ----
const D1X = 0.6106
const D1Y = 0.792
const D2X = -0.6376
const D2Y = 0.7704

const GOLD_THRESHOLD = 16
const MIN_GOLD_PIXELS = 20000
const MAX_RELOAD_TRIES = 3
const SLIT_GAP_PX = 8
const EDGE_BAND_PX = 10
const TOP_BOTTOM_SPLIT_Y = 150
const PHASE1_END = 0.3
const PHASE2_START = 0.45
const PHASE2_END = 0.83
const FRONT_WINDOW = 0.035
const FRONT_GLOW_MAX = 90
const SUPER_SAMPLE = 3

export type PenPixel = {
  i: number
  t1: number
  t2: number
  nib1: boolean
  r: number
  g: number
  b: number
  a: number
}

export type PenModel = {
  px: PenPixel[]
  W: number
  H: number
}

function isGoldPixel(data: Uint8ClampedArray, idx: number): boolean {
  return Math.max(data[idx], data[idx + 1], data[idx + 2]) > GOLD_THRESHOLD
}

function interpolateEdges(
  has: Uint8Array,
  arr: Float64Array,
  fallback: number,
  H: number,
): Float64Array {
  const out = new Float64Array(H)
  const ys: number[] = []
  for (let y = 0; y < H; y++) if (has[y]) ys.push(y)
  if (ys.length === 0) {
    for (let y = 0; y < H; y++) out[y] = fallback
    return out
  }
  for (let y = 0; y < H; y++) {
    let ya = -1
    let yb = -1
    for (let k = 0; k < ys.length; k++) {
      if (ys[k] <= y) ya = ys[k]
      if (ys[k] >= y && yb < 0) yb = ys[k]
    }
    if (ya < 0) out[y] = arr[yb]
    else if (yb < 0) out[y] = arr[ya]
    else if (ya === yb) out[y] = arr[ya]
    else out[y] = arr[ya] + ((arr[yb] - arr[ya]) * (y - ya)) / (yb - ya)
  }
  return out
}

/** 行走査で実測縁を求め、各金ピクセルを1本目/2本目に分類する。重複なし。 */
export function classifyPenPixels(
  srcData: Uint8ClampedArray,
  W: number,
  H: number,
): PenModel {
  const hasL = new Uint8Array(H)
  const hasR = new Uint8Array(H)
  const arrL = new Float64Array(H)
  const arrR = new Float64Array(H)
  for (let y = 0; y < H; y++) {
    const runs: Array<[number, number]> = []
    let s = -1
    for (let x = 0; x < W; x++) {
      const g = isGoldPixel(srcData, (y * W + x) * 4)
      if (g && s < 0) s = x
      if (!g && s >= 0) {
        runs.push([s, x - 1])
        s = -1
      }
    }
    if (s >= 0) runs.push([s, W - 1])
    // 8px未満の途切れはスリットとして同一視する
    const mg: Array<[number, number]> = []
    for (let k = 0; k < runs.length; k++) {
      if (mg.length > 0 && runs[k][0] - mg[mg.length - 1][1] < SLIT_GAP_PX) {
        mg[mg.length - 1][1] = runs[k][1]
      } else {
        mg.push([runs[k][0], runs[k][1]])
      }
    }
    if (mg.length === 0) continue
    const first = mg[0]
    const last = mg[mg.length - 1]
    if (y < TOP_BOTTOM_SPLIT_Y) {
      // 上部: 左の塊＝1本目。右の塊との間に10px以上の黒帯があれば右端を右縁に
      arrL[y] = first[0]
      hasL[y] = 1
      if (mg.length >= 2 && mg[1][0] - first[1] >= EDGE_BAND_PX) {
        arrR[y] = first[1]
        hasR[y] = 1
      }
    } else {
      // 下部: 右の塊＝1本目。左に10px以上の黒帯があれば左端を左縁に
      if (mg.length >= 2 && last[0] - mg[mg.length - 2][1] >= EDGE_BAND_PX) {
        arrL[y] = last[0]
        hasL[y] = 1
        arrR[y] = last[1]
        hasR[y] = 1
      }
    }
  }
  // 測定できない行は両側の測定値から直線補間する
  const Li = interpolateEdges(hasL, arrL, -1e9, H)
  const Ri = interpolateEdges(hasR, arrR, 1e9, H)
  const px: PenPixel[] = []
  let t1min = Infinity
  let t1max = -Infinity
  let t2min = Infinity
  let t2max = -Infinity
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      if (!isGoldPixel(srcData, i)) continue
      const nib1 = x >= Li[y] - 1 && x <= Ri[y] + 1
      const t1 = x * D1X + y * D1Y
      const t2 = x * D2X + y * D2Y
      if (nib1) {
        if (t1 < t1min) t1min = t1
        if (t1 > t1max) t1max = t1
      } else {
        if (t2 < t2min) t2min = t2
        if (t2 > t2max) t2max = t2
      }
      px.push({
        i,
        t1,
        t2,
        nib1,
        r: srcData[i],
        g: srcData[i + 1],
        b: srcData[i + 2],
        a: srcData[i + 3],
      })
    }
  }
  for (const p of px) {
    p.t1 = (p.t1 - t1min) / (t1max - t1min || 1)
    p.t2 = (p.t2 - t2min) / (t2max - t2min || 1)
  }
  return { px, W, H }
}

/**
 * 経過割合 el → 各筆の描画進捗。
 * フェーズ1（el 0-0.30: 1本目）→保持（0.30-0.45）→
 * フェーズ2（el 0.45-0.83: 2本目）→保持→終了（el>=1）。
 */
export function phaseProgress(el: number): { p1: number; p2: number } {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
  return {
    p1: clamp01(el / PHASE1_END),
    p2: clamp01((el - PHASE2_START) / (PHASE2_END - PHASE2_START)),
  }
}

/** 等倍バッファに筆を描き、双線形補間で高解像度Canvasへ拡大する。 */
function drawFrame(
  model: PenModel,
  buf: HTMLCanvasElement,
  bctx: CanvasRenderingContext2D,
  cv: HTMLCanvasElement,
  p1: number,
  p2: number,
): void {
  const out = bctx.createImageData(model.W, model.H)
  const d = out.data
  const list = model.px
  for (let k = 0; k < list.length; k++) {
    const p = list[k]
    const rel = p.nib1 ? (p1 - p.t1) / FRONT_WINDOW : (p2 - p.t2) / FRONT_WINDOW
    if (rel <= 0) continue
    const am = rel >= 1 ? 1 : rel
    // 描画フロントには控えめなグロー（先端近傍の加算発光・最大+90）
    const boost = rel >= 1 ? 0 : Math.round((1 - rel) * FRONT_GLOW_MAX)
    let rr = p.r + boost
    if (rr > 255) rr = 255
    let gg = p.g + boost
    if (gg > 255) gg = 255
    let bb = p.b + boost
    if (bb > 255) bb = 255
    d[p.i] = rr
    d[p.i + 1] = gg
    d[p.i + 2] = bb
    d[p.i + 3] = Math.round(p.a * am)
  }
  bctx.putImageData(out, 0, 0)
  const ctx = cv.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, cv.width, cv.height)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.drawImage(buf, 0, 0, cv.width, cv.height)
}

type OpeningSplashProps = {
  onDone: () => void
}

function isReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function OpeningSplash({ onDone }: OpeningSplashProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    let cancelled = false
    let finished = false
    let rafId = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let model: PenModel | null = null
    let buf: HTMLCanvasElement | null = null
    let bctx: CanvasRenderingContext2D | null = null

    const requestFrame = (cb: (t: number) => void): number => {
      if (typeof window.requestAnimationFrame === 'function') {
        return window.requestAnimationFrame(cb)
      }
      return window.setTimeout(() => cb(performance.now()), 16)
    }
    const cancelFrame = (id: number): void => {
      if (typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(id)
      } else {
        window.clearTimeout(id)
      }
    }

    const renderAt = (p1: number, p2: number): void => {
      if (!canvas || !model || !buf || !bctx) return
      drawFrame(model, buf, bctx, canvas, p1, p2)
    }

    const finish = (): void => {
      if (finished) return
      finished = true
      cancelFrame(rafId)
      if (timer !== undefined) window.clearTimeout(timer)
      // 終了形は必ず実画像そのもの（全金ピクセル表示）と一致させる
      try {
        renderAt(1, 1)
      } catch {
        // 描画失敗でも onDone は呼ぶ
      }
      onDoneRef.current()
    }

    // prefers-reduced-motion: 静止画（完成ロゴ）を即表示して即 onDone
    if (isReducedMotion()) {
      try {
        renderAt(1, 1)
      } catch {
        // モデル未構築でも onDone は呼ぶ
      }
      finished = true
      onDoneRef.current()
      return () => {
        document.body.style.overflow = previousOverflow
      }
    }

    const frame = (now: number): void => {
      if (cancelled || finished) return
      const el = (now - t0) / OPENING_DURATION_MS
      if (el >= 1) {
        renderAt(1, 1)
        finish()
        return
      }
      const { p1, p2 } = phaseProgress(el)
      try {
        renderAt(p1, p2)
      } catch {
        // 1フレームの失敗で再生を止めない
      }
      rafId = requestFrame(frame)
    }

    let t0 = 0
    const play = (): void => {
      if (cancelled || finished) return
      cancelFrame(rafId)
      t0 = performance.now()
      rafId = requestFrame(frame)
    }

    const build = (img: HTMLImageElement): boolean => {
      if (!canvas) return false
      const W = img.naturalWidth
      const H = img.naturalHeight
      if (!W || !H) return false
      canvas.width = W * SUPER_SAMPLE
      canvas.height = H * SUPER_SAMPLE
      const off = document.createElement('canvas')
      off.width = W
      off.height = H
      const octx = off.getContext('2d', { willReadFrequently: true })
      if (!octx) return false
      octx.drawImage(img, 0, 0)
      let srcData: Uint8ClampedArray
      try {
        srcData = octx.getImageData(0, 0, W, H).data
      } catch {
        return false
      }
      model = classifyPenPixels(srcData, W, H)
      let tries = 0
      while (model.px.length < MIN_GOLD_PIXELS && tries < MAX_RELOAD_TRIES) {
        tries++
        octx.drawImage(img, 0, 0)
        try {
          srcData = octx.getImageData(0, 0, W, H).data
        } catch {
          return false
        }
        model = classifyPenPixels(srcData, W, H)
      }
      buf = document.createElement('canvas')
      buf.width = W
      buf.height = H
      bctx = buf.getContext('2d')
      if (!bctx) {
        buf = null
        return false
      }
      return true
    }

    const fallbackDrawFull = (img: HTMLImageElement): void => {
      // 解析に失敗した場合の予備: 実画像をそのまま全画面表示する
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      try {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, canvas.width || 300, canvas.height || 300)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      } catch {
        // 表示失敗でもタイマーで onDone する
      }
    }

    let built = false
    const img = new Image()
    const tryReady = (): void => {
      if (built || cancelled || finished) return
      // 画像読み込み完了の確認: 未完成デコードでの描画は禁止
      if (!img.complete || img.naturalWidth === 0) return
      built = true
      if (build(img)) {
        play()
      } else {
        fallbackDrawFull(img)
      }
    }
    const start = (): void => {
      if (cancelled || finished) return
      // rAFが止まっても5秒で必ず終了する（テストの fake timers でも確定する）
      timer = window.setTimeout(finish, OPENING_DURATION_MS)
      img.addEventListener('load', tryReady)
      img.src = LOGO_SRC
      const decode = (
        img as HTMLImageElement & {
          decode?: () => Promise<void>
        }
      ).decode
      if (typeof decode === 'function') {
        try {
          decode.call(img).then(tryReady, tryReady)
        } catch {
          // decode 失敗時は load イベント待ちに委ねる
        }
      }
      tryReady()
    }
    start()

    return () => {
      cancelled = true
      cancelFrame(rafId)
      if (timer !== undefined) window.clearTimeout(timer)
      img.removeEventListener('load', tryReady)
      document.body.style.overflow = previousOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      data-testid="keio-opening"
      className="keio-opening"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'all' }}
      role="presentation"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} data-testid="keio-opening-canvas" />
    </div>
  )
}
