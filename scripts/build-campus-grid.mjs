import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DIR = join(ROOT, 'artifacts', 'sfc-campus-source')
const SOURCE_PNG = join(SOURCE_DIR, 'daigaku-bubun.png')
const PREVIEW_TXT = join(SOURCE_DIR, 'preview.txt')
const GRID_TS = join(ROOT, 'src', 'lib', 'sfcCampusGrid.ts')

const CROP = { x0: 0.19, x1: 0.928, y0: 0.113, y1: 0.954 }
const COLS = 185
const ROWS = 148
const CELL = 8
const SAMPLE = [0.1, 0.3, 0.5, 0.7, 0.9]
const VIEW_W = 2000
const WALL = 6
// Player start, fixed on purpose: the bottom-most road row sits against the south cliff,
// so the start is taken from row 138 (road at cols 71-88) instead.
const SPAWN_CELL = { col: 79, row: 138 }
const TEXT_MAX = 150
const ICON_MAX = 40
const CLASS_ORDER = ['o', 'w', 'y', 'c', 's', 'b', 'g']
const ROAD_IN = new Set(['w', 'y', 's', 'c'])
const TEXT_IN = new Set(['w', 'd', '?', 'y'])
const ICON_IN = new Set(['w', 'd', '?', 'y', 'g'])
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]

// 2000 px wide viewer coordinates (x0, x1, y0, y1) of each named building
const NAMED = [
  { ch: 'S', id: 'sigma-cafeteria', label: 'Σ 厚生棟', box: [450, 700, 290, 450] },
  { ch: 'K', id: 'kappa', label: 'κ館', box: [740, 860, 470, 590] },
  { ch: 'E', id: 'epsilon', label: 'ε館', box: [910, 1030, 510, 630] },
  { ch: 'I', id: 'iota', label: 'ι館', box: [1085, 1200, 545, 665] },
  { ch: 'O', id: 'omicron', label: 'ο館', box: [1260, 1380, 580, 700] },
  { ch: 'L', id: 'lambda', label: 'λ館', box: [1430, 1550, 700, 820] },
  { ch: 'M', id: 'mu', label: 'Μメディアセンター', box: [920, 1140, 770, 935] },
  { ch: 'U', id: 'lounge', label: '学生ラウンジ', box: [720, 820, 860, 965] },
  { ch: 'Y', id: 'tau', label: 'τ大学院棟', box: [1470, 1700, 165, 290] },
  { ch: 'T', id: 'theta', label: 'Θ大講義室棟', box: [1350, 1545, 850, 1090] },
  { ch: 'W', id: 'omega', label: 'Ω大講義室棟', box: [750, 1000, 990, 1160] },
  { ch: 'A', id: 'alpha', label: 'Α本館', box: [1090, 1345, 1040, 1250] },
]

function classifyPixel(r, g, b) {
  if (r < 110 && g < 110 && b < 110) return 'd'
  if (r > 200 && g >= 150 && g <= 205 && b < 110) return 'o'
  if (r > 225 && g > 225 && b > 225) return 'w'
  if (r > 200 && g > 215 && b < 130) return 'y'
  if (r < 60 && g >= 150 && g <= 200 && b >= 220) return 'c'
  if (r >= 60 && r < 150 && g >= 180 && b >= 230) return 'b'
  if (r >= 150 && r <= 225 && g >= 200 && b >= 240) return 's'
  if (g > r + 25 && g > b + 25) return 'g'
  return '?'
}

function classifyCell(png, c, r) {
  const counts = Object.fromEntries(CLASS_ORDER.map((k) => [k, 0]))
  for (const fy of SAMPLE) {
    for (const fx of SAMPLE) {
      const x = Math.floor((CROP.x0 + ((c + fx) / COLS) * (CROP.x1 - CROP.x0)) * png.width)
      const y = Math.floor((CROP.y0 + ((r + fy) / ROWS) * (CROP.y1 - CROP.y0)) * png.height)
      const i = (y * png.width + x) * 4
      const kind = classifyPixel(png.data[i], png.data[i + 1], png.data[i + 2])
      if (kind in counts) counts[kind] += 1
    }
  }
  let best = '?'
  let bestCount = 0
  for (const kind of CLASS_ORDER) {
    if (counts[kind] > bestCount) {
      best = kind
      bestCount = counts[kind]
    }
  }
  return best
}

const inside = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS
const colOf = (k) => k % COLS
const rowOf = (k) => Math.floor(k / COLS)
const idxOf = (c, r) => r * COLS + c

