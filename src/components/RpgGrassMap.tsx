import { useEffect, useMemo, useRef, useState } from 'react'
import {
  GRASS_NODES,
  GRASS_PATHS,
  GRASS_STAGES,
  findGrassRoute,
  grassNodeById,
  grassPathLength,
  positionAlongGrassPath,
  type GrassPath,
} from '../lib/rpgGrassWorld'
import { advanceAlongPath, canCancelState, pathKindToAnimDirected, type MoveState } from '../lib/rpgMovement'
import { clearRpgStage, loadRpgProgress, markWorldVisited, saveRpgProgress, type RpgProgressState } from '../lib/rpgProgress'
import { stageActionFor } from '../lib/rpgStageAdapter'
import RpgCharacter from './RpgCharacter'

type Props = {
  todayPages: number
  totalPages: number
  firstBookId: string | null
  hasBooks: boolean
  onStageAction?: (stageId: string, target: string) => void
  onBack?: () => void
  initialNodeId?: string
  initialCameraMode?: 'follow' | 'overview'
  initialProgress?: RpgProgressState
}

type RouteStep = { path: GrassPath; fromId: string; toId: string }

const WORLD_W = 720
const WORLD_H = 440
const FOLLOW_W = 360
const FOLLOW_H = 220

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function routeBetween(fromId: string, toId: string, unlocked: Set<string>): RouteStep[] | null {
  const nodes = findGrassRoute(fromId, toId, unlocked)
  if (!nodes) return null
  const steps: RouteStep[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i]
    const b = nodes[i + 1]
    const p = GRASS_PATHS.find(
      (path) => unlocked.has(path.id) && ((path.fromId === a && path.toId === b) || (!path.oneWay && path.fromId === b && path.toId === a)),
    )
    if (!p) return null
    steps.push({ path: p, fromId: a, toId: b })
  }
  return steps
}

