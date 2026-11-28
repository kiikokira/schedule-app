// SFCキャンパスを探索する2D RPGのゲームループ Canvas。
// ゲーム状態はすべてrefに保持し、描画と入力をrequestAnimationFrameで回す。

import { useEffect, useRef, type KeyboardEvent, type MutableRefObject } from 'react'
import { drawCampusBase } from '../lib/sfcCampusArt'
import {
  drawHotspotMarker,
  drawStudent,
  type Direction,
} from '../lib/sfcCampusSprite'
import {
  clampCamera,
  findPath,
  isWalkable,
  moveWithCollision,
  nearestWalkable,
  type PadState,
  type Point,
  type WalkOptions,
} from '../lib/sfcCampusMovement'
import {
  BLOCKERS,
  HOTSPOTS,
  LABELS,
  MAP_H,
  MAP_W,
  PLAYER_RADIUS,
  SPAWN,
  ZOOM,
  findNearbyHotspot,
  nearestArea,
  type Hotspot,
} from '../lib/sfcCampusMap'

type Props = {
  padRef: MutableRefObject<PadState>
  paused?: boolean
  onNearbyChange?: (hotspot: Hotspot | null) => void
  onAction?: () => void
  onAreaChange?: (area: string) => void
  onCancel?: () => void
}

const SPEED = 110
const TAU = Math.PI * 2
const WALK_OPTIONS: WalkOptions = {
  blockers: BLOCKERS,
  radius: PLAYER_RADIUS,
  mapW: MAP_W,
  mapH: MAP_H,
}
const KEY_VECTORS: Record<string, readonly [number, number]> = {
  w: [0, -1],
  arrowup: [0, -1],
  s: [0, 1],
  arrowdown: [0, 1],
  a: [-1, 0],
  arrowleft: [-1, 0],
  d: [1, 0],
  arrowright: [1, 0],
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true
}

function directionOf(dx: number, dy: number): Direction {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'down' : 'up'
}

function drawDebug(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= MAP_W; x += 100) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, MAP_H)
  }
  for (let y = 0; y <= MAP_H; y += 100) {
    ctx.moveTo(0, y)
    ctx.lineTo(MAP_W, y)
  }
  ctx.stroke()

  ctx.globalAlpha = 0.75
  ctx.fillStyle = '#ffffff'
  ctx.font = '10px system-ui'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (let x = 0; x < MAP_W; x += 200) ctx.fillText(String(x), x + 2, 2)
  for (let y = 200; y < MAP_H; y += 200) ctx.fillText(String(y), 2, y + 2)

  ctx.globalAlpha = 0.8
  ctx.strokeStyle = '#ef4444'
  for (const b of BLOCKERS) {
    if (b.kind === 'rect') {
      ctx.strokeRect(b.x, b.y, b.w, b.h)
    } else if (b.kind === 'poly') {
      ctx.beginPath()
      b.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.closePath()
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, TAU)
      ctx.stroke()
    }
  }

  ctx.globalAlpha = 0.8
  ctx.strokeStyle = '#60a5fa'
  for (const h of HOTSPOTS) {
    ctx.beginPath()
    ctx.arc(h.x, h.y, h.r, 0, TAU)
    ctx.stroke()
  }
  ctx.restore()
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  view: { x: number; y: number; w: number; h: number },
): void {
  const margin = 24
  for (const label of LABELS) {
    if (
      label.x < view.x - margin ||
      label.x > view.x + view.w + margin ||
      label.y < view.y - margin ||
      label.y > view.y + view.h + margin
    ) {
      continue
    }
    if (label.kind === 'building') {
      ctx.font = '600 8px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const w = ctx.measureText(label.text).width
      ctx.globalAlpha = 0.78
      ctx.fillStyle = '#1e2a5a'
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(label.x - w / 2 - 2, label.y - 5, w + 4, 10, 3)
      } else {
        ctx.rect(label.x - w / 2 - 2, label.y - 5, w + 4, 10)
      }
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label.text, label.x, label.y)
    } else {
      ctx.font = '600 12px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = 0.85
      ctx.lineWidth = 3
      ctx.strokeStyle = '#0b1f16'
      ctx.strokeText(label.text, label.x, label.y)
      ctx.fillStyle = '#f8fafc'
      ctx.fillText(label.text, label.x, label.y)
      ctx.globalAlpha = 1
    }
  }
}