function components(cells, match, dirs = DIRS4) {
  const seen = new Uint8Array(COLS * ROWS)
  const comps = []
  for (let i = 0; i < cells.length; i += 1) {
    if (seen[i] || !match(cells[i])) continue
    const comp = []
    const stack = [i]
    seen[i] = 1
    while (stack.length > 0) {
      const k = stack.pop()
      comp.push(k)
      for (const [dc, dr] of dirs) {
        const nc = colOf(k) + dc
        const nr = rowOf(k) + dr
        if (!inside(nc, nr)) continue
        const j = idxOf(nc, nr)
        if (!seen[j] && match(cells[j])) {
          seen[j] = 1
          stack.push(j)
        }
      }
    }
    comps.push(comp)
  }
  return comps
}

function describe(comp) {
  const cs = comp.map(colOf)
  const rs = comp.map(rowOf)
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
  return {
    size: comp.length,
    c0: Math.min(...cs),
    c1: Math.max(...cs),
    r0: Math.min(...rs),
    r1: Math.max(...rs),
    cx: mean(cs),
    cy: mean(rs),
  }
}

function fillEnclosed(cells, wall, fill, allowed, maxSize) {
  for (const comp of components(cells, (ch) => ch !== wall)) {
    if (comp.length > maxSize) continue
    const touchesEdge = comp.some((k) => colOf(k) === 0 || rowOf(k) === 0 || colOf(k) === COLS - 1 || rowOf(k) === ROWS - 1)
    if (touchesEdge || !comp.every((k) => allowed(cells[k]))) continue
    for (const k of comp) cells[k] = fill
  }
}

function toCell(vx, vy, viewH) {
  return {
    c: ((vx / VIEW_W - CROP.x0) / (CROP.x1 - CROP.x0)) * COLS,
    r: ((vy / viewH - CROP.y0) / (CROP.y1 - CROP.y0)) * ROWS,
  }
}

function assignBuildings(cells, viewH) {
  const allOrange = components(cells, (ch) => ch === 'o')
  for (const comp of allOrange) if (comp.length < 20) for (const k of comp) cells[k] = 'g'
  const buildings = allOrange.filter((comp) => comp.length >= 20)
  const stats = buildings.map(describe)
  const letters = new Map()
  for (const entry of NAMED) {
    const [x0, x1, y0, y1] = entry.box
    const a = toCell(x0, y0, viewH)
    const b = toCell(x1, y1, viewH)
    let best = -1
    stats.forEach((s, i) => {
      if (letters.has(i)) return
      if (s.cx < a.c - 2 || s.cx > b.c + 2 || s.cy < a.r - 2 || s.cy > b.r + 2) return
      if (best < 0 || s.size > stats[best].size) best = i
    })
    if (best < 0) throw new Error(`named building ${entry.ch} (${entry.label}) not found`)
    letters.set(best, entry.ch)
  }
  let unnamed = 0
  buildings.forEach((comp, i) => {
    const ch = letters.get(i) ?? 'n'
    if (ch === 'n') unnamed += 1
    for (const k of comp) cells[k] = ch
  })
  return { stats, letters, unnamed }
}

function isBuildingChar(ch) {
  return ch === 'n' || NAMED.some((entry) => entry.ch === ch)
}

function fillRoadHoles(cells) {
  let changed = true
  while (changed) {
    changed = false
    for (let k = 0; k < cells.length; k += 1) {
      if (cells[k] !== '?' && cells[k] !== 'd') continue
      const c = colOf(k)
      const r = rowOf(k)
      const road = ([dc, dr]) => inside(c + dc, r + dr) && cells[idxOf(c + dc, r + dr)] === '='
      const roadNeighbours = DIRS4.filter(road).length
      const bridges = (road([1, 0]) && road([-1, 0])) || (road([0, 1]) && road([0, -1]))
      if (roadNeighbours >= 3 || bridges) {
        cells[k] = '='
        changed = true
      }
    }
  }
}

function widenThinRoads(cells) {
  const land = (ch) => ch === 'g' || ch === '?' || ch === 'd'
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false
    for (let k = 0; k < cells.length; k += 1) {
      if (cells[k] !== '=') continue
      const c = colOf(k)
      const r = rowOf(k)
      const blocks = [
        [[0, 0], [1, 0], [0, 1], [1, 1]],
        [[-1, 0], [0, 0], [-1, 1], [0, 1]],
        [[0, -1], [1, -1], [0, 0], [1, 0]],
        [[-1, -1], [0, -1], [-1, 0], [0, 0]],
      ]
      const hasSolid = blocks.some((block) => block.every(([dc, dr]) => {
        const x = c + dc
        const y = r + dr
        return inside(x, y) && cells[idxOf(x, y)] === '='
      }))
      if (hasSolid) continue
      let best = null
      for (const block of blocks) {
        const others = block.filter(([dc, dr]) => !(dc === 0 && dr === 0))
        const cellsInBlock = block.map(([dc, dr]) => [c + dc, r + dr])
        if (!cellsInBlock.every(([x, y]) => inside(x, y))) continue
        const ok = others.every(([dc, dr]) => {
          const x = c + dc
          const y = r + dr
          return cells[idxOf(x, y)] === '=' || land(cells[idxOf(x, y)])
        })
        if (!ok) continue
        const roadCount = others.filter(([dc, dr]) => cells[idxOf(c + dc, r + dr)] === '=').length
        if (!best || roadCount > best.roadCount) best = { others, roadCount, c, r }
      }
      if (!best) continue
      for (const [dc, dr] of best.others) {
        const x = best.c + dc
        const y = best.r + dr
        if (cells[idxOf(x, y)] !== '=') cells[idxOf(x, y)] = '='
      }
      changed = true
    }
    if (!changed) break
  }
}

