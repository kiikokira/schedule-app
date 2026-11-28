import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DIR = join(ROOT, 'artifacts', 'sfc-campus-source')
const SOURCE_PNG = join(SOURCE_DIR, 'daigaku-bubun.png')
const PREVIEW_TXT = join(SOURCE_DIR, 'preview.txt')

const CROP = { x0: 0.19, x1: 0.928, y0: 0.113, y1: 0.954 }
const COLS = 185
const ROWS = 148
const CELL = 8
const SAMPLE = [0.1, 0.3, 0.5, 0.7, 0.9]

function classifyPixel(r, g, b) {
  if (r < 110 && g < 110 && b < 110) return 'd'
  if (r > 200 && g >= 150 && g <= 205 && b < 110) return 'o'
  if (r > 225 && g > 225 && b > 225) return 'w'
  if (b > 200 && r < 150) return 'b'
  if (g > r + 25 && g > b + 25) return 'g'
  return '?'
}

function classifyCell(png, c, r) {
  const counts = { o: 0, w: 0, b: 0, g: 0 }
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
  for (const kind of ['o', 'w', 'b', 'g']) {
    if (counts[kind] > bestCount) {
      best = kind
      bestCount = counts[kind]
    }
  }
  return best
}

function buildPreview(png) {
  const lines = []
  for (let r = 0; r < ROWS; r += 1) {
    let line = ''
    for (let c = 0; c < COLS; c += 1) line += classifyCell(png, c, r)
    lines.push(line)
  }
  return lines
}

if (process.argv.includes('--preview')) {
  const png = PNG.sync.read(readFileSync(SOURCE_PNG))
  const lines = buildPreview(png)
  writeFileSync(PREVIEW_TXT, `${lines.join('\n')}\n`)
  console.log(`source ${png.width}x${png.height}, wrote ${lines.length} lines x ${COLS} cols to ${PREVIEW_TXT}`)
} else {
  console.error('usage: node scripts/build-campus-grid.mjs --preview')
  process.exit(1)
}