export default function SfcCampusCanvas({
  padRef,
  paused = false,
  onNearbyChange,
  onAction,
  onAreaChange,
  onCancel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const posRef = useRef<Point>({ x: SPAWN.x, y: SPAWN.y })
  const camRef = useRef<Point>({ x: SPAWN.x, y: SPAWN.y })
  const dirRef = useRef<Direction>('down')
  const walkTimeRef = useRef(0)
  const pathRef = useRef<Point[]>([])
  const pendingHotspotRef = useRef<string | null>(null)
  const keysRef = useRef<Set<string>>(new Set())
  const nearbyIdRef = useRef<string | null>(null)
  const areaRef = useRef('')
  const lastAreaAtRef = useRef(0)
  const sizeRef = useRef({ w: 0, h: 0 })
  const viewRef = useRef({ w: 0, h: 0 })
  const dprRef = useRef(1)

  const pausedRef = useRef(paused)
  const onNearbyChangeRef = useRef(onNearbyChange)
  const onActionRef = useRef(onAction)
  const onAreaChangeRef = useRef(onAreaChange)
  const onCancelRef = useRef(onCancel)
  pausedRef.current = paused
  onNearbyChangeRef.current = onNearbyChange
  onActionRef.current = onAction
  onAreaChangeRef.current = onAreaChange
  onCancelRef.current = onCancel

  useEffect(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 背景はMAP_W x MAP_Hのオフスクリーンに一度だけ描く。
    const base = document.createElement('canvas')
    base.width = MAP_W
    base.height = MAP_H
    const baseCtx = base.getContext('2d')
    if (!baseCtx) return
    drawCampusBase(baseCtx)

    const debug = new URLSearchParams(window.location.search).get('sfcdebug') === '1'

    const resize = (): void => {
      const rect = wrapper.getBoundingClientRect()
      const cssW = Math.max(1, rect.width || wrapper.clientWidth || 320)
      const cssH = Math.max(1, rect.height || wrapper.clientHeight || 240)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      sizeRef.current = { w: cssW, h: cssH }
      viewRef.current = { w: cssW / ZOOM, h: cssH / ZOOM }
      dprRef.current = dpr
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(wrapper)

    const onPointerDown = (event: PointerEvent): void => {
      if (pausedRef.current) return
      const rect = canvas.getBoundingClientRect()
      const view = viewRef.current
      const cam = camRef.current
      const topLeft = { x: cam.x - view.w / 2, y: cam.y - view.h / 2 }
      const target = {
        x: topLeft.x + (event.clientX - rect.left) / ZOOM,
        y: topLeft.y + (event.clientY - rect.top) / ZOOM,
      }
      const hit = HOTSPOTS.find(
        (h) => Math.hypot(target.x - h.x, target.y - h.y) <= h.r,
      )
      const aim = hit ? { x: hit.x, y: hit.y } : target
      if (hit && findNearbyHotspot(posRef.current.x, posRef.current.y)?.id === hit.id) {
        onActionRef.current?.()
        return
      }
      pendingHotspotRef.current = hit ? hit.id : null
      const goal = isWalkable(aim, WALK_OPTIONS)
        ? aim
        : nearestWalkable(aim, WALK_OPTIONS, 16)
      const found = findPath(posRef.current, goal, WALK_OPTIONS, 16)
      if (found.length === 0) {
        pendingHotspotRef.current = null
        return
      }
      const first = found[0]
      if (Math.hypot(first.x - posRef.current.x, first.y - posRef.current.y) < 1) {
        found.shift()
      }
      pathRef.current = found
    }
    canvas.addEventListener('pointerdown', onPointerDown)

    const onBlur = (): void => {
      keysRef.current.clear()
    }
    window.addEventListener('blur', onBlur)

    let raf = 0
    let last = typeof performance !== 'undefined' ? performance.now() : 0
    const frame = (now: number): void => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      const isPaused = pausedRef.current
      let moving = false

      if (!isPaused) {
        let dx = padRef.current?.dx ?? 0
        let dy = padRef.current?.dy ?? 0
        for (const key of keysRef.current) {
          const v = KEY_VECTORS[key]
          if (v) {
            dx += v[0]
            dy += v[1]
          }
        }
        const mag = Math.hypot(dx, dy)
        if (mag > 0) {
          dx /= mag
          dy /= mag
          pathRef.current = []
          pendingHotspotRef.current = null
          const next = moveWithCollision(
            posRef.current,
            dx * SPEED * dt,
            dy * SPEED * dt,
            WALK_OPTIONS,
          )
          moving = next.x !== posRef.current.x || next.y !== posRef.current.y
          posRef.current = next
          dirRef.current = directionOf(dx, dy)
        } else if (pathRef.current.length > 0) {
          let budget = SPEED * dt
          while (budget > 0 && pathRef.current.length > 0) {
            const target = pathRef.current[0]
            const vx = target.x - posRef.current.x
            const vy = target.y - posRef.current.y
            const dist = Math.hypot(vx, vy)
            if (dist <= 4) {
              pathRef.current.shift()
              continue
            }
            const step = Math.min(budget, dist)
            const next = moveWithCollision(
              posRef.current,
              (vx / dist) * step,
              (vy / dist) * step,
              WALK_OPTIONS,
            )
            const travelled = Math.hypot(next.x - posRef.current.x, next.y - posRef.current.y)
            if (travelled < 0.001) {
              pathRef.current = []
              break
            }
            posRef.current = next
            moving = true
            dirRef.current = directionOf(vx, vy)
            budget -= step
          }
        }
        if (moving) walkTimeRef.current += dt
      }

      // 近傍ホットスポットは変化したときだけ通知する。
      const nearby = findNearbyHotspot(posRef.current.x, posRef.current.y)
      const nearbyId = nearby?.id ?? null
      if (nearbyId !== nearbyIdRef.current) {
        nearbyIdRef.current = nearbyId
        onNearbyChangeRef.current?.(nearby)
      }

      // エリア名は0.5秒ごとに再計算し、変化したときだけ通知する。
      if (now - lastAreaAtRef.current >= 500) {
        lastAreaAtRef.current = now
        const area = nearestArea(posRef.current.x, posRef.current.y)
        if (area !== areaRef.current) {
          areaRef.current = area
          onAreaChangeRef.current?.(area)
        }
      }

      if (pendingHotspotRef.current && pathRef.current.length === 0) {
        if (nearbyIdRef.current === pendingHotspotRef.current) onActionRef.current?.()
        pendingHotspotRef.current = null
      }

      const view = viewRef.current
      const map = { w: MAP_W, h: MAP_H }
      const targetCam = clampCamera(posRef.current, view, map, 1)
      const k = 1 - Math.exp(-10 * dt)
      camRef.current = clampCamera(
        {
          x: camRef.current.x + (targetCam.x - camRef.current.x) * k,
          y: camRef.current.y + (targetCam.y - camRef.current.y) * k,
        },
        view,
        map,
        1,
      )

      const dpr = dprRef.current
      const size = sizeRef.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.w, size.h)
      ctx.save()
      ctx.scale(ZOOM, ZOOM)
      const topLeft = {
        x: camRef.current.x - view.w / 2,
        y: camRef.current.y - view.h / 2,
      }
      ctx.translate(-topLeft.x, -topLeft.y)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(base, 0, 0, MAP_W, MAP_H)

      drawLabels(ctx, { ...topLeft, w: view.w, h: view.h })

      const t = now / 1000
      for (const h of HOTSPOTS) {
        drawHotspotMarker(ctx, h.x, h.y - 18, h.id === nearbyIdRef.current, t)
      }
      const walkFrame = Math.floor(walkTimeRef.current * 6) % 2
      drawStudent(
        ctx,
        posRef.current.x,
        posRef.current.y,
        dirRef.current,
        walkFrame as 0 | 1,
        moving,
      )

      if (debug) drawDebug(ctx)
      ctx.restore()

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('blur', onBlur)
    }
  }, [padRef])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isTypingTarget(event.target)) return
    const key = event.key.toLowerCase()
    if (key === 'escape') {
      onCancelRef.current?.()
      return
    }
    if (key === 'enter' || key === ' ' || key === 'spacebar') {
      if (key === ' ') event.preventDefault()
      if (!pausedRef.current && nearbyIdRef.current) onActionRef.current?.()
      return
    }
    if (KEY_VECTORS[key]) {
      keysRef.current.add(key)
      if (key.startsWith('arrow')) event.preventDefault()
    }
  }

  const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>): void => {
    const key = event.key.toLowerCase()
    if (KEY_VECTORS[key]) keysRef.current.delete(key)
  }

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={() => keysRef.current.clear()}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#0b1f16',
      }}
    >
      <canvas
        ref={canvasRef}
        data-testid="sfc-campus-canvas"
        aria-label="SFCキャンパスマップ"
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      />
    </div>
  )
}