export default function RpgGrassMap({
  todayPages,
  totalPages,
  firstBookId,
  hasBooks,
  onStageAction,
  onBack,
  initialNodeId,
  initialCameraMode = 'follow',
  initialProgress,
}: Props) {
  const [progress, setProgress] = useState<RpgProgressState>(() => initialProgress ?? loadRpgProgress())
  const [currentNodeId, setCurrentNodeId] = useState(() => initialNodeId ?? initialProgress?.lastKnownNodeId?.['1'] ?? loadRpgProgress().lastKnownNodeId['1'] ?? 'g-n0')
  const [cameraMode, setCameraMode] = useState<'follow' | 'overview'>(initialCameraMode)
  const [anim, setAnim] = useState<MoveState>('IDLE')
  const [facing, setFacing] = useState<1 | -1>(1)
  const [panelStageId, setPanelStageId] = useState<string | null>(null)
  const [shiftRun, setShiftRun] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const charRef = useRef<SVGGElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const startNode = grassNodeById(initialNodeId ?? initialProgress?.lastKnownNodeId?.['1'] ?? 'g-n0')
  const live = useRef({
    nodeId: startNode.id,
    steps: [] as RouteStep[],
    stepIndex: 0,
    dist: 0,
    moving: false,
    autoThrough: false,
    phase: 'idle' as 'idle' | 'turn' | 'prepare' | 'move' | 'land' | 'stage',
    phaseTime: 0,
    pendingPath: null as GrassPath | null,
    pendingFrom: '',
    pendingTo: '',
    landTo: '',
    paused: false,
    pos: { x: startNode.x, y: startNode.y, h: startNode.h, dirX: 1, dirY: 0 },
    cam: {
      x: initialCameraMode === 'overview' ? 0 : clamp(startNode.x - FOLLOW_W / 2, 0, WORLD_W - FOLLOW_W),
      y: initialCameraMode === 'overview' ? 0 : clamp(startNode.y - FOLLOW_H / 2 - 20, 0, WORLD_H - FOLLOW_H),
      w: initialCameraMode === 'overview' ? WORLD_W : FOLLOW_W,
      h: initialCameraMode === 'overview' ? WORLD_H : FOLLOW_H,
    },
  })

  const unlocked = useMemo(() => new Set(progress.unlockedPathIds), [progress])
  void totalPages

  // 初回: 訪問を記録して保存する
  useEffect(() => {
    setProgress((prev) => {
      const next = markWorldVisited(prev, 1)
      saveRpgProgress({ ...next, lastKnownNodeId: { ...next.lastKnownNodeId, '1': live.current.nodeId } })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = (next: RpgProgressState) => {
    setProgress(next)
    saveRpgProgress(next)
  }

  const arriveAt = (nodeId: string) => {
    const st = live.current
    st.nodeId = nodeId
    st.moving = false
    st.phase = 'idle'
    st.pendingPath = null
    setCurrentNodeId(nodeId)
    const node = grassNodeById(nodeId)
    setProgress((prev) => {
      const next: RpgProgressState = { ...prev, lastKnownNodeId: { ...prev.lastKnownNodeId, '1': nodeId } }
      saveRpgProgress(next)
      return next
    })
    if (node.stageId) {
      st.phase = 'stage'
      st.phaseTime = 0
      setAnim('ENTER_STAGE')
    } else {
      setAnim('IDLE')
    }
  }

  const beginStep = (path: GrassPath, fromId: string, toId: string) => {
    const st = live.current
    if (!canCancelState(anim) || st.moving) return
    const to = grassNodeById(toId)
    const dirX = to.x - grassNodeById(fromId).x
    const wantFacing: 1 | -1 = dirX >= 0 ? 1 : -1
    st.pendingPath = path
    st.pendingFrom = fromId
    st.pendingTo = toId
    st.dist = 0
    if (wantFacing !== facing) {
      setFacing(wantFacing)
      setAnim('TURN')
      st.phase = 'turn'
      st.phaseTime = 0
    } else if (path.kind === 'jump') {
      setAnim('JUMP_PREPARE')
      st.phase = 'prepare'
      st.phaseTime = 0
    } else {
      st.phase = 'move'
      st.moving = true
      const reversed = fromId !== path.fromId
      const eff = path.kind === 'walk' && shiftRun ? 'run' : path.kind
      setAnim(pathKindToAnimDirected(eff, reversed))
    }
  }

  const startRoute = (steps: RouteStep[], autoThrough: boolean) => {
    if (steps.length === 0) return
    live.current.steps = steps
    live.current.stepIndex = 0
    live.current.autoThrough = autoThrough
    const s = steps[0]
    beginStep(s.path, s.fromId, s.toId)
  }

  const stepToward = (dx: number, dy: number) => {
    const st = live.current
    if (st.moving || st.phase !== 'idle' || cameraMode === 'overview') return
    const cur = grassNodeById(st.nodeId)
    let best: { path: GrassPath; to: string; dot: number } | null = null
    for (const p of GRASS_PATHS) {
      if (!unlocked.has(p.id)) continue
      let to: string | null = null
      if (p.fromId === st.nodeId) to = p.toId
      else if (!p.oneWay && p.toId === st.nodeId) to = p.fromId
      if (!to) continue
      const n = grassNodeById(to)
      const vx = n.x - cur.x
      const vy = n.y - cur.y
      const len = Math.hypot(vx, vy) || 1
      const dot = (vx / len) * dx + (vy / len) * dy
      if (!best || dot > best.dot) best = { path: p, to, dot }
    }
    if (best && best.dot > 0.25) startRoute([{ path: best.path, fromId: st.nodeId, toId: best.to }], false)
  }

  const tapNode = (nodeId: string) => {
    const st = live.current
    if (st.moving || st.phase !== 'idle' || cameraMode === 'overview') return
    if (nodeId === st.nodeId) return
    const steps = routeBetween(st.nodeId, nodeId, unlocked)
    if (steps) {
      setPanelStageId(null)
      startRoute(steps, true)
    }
  }

  // 描画ループ（UI state と分離：位置・カメラは ref で直接更新する）
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
      last = now
      const st = live.current
      const camTarget =
        cameraMode === 'overview'
          ? { x: 0, y: 0, w: WORLD_W, h: WORLD_H }
          : {
              x: clamp(st.pos.x - FOLLOW_W / 2, 0, WORLD_W - FOLLOW_W),
              y: clamp(st.pos.y - FOLLOW_H / 2 - 20, 0, WORLD_H - FOLLOW_H),
              w: FOLLOW_W,
              h: FOLLOW_H,
            }
      const k = reduced ? 1 : 1 - Math.exp(-5 * dt)
      st.cam.x += (camTarget.x - st.cam.x) * k
      st.cam.y += (camTarget.y - st.cam.y) * k
      st.cam.w += (camTarget.w - st.cam.w) * k
      st.cam.h += (camTarget.h - st.cam.h) * k
      if (svgRef.current) {
        svgRef.current.setAttribute('viewBox', `${st.cam.x} ${st.cam.y} ${st.cam.w} ${st.cam.h}`)
      }
      if (!st.paused && cameraMode === 'follow') {
        if (st.phase === 'turn' || st.phase === 'prepare') {
          st.phaseTime += dt
          const need = st.phase === 'turn' ? 0.12 : 0.22
          if (st.phaseTime >= need && st.pendingPath) {
            st.phase = 'move'
            st.moving = true
            const reversed = st.pendingFrom !== st.pendingPath.fromId
            const eff = st.pendingPath.kind === 'walk' && shiftRun ? 'run' : st.pendingPath.kind
            setAnim(pathKindToAnimDirected(eff, reversed))
          }
        } else if (st.phase === 'move' && st.pendingPath) {
          const len = grassPathLength(st.pendingPath)
          const speed = st.pendingPath.moveSpeed * (st.pendingPath.kind === 'walk' && shiftRun ? 1.4 : 1)
          st.dist = advanceAlongPath(st.dist, speed, dt, len)
          // 向きに応じてジャンプ上昇/下降を切り替える
          if (st.pendingPath.kind === 'jump') {
            setAnim(st.dist / len < 0.5 ? 'JUMP_ASCEND' : 'JUMP_DESCEND')
          } else if (st.pendingPath.kind === 'fall') {
            setAnim('FALL')
          }
          const pose = positionAlongGrassPath(st.pendingPath, st.dist)
          st.pos = { x: pose.x, y: pose.y, h: pose.h, dirX: pose.dirX, dirY: pose.dirY }
          if (pose.dirX !== 0) setFacing(pose.dirX >= 0 ? 1 : -1)
          if (st.dist >= len) {
            const arrivedId = st.pendingTo
            const node = grassNodeById(arrivedId)
            if (st.pendingPath.kind === 'jump' || st.pendingPath.kind === 'fall') {
              st.phase = 'land'
              st.phaseTime = 0
              setAnim('LAND')
              st.pendingPath = null
              st.landTo = arrivedId
            } else if (st.autoThrough && !node.stopOnArrival) {
              st.stepIndex += 1
              const next = st.steps[st.stepIndex]
              if (next) {
                st.pendingPath = next.path
                st.pendingFrom = next.fromId
                st.pendingTo = next.toId
                st.dist = 0
                setAnim(pathKindToAnimDirected(next.path.kind, next.fromId !== next.path.fromId))
              } else {
                arriveAt(arrivedId)
              }
            } else if (st.autoThrough && st.stepIndex < st.steps.length - 1) {
              st.stepIndex += 1
              const next = st.steps[st.stepIndex]
              st.pendingPath = next.path
              st.pendingFrom = next.fromId
              st.pendingTo = next.toId
              st.dist = 0
              setAnim(pathKindToAnimDirected(next.path.kind, next.fromId !== next.path.fromId))
            } else {
              arriveAt(arrivedId)
            }
          }
        } else if (st.phase === 'land') {
          st.phaseTime += dt
          if (st.phaseTime >= 0.25) {
            const to = st.landTo || st.pendingTo
            st.moving = false
            arriveAt(to)
          }
        } else if (st.phase === 'stage') {
          st.phaseTime += dt
          if (st.phaseTime >= 0.5) {
            st.phase = 'idle'
            setAnim('IDLE')
            const node = grassNodeById(st.nodeId)
            if (node.stageId) setPanelStageId(node.stageId)
          }
        }
      }
      // キャラ・影の描画
      if (charRef.current) {
        charRef.current.setAttribute('transform', `translate(${st.pos.x - 28} ${st.pos.y - 66 - st.pos.h * 0.6})`)
      }
      if (shadowRef.current) {
        const lift = Math.max(0, st.pos.h - grassNodeById(st.nodeId).h)
        const s = clamp(1 - lift / 120, 0.45, 1)
        shadowRef.current.setAttribute('cx', String(st.pos.x))
        shadowRef.current.setAttribute('cy', String(st.pos.y + 4))
        shadowRef.current.setAttribute('rx', String(20 * s))
        shadowRef.current.setAttribute('opacity', String(0.32 * s + 0.08))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode, shiftRun, unlocked])

  // キーボード操作
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftRun(true)
        return
      }
      const k = e.key.toLowerCase()
      if (k === 'arrowup' || k === 'w') stepToward(0, -1)
      else if (k === 'arrowdown' || k === 's') stepToward(0, 1)
      else if (k === 'arrowleft' || k === 'a') stepToward(-1, 0)
      else if (k === 'arrowright' || k === 'd') stepToward(1, 0)
      else if (k === 'enter' || k === ' ') {
        const node = grassNodeById(live.current.nodeId)
        if (node.stageId) setPanelStageId(node.stageId)
      } else if (k === 'escape') onBack?.()
      else if (k === 'm') setCameraMode((m) => (m === 'follow' ? 'overview' : 'follow'))
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftRun(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode, unlocked])

  const currentNode = grassNodeById(currentNodeId)
  const panelStage = panelStageId ? GRASS_STAGES.find((s) => s.id === panelStageId) ?? null : null
  const panelAction = panelStage ? stageActionFor(panelStage.id, { hasBooks, firstBookId, todayPages, totalPages }) : null
  const questReady = todayPages > 0
  const cleared = panelStage ? progress.clearedStageIds.includes(panelStage.id) : false

  const handleClear = () => {
    if (!panelStage) return
    const next = clearRpgStage(progress, panelStage.id, [...panelStage.unlockPathsOnClear, `unlock-after-${panelStage.id}`])
    // 次ステージの入口パスも解放する
    const idx = GRASS_STAGES.findIndex((s) => s.id === panelStage.id)
    const nextStage = GRASS_STAGES[idx + 1]
    const extra = nextStage ? [`route-to-${nextStage.id}`] : []
    void extra
    const withNext: RpgProgressState = {
      ...next,
      unlockedStageIds: [...new Set([...next.unlockedStageIds, ...(nextStage ? [nextStage.id] : [])])],
    }
    persist(withNext)
    onStageAction?.(panelStage.id, panelAction?.target ?? 'today')
  }

  return (
    <div data-testid="rpg-grass-map" data-node={currentNodeId} style={{ position: 'relative', width: '100%' }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 15 }}>草原ワールド・風見の丘陵</strong>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>いま: {currentNode.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button
            data-testid="rpg-grass-camera"
            type="button"
            onClick={() => setCameraMode((m) => (m === 'follow' ? 'overview' : 'follow'))}
            style={{ minHeight: 44, padding: '0 12px', flex: 1 }}
          >
            {cameraMode === 'follow' ? '全体をみる' : '追従にもどる'}
          </button>
          {onBack && (
            <button data-testid="rpg-grass-back" type="button" onClick={onBack} style={{ minHeight: 44, padding: '0 12px', flex: 1 }}>
              ワールド選択へ
            </button>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', touchAction: 'manipulation' }}>
        <svg ref={svgRef} viewBox={initialCameraMode === 'overview' ? `0 0 ${WORLD_W} ${WORLD_H}` : `${clamp(startNode.x - FOLLOW_W / 2, 0, WORLD_W - FOLLOW_W)} ${clamp(startNode.y - FOLLOW_H / 2 - 20, 0, WORLD_H - FOLLOW_H)} ${FOLLOW_W} ${FOLLOW_H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} role="img" aria-label="草原ワールドの立体マップ">
          <defs>
            <linearGradient id="gr-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6fc3ff" />
              <stop offset="55%" stopColor="#bfe6ff" />
              <stop offset="100%" stopColor="#e8f9e0" />
            </linearGradient>
            <linearGradient id="gr-ground-top" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7ed957" />
              <stop offset="100%" stopColor="#4da63f" />
            </linearGradient>
            <linearGradient id="gr-ground-side" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a9744f" />
              <stop offset="55%" stopColor="#8a5a35" />
              <stop offset="100%" stopColor="#5f3c22" />
            </linearGradient>
            <linearGradient id="gr-water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7fe3ff" />
              <stop offset="100%" stopColor="#2f9fd8" />
            </linearGradient>
          </defs>

          {/* 空・太陽・雲 */}
          <rect x="-200" y="-160" width="1120" height="420" fill="url(#gr-sky)" />
          <circle cx="600" cy="-40" r="42" fill="#fff3b0" opacity="0.95" />
          <circle cx="600" cy="-40" r="58" fill="#fff3b0" opacity="0.25" />
          <g className="rpg-cloud" opacity="0.95">
            <ellipse cx="150" cy="-60" rx="52" ry="16" fill="#fff" />
            <ellipse cx="185" cy="-66" rx="34" ry="13" fill="#fff" />
          </g>
          <g className="rpg-cloud rpg-cloud-2" opacity="0.9">
            <ellipse cx="470" cy="-90" rx="62" ry="18" fill="#fff" />
            <ellipse cx="512" cy="-96" rx="36" ry="14" fill="#fff" />
          </g>
          {/* 遠景の山・森 */}
          <polygon points="-160,260 40,40 240,260" fill="#9db8d8" opacity="0.9" />
          <polygon points="-120,260 40,90 200,260" fill="#e8f2fc" opacity="0.9" />
          <polygon points="380,260 560,20 740,260" fill="#8fa9c9" opacity="0.9" />
          <polygon points="440,260 560,80 680,260" fill="#eef4fb" opacity="0.85" />
          <g opacity="0.85">
            {Array.from({ length: 12 }, (_, i) => (
              <g key={i} transform={`translate(${60 + i * 56} 246)`}>
                <polygon points="0,-26 -12,0 12,0" fill="#5d8a6a" />
                <rect x="-3" y="0" width="6" height="10" fill="#6b4a2f" />
              </g>
            ))}
          </g>

          {/* 地形：側面（厚み）→上面 */}
          <g>
            <rect x="-160" y="120" width="1040" height="340" rx="90" fill="url(#gr-ground-side)" />
            <rect x="-160" y="104" width="1040" height="330" rx="90" fill="url(#gr-ground-top)" />
            {/* 高台（風見の丘）の厚み */}
            <ellipse cx="430" cy="152" rx="128" ry="62" fill="#7a4e2e" />
            <ellipse cx="430" cy="140" rx="128" ry="62" fill="#8fd45e" stroke="#3f7d33" strokeWidth="3" />
            <ellipse cx="430" cy="132" rx="92" ry="42" fill="#a5e075" opacity="0.8" />
            {/* 花畑パッチ */}
            <ellipse cx="160" cy="332" rx="52" ry="18" fill="#9be26d" opacity="0.9" />
            {[
              [138, 328], [152, 336], [168, 327], [184, 335], [146, 338], [176, 340],
            ].map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${y})`}>
                <circle r="3.2" fill={i % 2 ? '#ff8fb3' : '#ffd94d'} stroke="#fff" strokeWidth="1" />
              </g>
            ))}
          </g>

          {/* 草の質感（近景でも単色に見えないよう散らす） */}
          <g stroke="#3f9e4d" strokeWidth="2.4" strokeLinecap="round" opacity="0.85">
            {[
              [40, 250], [90, 200], [130, 400], [200, 210], [250, 400], [330, 120], [120, 300],
              [420, 380], [500, 400], [560, 380], [660, 330], [690, 220], [60, 330], [300, 300],
              [540, 90], [240, 130], [150, 120], [620, 120],
            ].map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${y})`}>
                <line x1="0" y1="0" x2="-4" y2="-9" />
                <line x1="3" y1="0" x2="3" y2="-11" />
                <line x1="6" y1="0" x2="10" y2="-8" />
              </g>
            ))}
          </g>
          {/* 川 */}
          <g>
            <path d="M 250 372 Q 340 330 385 338 Q 440 346 500 360" fill="none" stroke="url(#gr-water)" strokeWidth="34" strokeLinecap="round" />
            <path d="M 250 372 Q 340 330 385 338 Q 440 346 500 360" fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="10 10" opacity="0.55" className="rpg-water" />
          </g>

          {/* 道：同じ Path データから描画（表示と論理の一致） */}
          <g>
            {GRASS_PATHS.map((p) => {
              const d = `M ${p.points.map((pt) => `${pt.x} ${pt.y}`).join(' L ')}`
              const open = unlocked.has(p.id)
              if (p.kind === 'jump') {
                const a = p.points[0]
                const b = p.points[p.points.length - 1]
                return (
                  <g key={p.id} opacity={open ? 1 : 0.35}>
                    <path d={d} fill="none" stroke={open ? '#caa25e' : '#9aa3b2'} strokeWidth={p.width} strokeLinecap="round" strokeDasharray={open ? undefined : '8 8'} />
                    <path d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 44} ${b.x} ${b.y}`} fill="none" stroke="#fff" strokeWidth="2.6" strokeDasharray="6 5" opacity="0.9" />
                  </g>
                )
              }
              return (
                <g key={p.id} opacity={open ? 1 : 0.3}>
                  <path d={d} fill="none" stroke={open ? '#8a5f36' : '#9aa3b2'} strokeWidth={p.width + 7} strokeLinecap="round" />
                  <path d={d} fill="none" stroke={open ? '#e8c987' : '#c3cad4'} strokeWidth={p.width} strokeLinecap="round" strokeDasharray={open ? undefined : '8 8'} />
                  <path d={d} fill="none" stroke={open ? '#fff4d6' : '#e2e6ec'} strokeWidth="3" strokeDasharray="12 10" opacity="0.8" />
                </g>
              )
            })}
            {/* 橋（g-p3a の上に板と欄干を載せる） */}
            <g>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <rect key={i} x={344 + i * 15} y={328 + (i % 2)} width="12" height="20" rx="2" fill="#b07a3f" stroke="#7a4e22" strokeWidth="1.6" transform={`rotate(-4 ${344 + i * 15} 338)`} />
              ))}
              <line x1="342" y1="326" x2="432" y2="318" stroke="#7a4e22" strokeWidth="4" strokeLinecap="round" />
              <line x1="342" y1="350" x2="432" y2="342" stroke="#7a4e22" strokeWidth="4" strokeLinecap="round" />
            </g>
            {/* はしご（g-p4b） */}
            <g>
              <line x1="352" y1="200" x2="352" y2="140" stroke="#8a5a2a" strokeWidth="5" strokeLinecap="round" />
              <line x1="368" y1="200" x2="368" y2="140" stroke="#8a5a2a" strokeWidth="5" strokeLinecap="round" />
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={i} x1="352" y1={192 - i * 11} x2="368" y2={192 - i * 11} stroke="#8a5a2a" strokeWidth="3" strokeLinecap="round" />
              ))}
            </g>
          </g>

          {/* 自然物・建物（地形に接地） */}
          <g>
            {[
              { x: 110, y: 300, s: 1.1 }, { x: 215, y: 360, s: 0.9 }, { x: 620, y: 320, s: 1.0 }, { x: 250, y: 180, s: 1.2 },
            ].map((t, i) => (
              <g key={`tree-${i}`} transform={`translate(${t.x} ${t.y}) scale(${t.s})`}>
                <rect x="-5" y="-22" width="10" height="24" rx="4" fill="#7a4e2e" />
                <g className="rpg-sway">
                  <circle cx="0" cy="-34" r="17" fill="#3f9e4d" />
                  <circle cx="-12" cy="-26" r="12" fill="#55b765" />
                  <circle cx="12" cy="-26" r="12" fill="#35853f" />
                </g>
              </g>
            ))}
            {[
              { x: 250, y: 392 }, { x: 610, y: 236 }, { x: 480, y: 196 },
            ].map((r, i) => (
              <g key={`rock-${i}`} transform={`translate(${r.x} ${r.y})`}>
                <polygon points="0,0 -16,-4 -12,-18 4,-22 16,-8" fill="#9aa3b2" stroke="#6b7280" strokeWidth="2" />
                <polygon points="-12,-18 4,-22 0,-12 -10,-10" fill="#cbd2dc" />
              </g>
            ))}
            {/* 丘の小屋（stage-1） */}
            <g transform="translate(520 300)">
              <rect x="-30" y="-34" width="60" height="36" rx="4" fill="#f5e6c8" stroke="#8a5a35" strokeWidth="2.6" />
              <polygon points="-36,-32 0,-58 36,-32" fill="#d95f4b" stroke="#8a2f24" strokeWidth="2.6" />
              <rect x="-9" y="-18" width="18" height="20" rx="2" fill="#6b4a2f" />
              <rect x="12" y="-28" width="12" height="10" fill="#bfe6ff" stroke="#5b7a99" strokeWidth="2" />
            </g>
            {/* 風見の丘の旗（stage-2） */}
            <g transform="translate(460 130)">
              <line x1="0" y1="0" x2="0" y2="-52" stroke="#6b4a2f" strokeWidth="5" strokeLinecap="round" />
              <polygon points="0,-52 34,-45 0,-37" fill="#f2b134" stroke="#b97f14" strokeWidth="2" className="rpg-flag" />
            </g>
            {/* 洞窟（stage-3） */}
            <g transform="translate(650 270)">
              <ellipse cx="0" cy="6" rx="34" ry="12" fill="#5b6478" />
              <path d="M -26 8 Q -26 -26 0 -26 Q 26 -26 26 8 Z" fill="#3a4356" stroke="#232a38" strokeWidth="2.6" />
              <path d="M -14 8 Q -14 -12 0 -12 Q 14 -12 14 8 Z" fill="#10141d" />
            </g>
            {/* 城門（goal） */}
            <g transform="translate(600 350)">
              <rect x="-34" y="-30" width="68" height="32" rx="4" fill="#cfd6e4" stroke="#6b7280" strokeWidth="2.4" />
              <rect x="-26" y="-52" width="14" height="24" fill="#cfd6e4" stroke="#6b7280" strokeWidth="2.4" />
              <rect x="12" y="-52" width="14" height="24" fill="#cfd6e4" stroke="#6b7280" strokeWidth="2.4" />
              <polygon points="-26,-52 -19,-62 -12,-52" fill="#eab308" />
              <polygon points="12,-52 19,-62 26,-52" fill="#eab308" />
              <rect x="-10" y="-18" width="20" height="20" rx="8" fill="#4a5468" />
            </g>
          {/* 道しるべ（分岐の目印・ノードラベルと重ねない） */}
          <g transform="translate(232 296)">
            <rect x="-4" y="-30" width="8" height="32" fill="#7a4e22" />
            <polygon points="0,-44 14,-30 -14,-30" fill="#a9744f" stroke="#5f3c22" strokeWidth="2" />
          </g>
          </g>

          {/* 環境パーティクル */}
          <g fill="#fff8c8" opacity="0.9">
            {[
              [200, 250], [330, 180], [470, 260], [560, 320], [140, 200], [410, 320],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="3" className={i % 2 ? 'rpg-mote-b' : 'rpg-mote-a'} />
            ))}
          </g>

          {/* ノードマーカー（タップ移動用） */}
          <g>
            {GRASS_NODES.map((n) => {
              const isCurrent = n.id === currentNodeId
              const stage = GRASS_STAGES.find((s) => s.entryNodeId === n.id)
              return (
                <g
                  key={n.id}
                  data-testid={`rpg-grass-node-${n.id}`}
                  data-current={isCurrent ? 'true' : 'false'}
                  transform={`translate(${n.x} ${n.y})`}
                  onClick={() => tapNode(n.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle r={isCurrent ? 13 : 10} fill={isCurrent ? '#2f6df6' : stage ? '#eab308' : '#ffffff'} stroke={isCurrent ? '#ffd94d' : '#5b6478'} strokeWidth="2.6" opacity="0.92" />
                  {stage && (
                    <g className="rpg-pulse">
                      <circle r="17" fill="none" stroke="#eab308" strokeWidth="2" opacity="0.8" />
                    </g>
                  )}
                  <text y="30" fontSize="11" fontWeight="800" textAnchor="middle" fill="#22303c" stroke="#fff" strokeWidth="3" paintOrder="stroke">
                    {n.label}
                  </text>
                </g>
              )
            })}
          </g>

          {/* 影＋キャラクター（ref で毎フレーム移動） */}
          <ellipse ref={shadowRef} cx={startNode.x} cy={startNode.y + 4} rx="20" ry="6" fill="#1c2a1c" opacity="0.3" />
          <g ref={charRef} transform={`translate(${startNode.x - 28} ${startNode.y - 66 - startNode.h * 0.6})`}>
            <RpgCharacter anim={anim} facing={facing} />
          </g>
        </svg>

        {/* 現在の進行表示（テスト用にも使う） */}
        <div data-testid="rpg-grass-char" data-anim={anim} data-node={currentNodeId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
          {currentNodeId}
        </div>
      </div>

      {/* スマホ用 D-pad */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'stretch' }}>
        <div
          data-testid="rpg-grass-pad"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 52px)', gridTemplateRows: 'repeat(3, 44px)', gap: 4, touchAction: 'none' }}
        >
          <span />
          <button data-testid="rpg-grass-up" type="button" aria-label="うえへ" onPointerDown={() => stepToward(0, -1)} style={{ minHeight: 44 }}>▲</button>
          <span />
          <button data-testid="rpg-grass-left" type="button" aria-label="ひだりへ" onPointerDown={() => stepToward(-1, 0)} style={{ minHeight: 44 }}>◀</button>
          <button data-testid="rpg-grass-down" type="button" aria-label="したへ" onPointerDown={() => stepToward(0, 1)} style={{ minHeight: 44 }}>▼</button>
          <button data-testid="rpg-grass-right" type="button" aria-label="みぎへ" onPointerDown={() => stepToward(1, 0)} style={{ minHeight: 44 }}>▶</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <button
            data-testid="rpg-grass-decide"
            type="button"
            disabled={!currentNode.stageId}
            onClick={() => currentNode.stageId && setPanelStageId(currentNode.stageId)}
            style={{ minHeight: 48, fontWeight: 800 }}
          >
            {currentNode.stageId ? 'ステージをみる' : 'ステージなし'}
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            十字キー/WASD・タップ・D-padで移動。Shift長押しで走る。Mで全体表示。
          </div>
        </div>
      </div>

      {/* ステージパネル */}
      {panelStage && panelAction && (
        <section data-testid="rpg-grass-stage" style={{ marginTop: 8, padding: 12, borderRadius: 12, background: '#fffdf0', border: '2px solid #eab308' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{panelStage.title}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{panelStage.description}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>つながり: {panelAction.hint}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            今日 {todayPages}ページ ／ 累計 {totalPages}ページ
          </div>
          {cleared ? (
            <div data-testid="rpg-grass-cleared" style={{ marginTop: 8, fontWeight: 800, color: '#1a7f37' }}>
              クリアずみ！新しい道が開いたよ
            </div>
          ) : questReady ? (
            <button data-testid="rpg-grass-clear" type="button" onClick={handleClear} style={{ marginTop: 8, minHeight: 48, width: '100%', fontWeight: 800 }}>
              クエスト達成を記録する
            </button>
          ) : (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              あと1ページ読むとクエストクリア！記録後にここで達成を記録できるよ
            </div>
          )}
          <button type="button" onClick={() => setPanelStageId(null)} style={{ marginTop: 8, minHeight: 44, width: '100%' }}>
            とじる
          </button>
        </section>
      )}
    </div>
  )
}
