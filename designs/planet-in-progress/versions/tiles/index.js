// Planet in progress: a faceted sphere still being assembled. Tiles facing the build
// direction are laid, the rest is scaffolding, and a few tiles are flying into place.
import opentype from 'opentype.js'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'fs'

const at = p => new URL(p, import.meta.url)
const fb = readFileSync(at('node_modules/@fontsource/sora/files/sora-latin-700-normal.woff'))
const font = opentype.parse(fb.buffer.slice(fb.byteOffset, fb.byteOffset + fb.byteLength))

const { sin, cos, hypot, abs, max, min, PI } = Math
const unit = v => v.map(c => c / hypot(...v))
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const D = PI / 180, S = 1200, CX = 600, CY = 485, R = 290
const T = 16 * D, YAW = 8 * D, STEP = 15 // camera tilt, globe spin, tile size in degrees
const B = unit([-1, -.32, .12])          // build direction, tiles facing it are finished
const L = unit([-.5, .65, .6])           // light, view space
const GAP = .9                           // tile size inside its grid cell
const JITTER = .5                        // how ragged the build edge is
const FLIGHTS = [.18, .42, .8]           // how far each incoming tile still has to travel
const n = v => +v.toFixed(1)
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(11)

// lon/lat (degrees) -> view-space unit vector, z > 0 faces the camera
const V = (lon, lat) => {
  const x = cos(lat * D) * sin(lon * D + YAW), y = sin(lat * D), z = cos(lat * D) * cos(lon * D + YAW)
  return [x, y * cos(T) - z * sin(T), y * sin(T) + z * cos(T)]
}
const xy = v => [CX + R * v[0], CY - R * v[1]]
const poly = pts => 'M' + pts.map(v => xy(v).map(n).join(' ')).join('L') + 'Z'
const ramp = (stops, t) => {
  t = max(0, min(1, t)) * (stops.length - 1)
  const i = min(stops.length - 2, t | 0), f = t - i, [a, b] = [stops[i], stops[i + 1]].map(s => [1, 3, 5].map(j => parseInt(s.slice(j, j + 2), 16)))
  return '#' + a.map((c, j) => Math.round(c + (b[j] - c) * f).toString(16).padStart(2, '0')).join('')
}
const BLUE = ['#140e4f', '#2a1fa8', '#4b4ff0', '#8197ff', '#bccbff'], ORANGE = ['#7a2418', '#e8512f', '#ff8a3d', '#ffc56b', '#fff0c4']
const lit = nv => .2 + .8 * max(0, dot(nv, L))

// grid cells, each laid, in flight or still scaffold. The poles are single round
// caps so the meridians don't bunch up there
const TOP = 90 - STEP, ring = la => Array.from({ length: 360 / STEP }, (_, i) => [i * STEP, la])
const grid = [[ring(TOP), [0, 90]], [ring(-TOP).reverse(), [0, -90]]]
for (let la = -TOP; la < TOP; la += STEP) for (let lo = 0; lo < 360; lo += STEP)
  grid.push([[[lo, la], [lo + STEP, la], [lo + STEP, la + STEP], [lo, la + STEP]], [lo + STEP / 2, la + STEP / 2]])
const cells = grid.map(([g, mid]) => {
  const c = V(...mid), b = dot(c, B) + (rnd() - .5) * JITTER, r = rnd()
  const state = b > .1 || b > -.2 && c[2] > .3 && r < .45 ? 'solid' : 'wire'
  return { g, c, b, lat: mid[1], state, q: g.map(p => V(...p)) }
})
// tiles in flight: scaffold cells right at the build edge, one per row
cells.filter(c => c.state == 'wire' && c.b > -.35 && c.c[2] > .35 && abs(c.lat) < 50).sort((a, b) => b.b - a.b)
  .reduce((rows, c) => rows.size < FLIGHTS.length && !rows.has(c.lat) ? (c.state = 'flying', rows.add(c.lat)) : rows, new Set())
const tile = (q, c, s = GAP, r = 1) => q.map(p => p.map((v, i) => (c[i] + (v - c[i]) * s) * r))

