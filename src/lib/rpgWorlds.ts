export const WORLD_COUNT = 9
export const LEVELS_PER_WORLD = 10

export type WorldId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type EdgeKind = 'walk' | 'ladder' | 'jump'
export type WorldTheme =
  | 'grass'
  | 'desert'
  | 'snow'
  | 'sea'
  | 'forest'
  | 'rock'
  | 'cloud'
  | 'lava'
  | 'rainbow'

export type RpgNode = { level: number; x: number; y: number }
export type RpgEdge = { from: number; to: number; kind: EdgeKind }
export type RpgDeco = { emoji: string; x: number; y: number; size: number }

export type WorldDef = {
  id: WorldId
  name: string
  theme: WorldTheme
  levels: [number, number]
  sky: [string, string]
  ground: string
  road: string
  nodes: RpgNode[]
  edges: RpgEdge[]
  deco: RpgDeco[]
  castle: { x: number; y: number }
}

function serpentine(
  levelBase: number,
  dx: number,
  dy: number,
  flip: 1 | -1,
  nodeCount: number,
  ladderAt: number,
  jumpAt: number,
): { nodes: RpgNode[]; edges: RpgEdge[] } {
  const base: [number, number][] = [
    [30, 190], [110, 192], [190, 186], [268, 176], [318, 142],
    [252, 112], [162, 110], [92, 94], [62, 50], [150, 34],
    [238, 44], [318, 62],
  ]
  const nodes = base.slice(0, nodeCount).map(([x, y], i) => ({
    level: levelBase + i,
    x: Math.round(Math.min(350, Math.max(10, flip === 1 ? x + dx : 360 - x + dx))),
    y: Math.round(Math.min(210, Math.max(10, y + dy))),
  }))
  const edges = nodes.slice(0, -1).map((_, i) => ({
    from: i,
    to: i + 1,
    kind: (i === ladderAt ? 'ladder' : i === jumpAt ? 'jump' : 'walk') as EdgeKind,
  }))
  return { nodes, edges }
}

function world(
  id: WorldId,
  name: string,
  theme: WorldTheme,
  sky: [string, string],
  ground: string,
  road: string,
  dx: number,
  dy: number,
  flip: 1 | -1,
  nodeCount: number,
  ladderAt: number,
  jumpAt: number,
  deco: RpgDeco[],
  castle: { x: number; y: number },
): WorldDef {
  const levelBase = (id - 1) * LEVELS_PER_WORLD + 1
  const { nodes, edges } = serpentine(levelBase, dx, dy, flip, nodeCount, ladderAt, jumpAt)
  return {
    id,
    name,
    theme,
    levels: [levelBase, levelBase + LEVELS_PER_WORLD - 1],
    sky,
    ground,
    road,
    nodes,
    edges,
    deco,
    castle,
  }
}

