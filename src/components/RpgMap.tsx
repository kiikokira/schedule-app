import { nodeForLevel, type EdgeKind, type WorldDef } from '../lib/rpgWorlds'

export type PlayingState = { nodeIndex: number; edgeKind: EdgeKind | null } | null

type Props = {
  world: WorldDef
  level: number
  token: string
  playing: PlayingState
}

const NODE_R = 7

function ladderRails(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.max(1, Math.hypot(dx, dy))
  const px = (-dy / len) * 5
  const py = (dx / len) * 5
  const rungs: { x1: number; y1: number; x2: number; y2: number }[] = []
  const steps = Math.max(2, Math.floor(len / 9))
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    rungs.push({
      x1: x1 + dx * t - px,
      y1: y1 + dy * t - py,
      x2: x1 + dx * t + px,
      y2: y1 + dy * t + py,
    })
  }
  return {
    railA: { x1: x1 - px, y1: y1 - py, x2: x2 - px, y2: y2 - py },
    railB: { x1: x1 + px, y1: y1 + py, x2: x2 + px, y2: y2 + py },
    rungs,
  }
}

export default function RpgMap({ world, level, token, playing }: Props) {
  const target = nodeForLevel(world.id, level)
  const current = playing ? playing.nodeIndex : target
  const motion = playing ? (playing.edgeKind ?? 'walk') : 'idle'
  const tokenNode = world.nodes[Math.min(current, world.nodes.length - 1)]
  const gradId = `rpg-sky-${world.id}`

  return (
    <div data-testid="rpg-map" data-world={world.id} style={{ position: 'relative', width: '100%', aspectRatio: '360 / 220', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <svg viewBox="0 0 360 220" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} role="img" aria-label={`${world.name}のマップ`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={world.sky[0]} />
            <stop offset="100%" stopColor={world.sky[1]} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="360" height="220" fill={`url(#${gradId})`} />
        <ellipse cx="180" cy="262" rx="230" ry="72" fill={world.ground} />
        {world.deco.map((d, i) => (
          <text key={i} x={d.x} y={d.y} fontSize={d.size} textAnchor="middle">
            {d.emoji}
          </text>
        ))}
        {world.edges.map((e) => {
          const a = world.nodes[e.from]
          const b = world.nodes[e.to]
          if (e.kind === 'jump') {
            const mx = (a.x + b.x) / 2
            const my = Math.min(a.y, b.y) - 22
            return (
              <g key={`${e.from}-${e.to}`} data-testid={`rpg-edge-${e.from}-${e.to}`} data-kind="jump">
                <line x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * 0.25} y2={a.y + (b.y - a.y) * 0.25} stroke={world.road} strokeWidth="10" strokeLinecap="round" />
                <line x1={a.x + (b.x - a.x) * 0.75} y1={a.y + (b.y - a.y) * 0.75} x2={b.x} y2={b.y} stroke={world.road} strokeWidth="10" strokeLinecap="round" />
                <path d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`} fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="5 4" opacity="0.9" />
              </g>
            )
          }
          const rails = e.kind === 'ladder' ? ladderRails(a.x, a.y, b.x, b.y) : null
          return (
            <g key={`${e.from}-${e.to}`} data-testid={`rpg-edge-${e.from}-${e.to}`} data-kind={e.kind}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={world.road} strokeWidth="10" strokeLinecap="round" />
              {rails && (
                <>
                  <line {...rails.railA} stroke="#8a5a2a" strokeWidth="3" strokeLinecap="round" />
                  <line {...rails.railB} stroke="#8a5a2a" strokeWidth="3" strokeLinecap="round" />
                  {rails.rungs.map((r, i) => (
                    <line key={i} {...r} stroke="#8a5a2a" strokeWidth="2" strokeLinecap="round" />
                  ))}
                </>
              )}
            </g>
          )
        })}
        {world.nodes.map((n, i) => {
          const isStart = i === 0
          const cleared = i < current
          const isCurrent = i === current
          const fill = isStart && !cleared && !isCurrent ? '#e5484d' : cleared || isCurrent ? '#2f6df6' : '#ffffff'
          const stroke = fill === '#ffffff' ? '#8a93a6' : '#ffd94d'
          return (
            <circle
              key={n.level}
              data-testid={`rpg-node-${i}`}
              data-current={isCurrent ? 'true' : 'false'}
              data-cleared={cleared ? 'true' : 'false'}
              cx={n.x}
              cy={n.y}
              r={NODE_R}
              fill={fill}
              stroke={stroke}
              strokeWidth="2"
            />
          )
        })}
        <text x={world.castle.x} y={world.castle.y} fontSize="30" textAnchor="middle">
          🏰
        </text>
        <g data-testid="rpg-sign">
          <rect x={world.castle.x - 34} y={world.castle.y - 52} width="46" height="24" rx="4" fill="#8a5a2a" stroke="#5a3a1a" strokeWidth="2" />
          <text x={world.castle.x - 11} y={world.castle.y - 35} fontSize="15" fontWeight="900" fill="#ffffff" textAnchor="middle">
            W{world.id}
          </text>
        </g>
      </svg>
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
        <div
          data-testid="rpg-token"
          data-motion={motion}
          className={motion === 'ladder' ? 'rpg-token-ladder' : 'rpg-token-move'}
          style={{
            position: 'absolute',
            left: `${(tokenNode.x / 360) * 100}%`,
            top: `${(tokenNode.y / 220) * 100}%`,
            transform: 'translate(-50%, -112%)',
            fontSize: 30,
            lineHeight: 1,
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.4))',
          }}
          role="img"
          aria-label="冒険者"
        >
          <span key={current} className={motion === 'jump' ? 'rpg-token-jump-inner' : undefined}>
            {token}
          </span>
        </div>
      </div>
    </div>
  )
}