// scaffold edges and joints, deduped across neighbouring cells
const key = ([lo, la]) => la % 90 ? lo % 360 + ',' + la : la
const edges = new Map(), joints = new Map()
for (const { g, q, state } of cells) if (state != 'solid') g.forEach((p, i) => {
  const j = (i + 1) % g.length
  if (key(p) != key(g[j])) edges.set([p, g[j]].map(key).sort().join('|'), [q[i], q[j]])
  joints.set(key(p), q[i])
})
const front = v => v[2] > 0
const line = ([a, b]) => 'M' + xy(a).map(n).join(' ') + 'L' + xy(b).map(n).join(' ')
const wire = f => [...edges.values()].filter(e => f(e[0][2] + e[1][2] > 0)).map(line).join('')
const dots = (f, r) => [...joints.values()].filter(v => f(front(v))).map(v => `<circle cx="${n(xy(v)[0])}" cy="${n(xy(v)[1])}" r="${r}"/>`).join('')

const byDepth = (a, b) => a.c[2] - b.c[2]
const inside = cells.filter(c => c.state == 'solid' && c.c[2] <= 0).sort(byDepth)
  .map(({ q, c }) => `<path d="${poly(tile(q, c))}" fill="${ramp(BLUE, lit(c.map(v => -v)) * .45)}"/>`).join('')
const outside = cells.filter(c => c.state == 'solid' && c.c[2] > 0).sort(byDepth)
  .map(({ q, c }) => `<path d="${poly(tile(q, c))}" fill="${ramp(BLUE, lit(c))}"/>`).join('')
const sockets = cells.filter(c => c.state == 'flying')
  .map(({ q, c }) => `<path d="${poly(tile(q, c))}"/>`).join('')
// flying tiles drift in from the upper right, lifted off their sockets
const flying = cells.filter(c => c.state == 'flying').map(({ q, c }, i) => {
  const o = [.8, .55, .25].map((v, j) => v * FLIGHTS[i] + c[j] * .05)
  const t = tile(q, c, GAP * 1.04).map(p => p.map((v, k) => v + o[k])), [a, b] = [c, c.map((v, k) => v + o[k])].map(v => xy(v).map(n).join(' '))
  return `<path d="M${a}L${b}" class="trail"/><path d="${poly(t)}" fill="${ramp(ORANGE, .3 + .45 * lit(c))}"/>`
}).join('')

// wordmark, laid out glyph by glyph so the tracking can be opened up
const word = (text, size, track, y) => {
  const gs = font.stringToGlyphs(text), adv = g => g.advanceWidth / font.unitsPerEm * size
  const w = gs.reduce((s, g) => s + adv(g), 0) + track * size * (gs.length - 1)
  let x = CX - w / 2
  const pd = cmds => cmds.map(c => c.type + [c.x1, c.y1, c.x2, c.y2, c.x, c.y].filter(v => v != null).map(n).join(' ')).join('')
  return gs.map(g => (d => (x += adv(g) + track * size, d))(pd(g.getPath(x, y, size).commands))).join('')
}
const wordmark = word('RENOX', 124, .16, 985)

const THEMES = {
  dark: { bg: '#0b0a24', ink: '#ffffff', wire: '#8c95ff', ghost: '#5b63d9', back: .28 },
  light: { bg: '#f5f4ff', ink: '#16123f', wire: '#4a4fd1', ghost: '#8d92e8', back: .16 },
  mark: { wire: '#6f78f2', ghost: '#7f86e6', back: .2 },
}
const svg = ({ bg, ink, wire: w, ghost, back }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${ink ? S : S * .84}" width="${S}" height="${ink ? S : S * .84}">
<style>.trail{stroke:${ORANGE[2]};stroke-width:2.5;stroke-dasharray:2 7;stroke-linecap:round;opacity:.8}</style>
${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}
<g transform="translate(0 ${ink ? 0 : -CY + S * .42})">
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${ghost}" stroke-width="2.5" stroke-dasharray="1 11" stroke-linecap="round"/>
  <path d="${wire(f => !f)}" fill="none" stroke="${w}" stroke-width="1.4" opacity="${back}"/>
  <g fill="${w}" opacity="${back}">${dots(f => !f, 2)}</g>
  ${inside}
  <path d="${wire(f => f)}" fill="none" stroke="${w}" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>
  <g fill="${w}">${dots(f => f, 3.6)}</g>
  ${outside}
  <g fill="none" stroke="${ORANGE[2]}" stroke-width="2.4" stroke-dasharray="7 6" stroke-linejoin="round">${sockets}</g>
  ${flying}
</g>
${ink ? `<path d="${wordmark}" fill="${ink}"/>` : ''}
</svg>`

for (const [name, theme] of Object.entries(THEMES)) {
  const s = svg(theme), file = name == 'mark' ? 'mark' : 'logo-' + name
  writeFileSync(at(file + '.svg'), s)
  writeFileSync(at(file + '.png'), new Resvg(s, { fitTo: { mode: 'width', value: 2048 } }).render().asPng())
}
