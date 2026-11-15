import { useEffect, useRef } from 'react'

export const OPENING_DURATION_MS = 5000

/**
 * Source logo: public/keiologo-pens.png (used as-is, no tracing or redraw).
 * Explicit './' prefix so the file resolves from the built index.html even
 * under nested routes with Vite base './' (public/ files are copied to dist/).
 */
const LOGO_SRC = './keiologo-pens.png'

// ---- Constants ported from `.superpowers/brainstorm/pen-options18.html`
//      (classify / frame / drawFrame / init). ----
const D1X = 0.6106
const D1Y = 0.792
const D2X = -0.6376
const D2Y = 0.7704

const GOLD_THRESHOLD = 16
const MIN_GOLD_PIXELS = 20000
const MAX_RELOAD_TRIES = 3
const EDGE_BAND_PX = 10
// Zone-dependent gap thresholds (fix round 2 for [I5]). Row scans of
// keiologo-pens.png (280x272) show inter-pen gaps of 7-8px in y in
// [100, 210] (e.g. y=120: [56-175][182-224]; y=130: [68-184][190-212];
// y=170: [61-107][114-219]) while slit gaps inside a nib are <= 5px.
// Zone rows therefore merge only gaps < 6 (inter-pen gaps stay split and
// measurable); rows elsewhere keep the mockup's < 12. The edge band
// matches (6px in zone, 10px elsewhere) so a surviving zone split is
// always recorded as a measured edge.
const ZONE_Y0 = 100
const ZONE_Y1 = 210
const SLIT_GAP_ZONE_PX = 6
const SLIT_GAP_OTHER_PX = 12
const EDGE_BAND_ZONE_PX = 6
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

/**
 * Scan rows for measured edges and classify each gold pixel
 * into pen 1 / pen 2. No overlap (never painted twice).
 * Gap merging is zone-dependent: rows y in [100, 210] merge only gaps
 * < 6px (7-8px inter-pen gaps stay split, so both edges are measured;
 * <= 5px slits still merge); rows elsewhere merge gaps < 12px. The edge
 * band matches (6px in zone, 10px elsewhere). Rows that remain a single
 * merged block record no edge and fall back to interpolation below.
 */
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
    // Gaps shorter than the row's threshold count as slits inside one
    // block (< 6px in y [100, 210], < 12px elsewhere).
    const slitGap = y >= ZONE_Y0 && y <= ZONE_Y1 ? SLIT_GAP_ZONE_PX : SLIT_GAP_OTHER_PX
    const edgeBand = y >= ZONE_Y0 && y <= ZONE_Y1 ? EDGE_BAND_ZONE_PX : EDGE_BAND_PX
    const mg: Array<[number, number]> = []
    for (let k = 0; k < runs.length; k++) {
      if (mg.length > 0 && runs[k][0] - mg[mg.length - 1][1] < slitGap) {
        mg[mg.length - 1][1] = runs[k][1]
      } else {
        mg.push([runs[k][0], runs[k][1]])
      }
    }
    if (mg.length === 0) continue
    const first = mg[0]
    const last = mg[mg.length - 1]
    if (y < TOP_BOTTOM_SPLIT_Y) {
      // Upper half: the left block is pen 1. When the next block starts
      // with a black band, the first block's right end is the edge.
      arrL[y] = first[0]
      hasL[y] = 1
      if (mg.length >= 2 && mg[1][0] - first[1] >= edgeBand) {
        arrR[y] = first[1]
        hasR[y] = 1
      }
    } else {
      // Lower half: the right block is pen 1. When the previous block ends
      // with a black band, the last block's left end is the edge.
      // (Single merged blocks record nothing here; those rows fall back
      // to interpolation below.)
      if (mg.length >= 2 && last[0] - mg[mg.length - 2][1] >= edgeBand) {
        arrL[y] = last[0]
        hasL[y] = 1
        arrR[y] = last[1]
        hasR[y] = 1
      }
    }
  }
  // Rows without a measurement use linear interpolation (no curve fitting).
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
        a: 255,
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
 * Elapsed ratio el -> per-pen progress.
 * Phase 1 (el 0-0.30: pen 1) -> hold (0.30-0.45) ->
 * phase 2 (el 0.45-0.83: pen 2) -> hold -> done (el >= 1).
 */
export function phaseProgress(el: number): { p1: number; p2: number } {
  const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
  return {
    p1: clamp01(el / PHASE1_END),
    p2: clamp01((el - PHASE2_START) / (PHASE2_END - PHASE2_START)),
  }
}

/**
 * Paint pens into a 1x buffer, then upscale to the HiDPI canvas
 * with bilinear filtering.
 * A pen at full progress (p >= 1) copies its source pixels exactly
 * (no additive glow, full alpha), so drawFrame(model, ..., 1, 1) is
 * pixel-identical to the source image for opaque pixels.
 */
