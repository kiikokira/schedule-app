import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import OpeningSplash, { classifyPenPixels, drawFrame } from './OpeningSplash'
import type { PenModel } from './OpeningSplash'

const originalMatchMedia = window.matchMedia
const originalGetContext = HTMLCanvasElement.prototype.getContext

afterEach(() => {
  window.matchMedia = originalMatchMedia
  HTMLCanvasElement.prototype.getContext = originalGetContext
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('OpeningSplash', () => {
  it('calls onDone after 5s and blocks pointer events', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<OpeningSplash onDone={onDone} />)
    const overlay = screen.getByTestId('keio-opening')
    expect(overlay).toBeInTheDocument()
    expect(overlay).toHaveStyle({ pointerEvents: 'all' })
    expect(screen.getByTestId('keio-opening-canvas')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(4999) })
    expect(onDone).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onDone).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('respects reduced motion by finishing immediately', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} })
    const onDone = vi.fn()
    render(<OpeningSplash onDone={onDone} />)
    expect(screen.getByTestId('keio-opening')).toBeInTheDocument()
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})

// ---- Fix-round covering tests (task review findings C1/C2/I3/I4/I5) ----

function makeSrcData(
  W: number,
  H: number,
  gold: (x: number, y: number) => boolean,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4
      if (gold(x, y)) {
        data[o] = 210
        data[o + 1] = 190
        data[o + 2] = 70
        data[o + 3] = 255
      } else {
        data[o] = 0
        data[o + 1] = 0
        data[o + 2] = 0
        data[o + 3] = 255
      }
    }
  }
  return data
}

type FakeImageData = { data: Uint8ClampedArray; width: number; height: number }

type FakeCtx = {
  putImageDataCalls: FakeImageData[]
  drawImageCalls: unknown[][]
  getImageDataCalls: number
  read: () => Uint8ClampedArray
  createImageData: (w: number, h: number) => FakeImageData
  putImageData: (img: FakeImageData) => void
  getImageData: () => FakeImageData
  drawImage: (..._args: unknown[]) => void
  clearRect: (..._args: unknown[]) => void
  fillRect: (..._args: unknown[]) => void
  imageSmoothingEnabled: boolean
  imageSmoothingQuality: string
}

function installCanvasStub(read: () => Uint8ClampedArray, ctxs: FakeCtx[]): void {
  const makeCtx = (): FakeCtx => {
    const ctx: FakeCtx = {
      putImageDataCalls: [],
      drawImageCalls: [],
      getImageDataCalls: 0,
      read,
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      putImageData: (img: FakeImageData) => {
        ctx.putImageDataCalls.push(img)
      },
      getImageData: () => {
        ctx.getImageDataCalls += 1
        const data = ctx.read()
        return { data, width: 150, height: 150 }
      },
      drawImage: (..._args: unknown[]) => {
        ctx.drawImageCalls.push(_args)
      },
      clearRect: (..._args: unknown[]) => {},
      fillRect: (..._args: unknown[]) => {},
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
    }
    ctxs.push(ctx)
    return ctx
  }
  HTMLCanvasElement.prototype.getContext = (function () {
    return makeCtx()
  } as unknown as typeof HTMLCanvasElement.prototype.getContext)
}

const requestedSrcs: string[] = []

class FakeImage {
  complete = false
  naturalWidth = 0
  naturalHeight = 0
  private listeners = new Map<string, Array<() => void>>()
  constructor(
    private imgW = 150,
    private imgH = 150,
  ) {}
  addEventListener(type: string, cb: () => void): void {
    const arr = this.listeners.get(type) ?? []
    arr.push(cb)
    this.listeners.set(type, arr)
  }
  removeEventListener(type: string, cb: () => void): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((f) => f !== cb),
    )
  }
  set src(v: string) {
    requestedSrcs.push(v)
    this.naturalWidth = this.imgW
    this.naturalHeight = this.imgH
    this.complete = true
    for (const cb of this.listeners.get('load') ?? []) cb()
  }
  get src(): string {
    return requestedSrcs[requestedSrcs.length - 1] ?? ''
  }
}

function stubImage(): void {
  requestedSrcs.length = 0
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image)
}

