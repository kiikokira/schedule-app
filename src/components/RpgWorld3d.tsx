import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  findRoute3d,
  normalizeW3Graph,
  pathLength3d,
  samplePath3d,
  validateWorld3dGraph,
  w3NodeById,
  W3_UNLOCKS,
  type W3Graph,
  type W3Node,
  type W3Path,
} from '../lib/rpgWorld3d'
import { advanceAlongPath, canCancelState, pathKindToAnimDirected } from '../lib/rpgMovement'
import type { MoveState } from '../lib/rpgMovement'
import { clearRpgStage, loadRpgProgress, markWorldVisited, saveRpgProgress, type RpgProgressState } from '../lib/rpgProgress'
import { stageActionFor } from '../lib/rpgStageAdapter'

type Props = {
  todayPages: number
  totalPages: number
  firstBookId: string | null
  hasBooks: boolean
  onStageAction?: (stageId: string, target: string) => void
  onBack?: () => void
  /** 3DワールドID（1=草原・2=砂漠）。省略時は1。 */
  worldId?: 1 | 2
  initialNodeId?: string
  initialCameraMode?: 'follow' | 'overview'
  initialProgress?: RpgProgressState
  /** プレビュー用の自動運転ルート（ノードID列）。本番では未使用。 */
  autoRoute?: string[]
}

type RouteStep = { path: W3Path; fromId: string; toId: string; length: number; prevId?: string; nextId?: string }

const BASE = import.meta.env.BASE_URL || '/'
const CHARA_URL = `${BASE}rpg/player_character.glb`

type World3dConfig = {
  glb: string
  graph: string
  title: string
  progressKey: string
  nodeLabels: Record<string, string>
  stageTitles: Record<string, string>
  stageOrder: string[]
}

const WORLD3D_CONFIG: Record<1 | 2, World3dConfig> = {
  1: {
    glb: `${BASE}rpg/world1_grassland.glb`,
    graph: `${BASE}rpg/world1_graph.json`,
    title: '草原ワールド3D・風見の丘陵',
    progressKey: '3d-1',
    nodeLabels: {
      n0: 'はじまりの門', n1: '花畑', n2: '西の道', n3a: '橋のたもと', n3b: '橋のむこう',
      n4: 'わかれ道', n5a: '階段下', n5b: '丘の上', n5c: 'はしご下', n5d: 'はしご上',
      n6: '丘の小屋', n7: '崖っぷち', n8: '風見の丘', n9: '洞窟まえ', n10: '帰り道', n11: '出口の門',
    },
    stageTitles: { 'grass-stage-1': '丘の小屋', 'grass-stage-2': '風見の丘', 'grass-stage-3': '洞窟まえ' },
    stageOrder: ['grass-stage-1', 'grass-stage-2', 'grass-stage-3'],
  },
  2: {
    glb: `${BASE}rpg/world2_desert.glb`,
    graph: `${BASE}rpg/world2_graph.json`,
    title: '砂漠ワールド3D・黄金の砂海',
    progressKey: '3d-2',
    nodeLabels: {
      n0: '旅立ちの門', n1: '砂の道', n2: '西の砂丘', n3a: '涸れ川のたもと', n3b: '橋のむこう',
      n4: 'わかれ道', n5a: '階段下', n5b: 'メサの上', n5c: 'はしご下', n5d: 'はしご上',
      n6: '日干し小屋', n7: '崖っぷち', n8: '風紋の丘', n9: '遺跡まえ', n10: '帰り道', n11: '出口の門',
    },
    stageTitles: { 'desert-stage-1': '日干し小屋', 'desert-stage-2': '風紋の丘', 'desert-stage-3': '遺跡まえ' },
    stageOrder: ['desert-stage-1', 'desert-stage-2', 'desert-stage-3'],
  },
}

const CLIP_FOR: Record<MoveState, string> = {
  IDLE: 'Idle', WALK: 'Walk', RUN: 'Run', TURN: 'Walk',
  JUMP_PREPARE: 'JumpStart', JUMP_ASCEND: 'JumpLoop', JUMP_AIR: 'JumpLoop', JUMP_DESCEND: 'JumpLoop',
  LAND: 'JumpLand', LADDER_UP: 'ClimbUp', LADDER_DOWN: 'ClimbDown',
  SLOPE_UP: 'SlopeUp', SLOPE_DOWN: 'SlopeDown', STAIRS_UP: 'StairsUp', STAIRS_DOWN: 'StairsDown',
  FALL: 'Fall', SWIM_ENTER: 'SwimEnter', SWIM: 'Swim', SWIM_EXIT: 'SwimExit',
  ENTER_BUILDING: 'EnterBuilding', EXIT_BUILDING: 'ExitBuilding',
  ENTER_CAVE: 'EnterCave', EXIT_CAVE: 'ExitCave',
  ENTER_STAGE: 'EnterStage', RETURN_STAGE: 'ReturnStage', EVENT: 'Idle',
}