export function drawFrame(
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
  const full1 = p1 >= 1
  const full2 = p2 >= 1
  for (let k = 0; k < list.length; k++) {
    const p = list[k]
    if (p.nib1 ? full1 : full2) {
      d[p.i] = p.r
      d[p.i + 1] = p.g
      d[p.i + 2] = p.b
      d[p.i + 3] = p.a
      continue
    }
    const rel = p.nib1 ? (p1 - p.t1) / FRONT_WINDOW : (p2 - p.t2) / FRONT_WINDOW
    if (rel < 0) continue
    const am = rel >= 1 ? 1 : rel
    // Modest glow at the drawing front (additive light near the tip, max +90).
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
      // The end frame is always the source image itself (all gold pixels).
      try {
        renderAt(1, 1)
      } catch {
        // Even if painting fails, onDone must fire.
      }
      onDoneRef.current()
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
        // One bad frame must not stop playback.
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

    // Single verified read of one decoded image (no silent re-read loop).
    // Returns false on incomplete decode, low gold count, or missing 2d
    // context; the caller re-fetches with a cache-busted URL instead.
    const build = (img: HTMLImageElement): boolean => {
      if (!canvas) return false
      const W = img.naturalWidth
      const H = img.naturalHeight
      if (!W || !H) return false
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
      const m = classifyPenPixels(srcData, W, H)
      if (m.px.length < MIN_GOLD_PIXELS) return false
      canvas.width = W * SUPER_SAMPLE
      canvas.height = H * SUPER_SAMPLE
      buf = document.createElement('canvas')
      buf.width = W
      buf.height = H
      bctx = buf.getContext('2d')
      if (!bctx) {
        buf = null
        return false
      }
      model = m
      return true
    }

    const fallbackDrawFull = (img: HTMLImageElement): void => {
      // Backup when analysis fails: show the source image itself full-frame.
      if (!canvas) return
      const W = img.naturalWidth
      const H = img.naturalHeight
      try {
        if (W && H) {
          canvas.width = W * SUPER_SAMPLE
          canvas.height = H * SUPER_SAMPLE
        }
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, canvas.width || 300, canvas.height || 300)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      } catch {
        // Display failure still ends via the timer calling onDone.
      }
    }

    // Load one image with decode-await and error reporting.
    const loadOne = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const im = new Image()
        const cleanup = (): void => {
          im.removeEventListener('load', onLoad)
          im.removeEventListener('error', onError)
        }
        const onLoad = (): void => {
          cleanup()
          resolve(im)
        }
        const onError = (): void => {
          cleanup()
          reject(new Error(`opening logo load failed: ${src}`))
        }
        im.addEventListener('load', onLoad)
        im.addEventListener('error', onError)
        im.src = src
      })

    const awaitDecode = async (img: HTMLImageElement): Promise<void> => {
      const decode = (img as HTMLImageElement & { decode?: () => Promise<void> })
        .decode
      if (typeof decode !== 'function') return
      try {
        await decode.call(img)
      } catch {
        // Fall through to the load-based pixels.
      }
    }

    let built = false
    const run = async (): Promise<void> => {
      let lastImg: HTMLImageElement | null = null
      // Up to 3 re-reads (brief item 1), each a fresh fetch with a
      // cache-busted URL so an incomplete decode can actually recover.
      for (let attempt = 0; attempt <= MAX_RELOAD_TRIES; attempt++) {
        if (cancelled || finished || built) return
        const src = attempt === 0 ? LOGO_SRC : `${LOGO_SRC}?retry=${attempt}`
        let im: HTMLImageElement
        try {
          im = await loadOne(src)
        } catch {
          continue // onerror -> re-fetch with the next cache-busted URL
        }
        lastImg = im
        await awaitDecode(im)
        if (cancelled || finished || built) return
        // Never paint from an incomplete decode.
        if (!im.complete || im.naturalWidth === 0) continue
        if (build(im)) {
          built = true
          play()
          return
        }
      }
      if (!built && lastImg) fallbackDrawFull(lastImg)
    }

    // prefers-reduced-motion: paint the finished logo first, then finish
    // immediately (no 5s wait). The image load starts BEFORE onDone.
    if (isReducedMotion()) {
      const staticImg = new Image()
      const paintStatic = (): void => {
        if (cancelled || finished) return
        if (!staticImg.complete || staticImg.naturalWidth === 0) return
        if (build(staticImg)) {
          renderAt(1, 1)
        } else {
          fallbackDrawFull(staticImg)
        }
      }
      staticImg.addEventListener('load', paintStatic)
      const staticDecode = (
        staticImg as HTMLImageElement & { decode?: () => Promise<void> }
      ).decode
      if (typeof staticDecode === 'function') {
        try {
          staticDecode.call(staticImg).then(paintStatic, paintStatic)
        } catch {
          // Fall through to the load event path.
        }
      }
      staticImg.src = LOGO_SRC
      paintStatic() // synchronous paint when the logo is already cached
      finished = true
      onDoneRef.current()
      return () => {
        staticImg.removeEventListener('load', paintStatic)
        document.body.style.overflow = previousOverflow
      }
    }

    const start = (): void => {
      if (cancelled || finished) return
      // rAF-independent guarantee: always end after 5s
      // (also deterministic under fake timers).
      timer = window.setTimeout(finish, OPENING_DURATION_MS)
      run().catch(() => {
        // Failures still end via the timer calling onDone.
      })
    }
    start()

    return () => {
      cancelled = true
      cancelFrame(rafId)
      if (timer !== undefined) window.clearTimeout(timer)
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