describe('OpeningSplash fix round', () => {
  it('[C1] drawFrame(1,1) is pixel-identical to the source (no tail glow)', () => {
    const W = 4
    const H = 1
    const model: PenModel = {
      W,
      H,
      px: [0, 1, 2, 3].map((x) => ({
        i: x * 4,
        t1: x === 2 ? 1 : x * 0.495, // edge t==1 pixel + last-frontier pixel
        t2: x === 3 ? 0.99 : 0.2,
        nib1: x !== 3,
        r: 200,
        g: 180,
        b: 60,
        a: 255,
      })),
    }
    let composed: FakeImageData | null = null
    const bctx = {
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      putImageData: (img: FakeImageData) => {
        composed = img
      },
    }
    let presented = 0
    const cv = {
      width: 12,
      height: 3,
      getContext: () => ({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        clearRect: () => {},
        fillRect: () => {},
        drawImage: () => {
          presented += 1
        },
      }),
    }
    // Partial progress leaves the last-frontier band translucent.
    drawFrame(
      model,
      {} as unknown as HTMLCanvasElement,
      bctx as unknown as CanvasRenderingContext2D,
      cv as unknown as HTMLCanvasElement,
      0.5,
      0,
    )
    const partial = composed as unknown as FakeImageData
    expect(partial.data[2 * 4 + 3]).toBe(0) // t==1 edge pixel not yet painted
    // Full progress paints every pixel exactly (alpha 255, no +90 boost).
    drawFrame(
      model,
      {} as unknown as HTMLCanvasElement,
      bctx as unknown as CanvasRenderingContext2D,
      cv as unknown as HTMLCanvasElement,
      1,
      1,
    )
    const full = composed as unknown as FakeImageData
    for (const p of model.px) {
      expect(full.data[p.i]).toBe(p.r)
      expect(full.data[p.i + 1]).toBe(p.g)
      expect(full.data[p.i + 2]).toBe(p.b)
      expect(full.data[p.i + 3]).toBe(p.a)
    }
    expect(presented).toBe(2)
  })

  it('[C2/I3] reduced motion paints the full logo from ./keiologo-pens.png before onDone', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    stubImage()
    const ctxs: FakeCtx[] = []
    const dense = makeSrcData(150, 150, () => true)
    installCanvasStub(() => dense, ctxs)
    const onDone = vi.fn()
    render(<OpeningSplash onDone={onDone} />)
    // Logo path stays relative to the built index.html (Vite base './').
    expect(requestedSrcs[0]).toBe('./keiologo-pens.png')
    // The finished frame was composed (putImageData) and presented (drawImage).
    expect(ctxs.some((c) => c.putImageDataCalls.length > 0)).toBe(true)
    expect(ctxs.some((c) => c.drawImageCalls.length > 0)).toBe(true)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('[I4] incomplete decode is retried via a cache-busted reload', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    stubImage()
    const ctxs: FakeCtx[] = []
    const dense = makeSrcData(150, 150, () => true)
    const empty = new Uint8ClampedArray(150 * 150 * 4)
    let reads = 0
    installCanvasStub(() => {
      reads += 1
      return reads === 1 ? empty : dense // first read: incomplete decode
    }, ctxs)
    const onDone = vi.fn()
    const { unmount } = render(<OpeningSplash onDone={onDone} />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    // Same image re-fetched with a cache-busting query (not a silent re-read).
    expect(requestedSrcs[0]).toBe('./keiologo-pens.png')
    expect(requestedSrcs).toContain('./keiologo-pens.png?retry=1')
    expect(onDone).not.toHaveBeenCalled()
    unmount()
  })

  it('[I5] lower-half single merged blocks fall back to interpolation (mockup-aligned)', () => {
    const W = 40
    const H = 160
    const data = makeSrcData(
      W,
      H,
      (x, y) =>
        (y >= 10 && y <= 20 && ((x >= 2 && x <= 8) || (x >= 20 && x <= 30))) ||
        (y >= 150 && x >= 5 && x <= 25),
    )
    const model = classifyPenPixels(data, W, H)
    expect(model.px.length).toBeGreaterThan(0)
    const nib1At = (x: number, y: number): boolean => {
      const hit = model.px.find((p) => p.i === (y * W + x) * 4)
      if (!hit) throw new Error(`expected gold pixel at (${x},${y})`)
      return hit.nib1
    }
    // Upper two-block rows are measured directly: left block is pen 1.
    expect(nib1At(5, 15)).toBe(true)
    expect(nib1At(25, 15)).toBe(false)
    // Lower single-merged-block rows record no edge (same as the mockup:
    // its y>=150 branch also requires mg.length >= 2 with a >= 10px gap),
    // so row 155 inherits the interpolated edge [2..8] from row 20.
    expect(nib1At(5, 155)).toBe(true)
    expect(nib1At(25, 155)).toBe(false)
  })
})