function routeSteps(g: W3Graph, nodes: string[], unlocked: Set<string>): RouteStep[] | null {
  const steps: RouteStep[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i]
    const b = nodes[i + 1]
    const p = g.paths.find(
      (v) => unlocked.has(v.id) && ((v.from === a && v.to === b) || (!v.oneWay && v.from === b && v.to === a)),
    )
    if (!p) return null
    steps.push({ path: p, fromId: a, toId: b, length: pathLength3d(g, p.id, a) })
  }
  return steps
}

export default function RpgWorld3d({
  todayPages, totalPages, firstBookId, hasBooks, onStageAction, onBack,
  worldId = 1, initialNodeId, initialCameraMode = 'follow', initialProgress, autoRoute,
}: Props) {
  const cfg = WORLD3D_CONFIG[worldId]
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [graph, setGraph] = useState<W3Graph | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [progress, setProgress] = useState<RpgProgressState>(() => initialProgress ?? loadRpgProgress())
  const [currentNodeId, setCurrentNodeId] = useState(initialNodeId ?? initialProgress?.lastKnownNodeId?.[cfg.progressKey] ?? 'n0')
  const [cameraMode, setCameraMode] = useState<'follow' | 'overview'>(initialCameraMode)
  const [anim, setAnimState] = useState<MoveState>('IDLE')
  const [panelStageId, setPanelStageId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [loadStage, setLoadStage] = useState('graph')
  const [loadPct, setLoadPct] = useState(0)
  const apiRef = useRef<{ stepToward(dx: number, dz: number): void; tapNode(id: string): void } | null>(null)

  const unlocked = useMemo(() => new Set(progress.unlockedPathIds), [progress])

  useEffect(() => {
    let cancelled = false
    fetch(cfg.graph)
      .then((r) => {
        if (!r.ok) throw new Error(`graph ${r.status}`)
        return r.json()
      })
      .then((g: { nodes: (W3Node & { stage?: string })[]; paths: W3Graph['paths'] }) => {
        if (cancelled) return
        // Blender由来JSONは stage キーで出力されるため stageId へ正規化する
        const normalized = normalizeW3Graph(g)
        const issues = validateWorld3dGraph(normalized)
        if (issues.length > 0) {
          setLoadError(`地形データ異常: ${issues[0]}`)
          return
        }
        setGraph(normalized)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 訪問記録
  useEffect(() => {
    setProgress((prev) => {
      const next = markWorldVisited(prev, 1)
      saveRpgProgress(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (!graph || !mountRef.current) return
    const mount = mountRef.current
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      setLoadError('この端末では3D表示に未対応です')
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#8fc7f5')
    scene.fog = new THREE.Fog('#cfe4f5', 42, 175)
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400)

    const hemi = new THREE.HemisphereLight('#cfe8ff', '#6a9a55', 1.05)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight('#fff4e0', 2.0)
    sun.position.set(-10, 18, 8)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -16
    sun.shadow.camera.right = 16
    sun.shadow.camera.top = 16
    sun.shadow.camera.bottom = -16
    sun.shadow.camera.far = 60
    scene.add(sun)

    // 背景: 空ドーム・遠山リング・漂う雲・環境粒子
    const skyGeo = new THREE.SphereGeometry(160, 16, 12)
    const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false })
    const skyColors = new Float32Array(skyGeo.attributes.position.count * 3)
    const top = new THREE.Color('#4f9df0')
    const horizon = new THREE.Color('#d8efff')
    const pos = skyGeo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp(pos.getY(i) / 160, -0.1, 1)
      const c = horizon.clone().lerp(top, THREE.MathUtils.smoothstep(t, 0, 1))
      skyColors.set([c.r, c.g, c.b], i * 3)
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3))
    skyMat.vertexColors = true
    scene.add(new THREE.Mesh(skyGeo, skyMat))

    const mountainMat = new THREE.MeshBasicMaterial({ color: '#7d9cc4' })
    const snowMat = new THREE.MeshBasicMaterial({ color: '#eef4fb' })
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3
      const r = 34 + (i % 3) * 6
      const h = 13 + (i % 4) * 3.5
      const m = new THREE.Mesh(new THREE.ConeGeometry(9, h, 5), mountainMat)
      m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r)
      scene.add(m)
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.8, h * 0.3, 5), snowMat)
      cap.position.set(Math.cos(a) * r, h - 2 - h * 0.15, Math.sin(a) * r)
      scene.add(cap)
    }
    const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, fog: false })
    const clouds: THREE.Object3D[] = []
    for (let i = 0; i < 7; i++) {
      const puff = new THREE.Group()
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(2.0 + (j % 2), 10, 8), cloudMat)
        s.position.set(j * 2.4 - 3.2, (j % 2) * 0.8, 0)
        s.scale.y = 0.62
        puff.add(s)
      }
      puff.position.set(-36 + i * 12, 6 + (i % 3) * 2, -24 - (i % 4) * 7)
      scene.add(puff)
      clouds.push(puff)
    }
    const moteGeo = new THREE.BufferGeometry()
    const moteN = 46
    const motePos = new Float32Array(moteN * 3)
    for (let i = 0; i < moteN; i++) {
      motePos.set([(Math.random() - 0.5) * 24, 0.5 + Math.random() * 4, (Math.random() - 0.5) * 24], i * 3)
    }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3))
    const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: '#fff7c0', size: 0.16, transparent: true, opacity: 0.9 }))
    scene.add(motes)

    const loader = new GLTFLoader()
    const waterMats: THREE.MeshStandardMaterial[] = []
    const live = {
      nodeId: currentNodeId,
      steps: [] as RouteStep[],
      stepIndex: 0,
      dist: 0,
      moving: false,
      autoThrough: false,
      phase: 'idle' as 'idle' | 'turn' | 'prepare' | 'move' | 'land' | 'stage',
      phaseTime: 0,
      pending: null as RouteStep | null,
      landTo: '',
      pos: new THREE.Vector3(),
      yaw: 0,
      targetYaw: 0,
      camPos: new THREE.Vector3(0, 13, 17),
      camLook: new THREE.Vector3(0, 0, -1),
      paused: false,
      disposed: false,
    }
    const startN = w3NodeById(graph, live.nodeId)
    live.pos.set(startN.x, startN.y, startN.z)

    let mixer: THREE.AnimationMixer | null = null
    let charGroup: THREE.Group | null = null
    const clips = new Map<string, THREE.AnimationClip>()
    let currentClip = ''
    const nodeHit = new Map<string, THREE.Mesh>()
    let stagePulse = new Map<string, THREE.Mesh>()
    const clock = new THREE.Clock()

    const setClip = (name: string, fade = 0.22) => {
      if (!mixer || currentClip === name) return
      const clip = clips.get(name)
      if (!clip) return
      const action = mixer.clipAction(clip)
      action.reset()
      if (currentClip) {
        const prev = mixer.clipAction(clips.get(currentClip)!)
        action.crossFadeFrom(prev, fade, true)
      }
      action.setLoop(name === 'Walk' || name === 'Run' || name === 'JumpLoop' || name === 'ClimbUp' || name === 'ClimbDown' || name === 'Swim' || name === 'Fall' || name === 'Idle' ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
      action.clampWhenFinished = true
      action.play()
      currentClip = name
    }
    const setAnim = (s: MoveState) => {
      setAnimState(s)
      setClip(CLIP_FOR[s] ?? 'Idle')
    }

    const arriveAt = (nodeId: string) => {
      live.nodeId = nodeId
      live.moving = false
      live.phase = 'idle'
      live.pending = null
      const node = w3NodeById(graph, nodeId)
      live.pos.set(node.x, node.y, node.z)
      setCurrentNodeId(nodeId)
      setProgress((prev) => {
        const next: RpgProgressState = { ...prev, lastKnownNodeId: { ...prev.lastKnownNodeId, [cfg.progressKey]: nodeId } }
        saveRpgProgress(next)
        return next
      })
      if (node.stageId) {
        live.phase = 'stage'
        live.phaseTime = 0
        setAnim(nodeId === 'n9' ? 'ENTER_CAVE' : 'ENTER_STAGE')
      } else {
        setAnim('IDLE')
      }
    }

    const beginStep = (step: RouteStep) => {
      if (!canCancelState(animRef.current) || live.moving) return
      const to = w3NodeById(graph, step.toId)
      const from = w3NodeById(graph, step.fromId)
      const want = Math.atan2(to.x - from.x, to.z - from.z)
      let diff = want - live.yaw
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      live.pending = step
      live.dist = 0
      if (Math.abs(diff) > 1.0) {
        live.targetYaw = want
        setAnim('TURN')
        setClip(diff > 0 ? 'TurnR' : 'TurnL', 0.12)
        live.phase = 'turn'
        live.phaseTime = 0
      } else if (step.path.kind === 'jump') {
        live.targetYaw = want
        setAnim('JUMP_PREPARE')
        live.phase = 'prepare'
        live.phaseTime = 0
      } else {
        live.targetYaw = want
        live.phase = 'move'
        live.moving = true
        setAnim(pathKindToAnimDirected(step.path.kind, step.fromId !== step.path.from))
      }
    }

    const startRoute = (steps: RouteStep[], autoThrough: boolean) => {
      if (steps.length === 0) return
      live.steps = steps
      live.stepIndex = 0
      live.autoThrough = autoThrough
      beginStep(steps[0])
    }

    apiRef.current = {
      stepToward(dx, dz) {
        if (live.moving || live.phase !== 'idle' || cameraModeRef.current === 'overview') return
        const cur = w3NodeById(graph, live.nodeId)
        let best: { step: RouteStep; dot: number } | null = null
        for (const p of graph.paths) {
          if (!unlockedRef.current.has(p.id)) continue
          let to: string | null = null
          if (p.from === live.nodeId) to = p.to
          else if (!p.oneWay && p.to === live.nodeId) to = p.from
          if (!to) continue
          const n = w3NodeById(graph, to)
          const vx = n.x - cur.x
          const vz = n.z - cur.z
          const len = Math.hypot(vx, vz) || 1
          const dot = (vx / len) * dx + (vz / len) * dz
          if (!best || dot > best.dot) {
            best = { step: { path: p, fromId: live.nodeId, toId: to, length: pathLength3d(graph, p.id, live.nodeId) }, dot }
          }
        }
        if (best && best.dot > 0.25) {
          setPanelStageId(null)
          startRoute([best.step], false)
        }
      },
      tapNode(nodeId) {
        if (live.moving || live.phase !== 'idle' || cameraModeRef.current === 'overview') return
        if (nodeId === live.nodeId) return
        const nodes = findRoute3d(graph, live.nodeId, nodeId, unlockedRef.current)
        if (!nodes) return
        const steps = routeSteps(graph, nodes, unlockedRef.current)
        if (!steps) return
        // 向き付きサンプリングのため前後ノードを付与する
        const withCtx = steps.map((s, i) => ({
          ...s,
          prevId: i === 0 ? undefined : steps[i - 1].fromId,
          nextId: i === steps.length - 1 ? undefined : steps[i + 1].toId,
        }))
        setPanelStageId(null)
        startRoute(withCtx, true)
      },
    }

    let shiftRun = false
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftRun = true
        return
      }
      const k = e.key.toLowerCase()
      if (k === 'arrowup' || k === 'w') apiRef.current?.stepToward(0, -1)
      else if (k === 'arrowdown' || k === 's') apiRef.current?.stepToward(0, 1)
      else if (k === 'arrowleft' || k === 'a') apiRef.current?.stepToward(-1, 0)
      else if (k === 'arrowright' || k === 'd') apiRef.current?.stepToward(1, 0)
      else if (k === 'enter' || k === ' ') {
        const node = w3NodeById(graph, live.nodeId)
        if (node.stageId) setPanelStageId(node.stageId)
      } else if (k === 'escape') onBackRef.current?.()
      else if (k === 'm') setCameraMode((m) => (m === 'follow' ? 'overview' : 'follow'))
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftRun = false
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onUp)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const onPointerDown = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects([...nodeHit.values()], false)
      if (hits.length > 0) {
        const id = [...nodeHit.entries()].find(([, m]) => m === hits[0].object)?.[0]
        if (id) apiRef.current?.tapNode(id)
      }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)

    const resize = () => {
      const w = mount.clientWidth || 360
      const h = mount.clientHeight || 225
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    // ロード（並列＋進捗表示）
    setLoadStage('world')
    const onProg = (kind: string) => (ev: ProgressEvent) => {
      if (ev.lengthComputable) {
        setLoadPct((p) => (kind === 'world' ? Math.min(90, Math.round((ev.loaded / ev.total) * 70)) : Math.max(p, 70 + Math.round((ev.loaded / ev.total) * 30))))
      }
    }
    const loadOne = (url: string, kind: string) =>
      new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
        loader.load(
          url,
          (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }),
          (ev) => onProg(kind)(ev as ProgressEvent),
          (err) => reject(err),
        )
      })
    Promise.all([loadOne(cfg.glb, 'world'), loadOne(CHARA_URL, 'chara')])
      .then(([worldRes, charaRes]) => {
        if (live.disposed) return
        setLoadStage('build')
        const world = worldRes.scene
        world.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.receiveShadow = true
            const mats = Array.isArray(o.material) ? o.material : [o.material]
            for (const m of mats) {
              if (m instanceof THREE.MeshStandardMaterial && /water/i.test(m.name)) waterMats.push(m)
            }
          }
        })
        scene.add(world)
        charGroup = charaRes.scene
        charGroup.traverse((o) => {
          if (o instanceof THREE.Mesh) o.castShadow = true
        })
        // SolaはBlender北(+Y)→glTF -Zを向く。ゲーム北(-Z相当に見える方)へ補正はyaw側で行う。
        scene.add(charGroup)
        mixer = new THREE.AnimationMixer(charGroup)
        for (const clip of charaRes.animations) clips.set(clip.name, clip)
        setLoadStage('ready')
        setAnim('IDLE')
        // ノードマーカー（不可視ヒット球＋可視ステージ印）
        const hitMat = new THREE.MeshBasicMaterial({ visible: false })
        const stageMat = new THREE.MeshBasicMaterial({ color: '#eab308', transparent: true, opacity: 0.85 })
        for (const n of graph.nodes) {
          const hit = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 8), hitMat)
          hit.position.set(n.x, n.y + 0.6, n.z)
          scene.add(hit)
          nodeHit.set(n.id, hit)
          if (n.stageId) {
            const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), stageMat.clone())
            gem.position.set(n.x, n.y + 2.2, n.z)
            scene.add(gem)
            stagePulse.set(n.id, gem)
          }
        }
        setReady(true)
        if (autoRoute && autoRoute.length > 1) {
          const steps = routeSteps(graph, autoRoute, unlockedRef.current)
          if (steps) startRoute(steps, true)
        }
      })
      .catch(() => setLoadError('3Dモデル読込失敗'))

    let raf = 0
    const camTargetPos = new THREE.Vector3()
    const camTargetLook = new THREE.Vector3()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.1, clock.getDelta())
      const t = clock.elapsedTime
      // 環境アニメ
      if (!reduced) {
        clouds.forEach((c, i) => {
          c.position.x += dt * (0.35 + (i % 3) * 0.12)
          if (c.position.x > 52) c.position.x = -52
        })
        const mp = moteGeo.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < moteN; i++) {
          mp.setY(i, mp.getY(i) + Math.sin(t * 1.3 + i) * dt * 0.25)
        }
        mp.needsUpdate = true
        for (const m of waterMats) m.opacity = 0.78 + Math.sin(t * 1.6) * 0.08
        stagePulse.forEach((gem, i) => {
          const s = 1 + Math.sin(t * 2.4 + i.length) * 0.15
          gem.scale.set(s, s, s)
          gem.rotation.y += dt * 0.8
        });
      }
      // 移動
      if (mixer) mixer.update(dt)
      const mode = cameraModeRef.current
      if (live.phase === 'turn' || live.phase === 'prepare') {
        live.phaseTime += dt
        const need = live.phase === 'turn' ? 0.28 : 0.24
        if (live.phaseTime >= need && live.pending) {
          live.phase = 'move'
          live.moving = true
          const p = live.pending
          const reversed = p.fromId !== p.path.from
          const eff = p.path.kind === 'walk' && shiftRun ? 'run' : p.path.kind
          setAnim(pathKindToAnimDirected(eff, reversed))
        }
      } else if (live.phase === 'move' && live.pending) {
        const st = live.pending
        const speed = st.path.speed * (st.path.kind === 'walk' && shiftRun ? 1.45 : 1)
        live.dist = advanceAlongPath(live.dist, speed, dt, st.length)
        if (st.path.kind === 'jump') setAnim(live.dist / st.length < 0.5 ? 'JUMP_ASCEND' : 'JUMP_DESCEND')
        else if (st.path.kind === 'fall') setAnim('FALL')
        const pose = samplePath3d(graph, st.path, st.fromId, live.dist, st.prevId, st.nextId, st.length)
        live.pos.set(pose.pos[0], pose.pos[1], pose.pos[2])
        if (Math.hypot(pose.dir[0], pose.dir[2]) > 1e-4) {
          live.targetYaw = Math.atan2(pose.dir[0], pose.dir[2]) + Math.PI
        }
        if (live.dist >= st.length) {
          const arrivedId = st.toId
          if (st.path.kind === 'jump' || st.path.kind === 'fall') {
            live.phase = 'land'
            live.phaseTime = 0
            setAnim('LAND')
            live.pending = null
            live.landTo = arrivedId
          } else if (live.autoThrough) {
            const idx = live.steps.indexOf(st)
            const next = live.steps[idx + 1]
            if (next) {
              live.stepIndex = idx + 1
              live.dist = 0
              live.pending = next
              setAnim(pathKindToAnimDirected(next.path.kind, next.fromId !== next.path.from))
            } else {
              arriveAt(arrivedId)
            }
          } else {
            arriveAt(arrivedId)
          }
        }
      } else if (live.phase === 'land') {
        live.phaseTime += dt
        if (live.phaseTime >= 0.3) {
          const to = live.landTo || live.pending?.toId || live.nodeId
          live.moving = false
          arriveAt(to)
        }
      } else if (live.phase === 'stage') {
        live.phaseTime += dt
        if (live.phaseTime >= 0.6) {
          live.phase = 'idle'
          setAnim('IDLE')
          const node = w3NodeById(graph, live.nodeId)
          if (node.stageId) setPanelStageId(node.stageId)
        }
      }
      // 向き補間
      let dy = live.targetYaw - live.yaw
      while (dy > Math.PI) dy -= Math.PI * 2
      while (dy < -Math.PI) dy += Math.PI * 2
      live.yaw += dy * Math.min(1, dt * 10)
      if (charGroup) {
        charGroup.position.copy(live.pos)
        charGroup.rotation.y = live.yaw
      }
      // カメラ
      if (mode === 'overview') {
        camTargetPos.set(0, 27, 16)
        camTargetLook.set(0.5, 0, -1)
      } else {
        const fx = Math.sin(live.yaw + Math.PI)
        const fz = Math.cos(live.yaw + Math.PI)
        camTargetPos.set(
          THREE.MathUtils.clamp(live.pos.x - fx * 9.0, -14, 14),
          Math.max(2.5, live.pos.y + 5.5),
          THREE.MathUtils.clamp(live.pos.z - fz * 9.0, -13, 13),
        )
        camTargetLook.set(live.pos.x + fx * 3.0, live.pos.y + 0.8, live.pos.z + fz * 3.0)
      }
      const k = reduced ? 1 : 1 - Math.exp(-4.5 * dt)
      live.camPos.lerp(camTargetPos, k)
      live.camLook.lerp(camTargetLook, k)
      camera.position.copy(live.camPos)
      camera.lookAt(live.camLook)
      sun.position.set(live.camLook.x - 10, 18, live.camLook.z + 8)
      sun.target.position.copy(live.camLook)
      sun.target.updateMatrixWorld()
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      live.disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('resize', resize)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          for (const m of mats) {
            const mm = m as THREE.MeshStandardMaterial
            if (mm.map) mm.map.dispose()
            m.dispose()
          }
        }
      })
      skyGeo.dispose()
      moteGeo.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      apiRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  const animRef = useRef(anim)
  animRef.current = anim
  const unlockedRef = useRef(unlocked)
  unlockedRef.current = unlocked
  const cameraModeRef = useRef(cameraMode)
  cameraModeRef.current = cameraMode
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack

  const currentNode = graph ? w3NodeById(graph, currentNodeId) : null
  const stageId = panelStageId
  const panelAction = stageId ? stageActionFor(stageId, { hasBooks, firstBookId, todayPages, totalPages }) : null
  const questReady = todayPages > 0
  const cleared = stageId ? progress.clearedStageIds.includes(stageId) : false

  const handleClear = () => {
    if (!stageId) return
    const next = clearRpgStage(progress, stageId, [...(W3_UNLOCKS[stageId] ?? []), `unlock-after-${stageId}`])
    const order = cfg.stageOrder
    const nxt = order[order.indexOf(stageId) + 1]
    const withNext: RpgProgressState = {
      ...next,
      unlockedStageIds: [...new Set([...next.unlockedStageIds, ...(nxt ? [nxt] : [])])],
    }
    setProgress(withNext)
    saveRpgProgress(withNext)
    onStageAction?.(stageId, panelAction?.target ?? 'today')
  }

  return (
    <div data-testid="rpg-world3d" data-node={currentNodeId} style={{ position: 'relative', width: '100%' }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 15 }}>{cfg.title}</strong>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>いま: {currentNode ? nodeLabel(cfg, currentNode) : currentNodeId}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button data-testid="rpg-3d-camera" type="button" onClick={() => setCameraMode((m) => (m === 'follow' ? 'overview' : 'follow'))} style={{ minHeight: 44, padding: '0 12px', flex: 1 }}>
            {cameraMode === 'follow' ? '全体をみる' : '追従にもどる'}
          </button>
          {onBack && (
            <button data-testid="rpg-3d-back" type="button" onClick={onBack} style={{ minHeight: 44, padding: '0 12px', flex: 1 }}>
              ワールド選択へ
            </button>
          )}
        </div>
      </div>
      <div
        ref={mountRef}
        data-testid="rpg-3d-canvas"
        style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', touchAction: 'manipulation', background: '#8fc7f5' }}
      />
      {!ready && !loadError && (
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
          3Dワールドを読み込み中…（{loadStage} {loadPct}%）
        </div>
      )}
      {loadError && (
        <div data-testid="rpg-3d-error" style={{ fontSize: 13, color: 'var(--danger)', marginTop: 4 }}>
          3D読込エラー: {loadError}（簡易マップで遊べます）
        </div>
      )}
      <div data-testid="rpg-3d-char" data-anim={anim} data-node={currentNodeId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
        {currentNodeId}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'stretch' }}>
        <div data-testid="rpg-3d-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 52px)', gridTemplateRows: 'repeat(2, 44px)', gap: 4, touchAction: 'none' }}>
          <span />
          <button data-testid="rpg-3d-up" type="button" aria-label="北へ" onPointerDown={() => apiRef.current?.stepToward(0, -1)} style={{ minHeight: 44 }}>▲</button>
          <span />
          <button data-testid="rpg-3d-left" type="button" aria-label="西へ" onPointerDown={() => apiRef.current?.stepToward(-1, 0)} style={{ minHeight: 44 }}>◀</button>
          <button data-testid="rpg-3d-down" type="button" aria-label="南へ" onPointerDown={() => apiRef.current?.stepToward(0, 1)} style={{ minHeight: 44 }}>▼</button>
          <button data-testid="rpg-3d-right" type="button" aria-label="東へ" onPointerDown={() => apiRef.current?.stepToward(1, 0)} style={{ minHeight: 44 }}>▶</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <button
            data-testid="rpg-3d-decide"
            type="button"
            disabled={!currentNode?.stageId}
            onClick={() => currentNode?.stageId && setPanelStageId(currentNode.stageId)}
            style={{ minHeight: 48, fontWeight: 800 }}
          >
            {currentNode?.stageId ? 'ステージをみる' : 'ステージなし'}
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            十字キー/WASD・タップ・D-padで移動。Mで全体表示。
          </div>
        </div>
      </div>
      {stageId && panelAction && (
        <section data-testid="rpg-3d-stage" style={{ marginTop: 8, padding: 12, borderRadius: 12, background: '#fffdf0', border: '2px solid #eab308' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{cfg.stageTitles[stageId] ?? stageId}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>つながり: {panelAction.hint}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            今日 {todayPages}ページ ／ 累計 {totalPages}ページ
          </div>
          {cleared ? (
            <div data-testid="rpg-3d-cleared" style={{ marginTop: 8, fontWeight: 800, color: '#1a7f37' }}>
              クリアずみ！新しい道が開いたよ
            </div>
          ) : questReady ? (
            <button data-testid="rpg-3d-clear" type="button" onClick={handleClear} style={{ marginTop: 8, minHeight: 48, width: '100%', fontWeight: 800 }}>
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

function nodeLabel(cfg: World3dConfig, node: { id: string; label?: string }): string {
  return cfg.nodeLabels[node.id] ?? node.label ?? node.id
}