function fixRoadsInBuildings(cells) {
  let fixed = 0
  let changed = true
  while (changed) {
    changed = false
    for (let k = 0; k < cells.length; k += 1) {
      if (cells[k] !== '=') continue
      const c = colOf(k)
      const r = rowOf(k)
      const counts = new Map()
      for (const [dc, dr] of DIRS4) {
        if (!inside(c + dc, r + dr)) continue
        const ch = cells[idxOf(c + dc, r + dr)]
        if (isBuildingChar(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1)
      }
      const total = [...counts.values()].reduce((sum, v) => sum + v, 0)
      if (total < 3) continue
      cells[k] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      fixed += 1
      changed = true
    }
  }
  return fixed
}

function keepSpawnRoads(cells) {
  const spawn = idxOf(SPAWN_CELL.col, SPAWN_CELL.row)
  if (cells[spawn] !== '=') throw new Error('spawn cell is not a road cell')
  let removed = 0
  for (const comp of components(cells, (ch) => ch === '=')) {
    if (comp.includes(spawn)) continue
    for (const k of comp) cells[k] = '.'
    removed += comp.length
  }
  return removed
}

function spawnCell(cells) {
  const road = (c) => inside(c, SPAWN_CELL.row) && cells[idxOf(c, SPAWN_CELL.row)] === '='
  if (!road(SPAWN_CELL.col)) throw new Error('spawn cell is not a road cell')
  let left = SPAWN_CELL.col
  let right = SPAWN_CELL.col
  while (road(left - 1)) left -= 1
  while (road(right + 1)) right += 1
  return { col: Math.floor((left + right) / 2), row: SPAWN_CELL.row }
}

function buildGrid(png) {
  const viewH = (VIEW_W * png.height) / png.width
  const cells = new Array(COLS * ROWS)
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) cells[idxOf(c, r)] = classifyCell(png, c, r)
  }
  fillEnclosed(cells, 'b', 'b', () => true, TEXT_MAX)
  const pondComps = components(cells, (ch) => ch === 'b').sort((a, b) => b.length - a.length)
  const pond = new Set(pondComps[0])

  fillEnclosed(cells, 'o', 'o', (ch) => TEXT_IN.has(ch), TEXT_MAX)
  fillEnclosed(cells, 'o', 'o', (ch) => ICON_IN.has(ch), ICON_MAX)
  const { stats, letters, unnamed } = assignBuildings(cells, viewH)

  for (let k = 0; k < cells.length; k += 1) if (ROAD_IN.has(cells[k])) cells[k] = '='
  fillRoadHoles(cells)

  const roadSummary = components(cells, (ch) => ch === '=').map((comp) => describe(comp))
  const removedBeforeWiden = keepSpawnRoads(cells)
  widenThinRoads(cells)

  for (const k of pond) cells[k] = '~'
  for (const comp of pondComps.slice(1)) for (const k of comp) cells[k] = 'g'

  for (let k = 0; k < cells.length; k += 1) {
    const c = colOf(k)
    const r = rowOf(k)
    const ch = cells[k]
    if (isBuildingChar(ch)) continue
    const dist = Math.min(c, r, COLS - 1 - c, ROWS - 1 - r)
    if (dist < WALL) cells[k] = '#'
    else if (dist === WALL && ch !== '=' && ch !== '~') cells[k] = ':'
  }

  for (let k = 0; k < cells.length; k += 1) {
    const ch = cells[k]
    if (ch !== 'g' && ch !== '?' && ch !== 'd') continue
    const c = colOf(k)
    const r = rowOf(k)
    if (DIRS8.some(([dc, dr]) => inside(c + dc, r + dr) && cells[idxOf(c + dc, r + dr)] === '~')) cells[k] = ':'
  }
  const fixedInBuildings = fixRoadsInBuildings(cells)
  const removedRoads = removedBeforeWiden + keepSpawnRoads(cells)
  for (let k = 0; k < cells.length; k += 1) {
    if (cells[k] === 'g' || cells[k] === '?' || cells[k] === 'd' || cells[k] === 'b') cells[k] = '.'
  }

  return { cells, pond, stats, letters, unnamed, roadSummary, fixedInBuildings, removedRoads }
}