export const WORLD_DEFS: WorldDef[] = [
    world(1, 'ワールド1', 'grass', ['#8fd3ff', '#c8f0c8'], '#58a34c', '#d9b06a', 0, 0, 1, 10, 3, 6,
    [
      { emoji: '🌳', x: 60, y: 150, size: 22 }, { emoji: '🌳', x: 300, y: 60, size: 26 },
      { emoji: '🌼', x: 150, y: 150, size: 14 }, { emoji: '🌼', x: 230, y: 80, size: 14 },
      { emoji: '🍄', x: 320, y: 180, size: 18 }, { emoji: '⛰️', x: 20, y: 40, size: 24 },
    ],
    { x: 238, y: 26 }),
    world(2, 'ワールド2', 'desert', ['#7ec8ff', '#ffe9b0'], '#e8c86a', '#c89858', 6, -4, -1, 11, 2, 5,
    [
      { emoji: '🌵', x: 70, y: 150, size: 22 }, { emoji: '🌵', x: 290, y: 70, size: 22 },
      { emoji: '🔺', x: 160, y: 60, size: 26 }, { emoji: '🏜️', x: 240, y: 160, size: 20 },
      { emoji: '🦂', x: 120, y: 100, size: 14 },
    ],
    { x: 122, y: 26 }),
    world(3, 'ワールド3', 'snow', ['#9fd0ff', '#eef6ff'], '#e8f2fc', '#b9c8e0', -6, 2, 1, 12, 4, 2,
    [
      { emoji: '❄️', x: 80, y: 140, size: 18 }, { emoji: '⛄', x: 250, y: 70, size: 24 },
      { emoji: '🌲', x: 310, y: 150, size: 22 }, { emoji: '🌲', x: 40, y: 70, size: 22 },
      { emoji: '🧊', x: 180, y: 160, size: 16 },
    ],
    { x: 238, y: 26 }),
    world(4, 'ワールド4', 'sea', ['#6ec6ff', '#bfefff'], '#7fd4c1', '#e8d49a', 8, -2, -1, 10, 3, 6,
    [
      { emoji: '🌴', x: 70, y: 150, size: 24 }, { emoji: '🌴', x: 290, y: 70, size: 24 },
      { emoji: '🐚', x: 160, y: 150, size: 14 }, { emoji: '⛵', x: 240, y: 170, size: 20 },
      { emoji: '🐢', x: 120, y: 90, size: 16 },
    ],
    { x: 122, y: 26 }),
    world(5, 'ワールド5', 'forest', ['#7ec8a0', '#d0f0c0'], '#3f8f4f', '#c89858', 0, 4, 1, 11, 2, 7,
    [
      { emoji: '🌲', x: 50, y: 140, size: 26 }, { emoji: '🌲', x: 150, y: 60, size: 24 },
      { emoji: '🌳', x: 310, y: 120, size: 26 }, { emoji: '🍄', x: 220, y: 160, size: 16 },
      { emoji: '🦉', x: 100, y: 60, size: 16 },
    ],
    { x: 238, y: 26 }),
    world(6, 'ワールド6', 'rock', ['#a0c8e8', '#d8e4ee'], '#9a8f7f', '#7a6f60', -4, -6, -1, 12, 5, 3,
    [
      { emoji: '⛰️', x: 60, y: 120, size: 28 }, { emoji: '🪨', x: 200, y: 70, size: 20 },
      { emoji: '🟢', x: 300, y: 170, size: 16 }, { emoji: '⛰️', x: 160, y: 170, size: 22 },
    ],
    { x: 122, y: 26 }),
    world(7, 'ワールド7', 'cloud', ['#5aa8ff', '#cfe8ff'], '#ffffff', '#ffd9ec', 4, 6, 1, 10, 3, 6,
    [
      { emoji: '☁️', x: 70, y: 130, size: 26 }, { emoji: '☁️', x: 250, y: 60, size: 30 },
      { emoji: '🌈', x: 160, y: 170, size: 24 }, { emoji: '⭐', x: 320, y: 120, size: 16 },
      { emoji: '🎈', x: 120, y: 50, size: 18 },
    ],
    { x: 238, y: 26 }),
    world(8, 'ワールド8', 'lava', ['#3a2a4a', '#7a2a1a'], '#4a3a3a', '#8a5a3a', -8, -2, -1, 11, 4, 5,
    [
      { emoji: '🌋', x: 70, y: 120, size: 30 }, { emoji: '🔥', x: 220, y: 80, size: 20 },
      { emoji: '🪨', x: 300, y: 160, size: 20 }, { emoji: '💀', x: 150, y: 160, size: 16 },
    ],
    { x: 122, y: 26 }),
    world(9, 'ワールド9', 'rainbow', ['#2a2a6a', '#9a6ac8'], '#c8b8f0', '#ffe066', 0, 0, 1, 12, 2, 4,
    [
      { emoji: '🌈', x: 60, y: 120, size: 28 }, { emoji: '⭐', x: 180, y: 60, size: 20 },
      { emoji: '✨', x: 280, y: 150, size: 18 }, { emoji: '☁️', x: 120, y: 170, size: 22 },
      { emoji: '🎆', x: 240, y: 120, size: 18 },
    ],
    { x: 238, y: 26 }),
]

export function worldForLevel(level: number): WorldId {
  const clamped = Math.max(1, Math.floor(level))
  return Math.min(WORLD_COUNT, Math.floor((clamped - 1) / LEVELS_PER_WORLD) + 1) as WorldId
}

export function unlockedWorldCount(level: number): number {
  return worldForLevel(level)
}

export function nodeForLevel(worldId: WorldId, level: number): number {
  const count = WORLD_DEFS[worldId - 1].nodes.length
  const inBand = Math.min(LEVELS_PER_WORLD, Math.max(1, Math.floor(level) - (worldId - 1) * LEVELS_PER_WORLD))
  return Math.min(count - 1, Math.round(((inBand - 1) * (count - 1)) / (LEVELS_PER_WORLD - 1)))
}

export function worldDef(id: WorldId): WorldDef {
  return WORLD_DEFS[id - 1]
}