function toRows(cells) {
  const lines = []
  for (let r = 0; r < ROWS; r += 1) {
    let line = ''
    for (let c = 0; c < COLS; c += 1) line += cells[idxOf(c, r)]
    lines.push(line)
  }
  return lines
}

function findSpecialCells(cells, pond) {
  const roads = cells.map((ch) => ch === '=')
  let namiki = null
  for (let c = 0; c < COLS; c += 1) {
    for (let r = 0; r < ROWS; r += 1) {
      if (!roads[idxOf(c, r)] || (r > 0 && roads[idxOf(c, r - 1)])) continue
      let end = r
      while (end + 1 < ROWS && roads[idxOf(c, end + 1)]) end += 1
      const len = end - r + 1
      if (!namiki || len > namiki.len) namiki = { len, col: c, row: r + Math.floor((len - 1) / 2) }
    }
  }

  let pondCx = 0
  let pondCy = 0
  for (const k of pond) {
    pondCx += colOf(k)
    pondCy += rowOf(k)
  }
  pondCx /= pond.size
  pondCy /= pond.size
  let kamoike = null
  for (const k of pond) {
    const c = colOf(k)
    const r = rowOf(k)
    for (const [dc, dr] of DIRS8) {
      const x = c + dc
      const y = r + dr
      if (!inside(x, y) || cells[idxOf(x, y)] !== ':' || x <= pondCx) continue
      const d = (x - pondCx) ** 2 + (y - pondCy) ** 2
      if (!kamoike || d < kamoike.d) kamoike = { d, col: x, row: y }
    }
  }

  const spawn = spawnCell(cells)

  return {
    namiki: { col: namiki.col, row: namiki.row },
    kamoike: { col: kamoike.col, row: kamoike.row },
    spawn,
  }
}

function renderTs(lines, special) {
  const rows = lines.map((line) => `  '${line}',`).join('\n')
  return [
    '// Generated by scripts/build-campus-grid.mjs from artifacts/sfc-campus-source/daigaku-bubun.png. Do not edit by hand.',
    `export const CAMPUS_CELL = ${CELL}`,
    `export const CAMPUS_COLS = ${COLS}`,
    `export const CAMPUS_ROWS = ${ROWS}`,
    'export const CAMPUS_GRID: readonly string[] = [',
    rows,
    ']',
    `export const CAMPUS_NAMIKI_CELL = { col: ${special.namiki.col}, row: ${special.namiki.row} }`,
    `export const CAMPUS_KAMOIKE_CELL = { col: ${special.kamoike.col}, row: ${special.kamoike.row} }`,
    `export const CAMPUS_SPAWN_CELL = { col: ${special.spawn.col}, row: ${special.spawn.row} }`,
    '',
  ].join('\n')
}

const png = PNG.sync.read(readFileSync(SOURCE_PNG))
const result = buildGrid(png)
const lines = toRows(result.cells)

if (process.argv.includes('--inspect')) {
  for (const [i, s] of result.stats.entries()) {
    const name = result.letters.get(i) ?? 'n'
    console.log(`bld ${name} size=${s.size} cols=${s.c0}-${s.c1} rows=${s.r0}-${s.r1} centre=${s.cx.toFixed(1)},${s.cy.toFixed(1)}`)
  }
  for (const s of result.roadSummary.slice(0, 40)) {
    console.log(`road size=${s.size} cols=${s.c0}-${s.c1} rows=${s.r0}-${s.r1}`)
  }
}

const namedCount = NAMED.filter((entry) => lines.some((line) => line.includes(entry.ch))).length
console.log(`named buildings ${namedCount}, unnamed ${result.unnamed}, pond cells ${result.pond.size}`)
console.log(`road cells inside buildings fixed ${result.fixedInBuildings}, road cells outside the spawn network removed ${result.removedRoads}`)

if (process.argv.includes('--preview')) {
  writeFileSync(PREVIEW_TXT, `${lines.join('\n')}\n`)
  console.log(`wrote preview ${PREVIEW_TXT}`)
} else {
  const special = findSpecialCells(result.cells, result.pond)
  writeFileSync(GRID_TS, renderTs(lines, special))
  writeFileSync(PREVIEW_TXT, `${lines.join('\n')}\n`)
  console.log(`wrote ${GRID_TS} and ${PREVIEW_TXT}`)
}
