// Renox as a planet: the word's glyph outlines are wrapped onto a sphere as raised
// continents, then lit, given an atmosphere, clouds, an ice cap and a ring.
import opentype from 'opentype.js'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'fs'

const at = p => new URL(p, import.meta.url)
const fb = readFileSync(at('../../node_modules/@fontsource/unbounded/files/unbounded-latin-900-normal.woff'))
const font = opentype.parse(fb.buffer.slice(fb.byteOffset, fb.byteOffset + fb.byteLength))

const { sin, cos, hypot, ceil, min, max, PI } = Math
const D = PI / 180, S = 1200, C = S / 2, R = 300
const T = 18 * D           // camera elevation above the equator
const SPAN = 66 * D        // half the longitude the word wraps around
const LAT = T              // word latitude, puts it dead centre of the disc
const RISE = .03           // continent height as a fraction of R
const TRACK = 4            // letter spacing in em/100
const L = (v => v.map(c => c / hypot(...v)))([-.55, .62, .56]) // light, view space
const RINGS = [[1.3, 1.37, .25], [1.39, 1.58, .7], [1.61, 1.64, .3], [1.67, 1.8, .5], [1.82, 1.85, .22]]
const n = v => +v.toFixed(1)
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7)

// lon/lat on a sphere of radius r -> screen [x, y, depth] (depth > 0 faces the camera)
const P = (lon, lat, r = 1) => {
  const x = cos(lat) * sin(lon), y = sin(lat), z = cos(lat) * cos(lon)
  return [C + R * r * x, C - R * r * (y * cos(T) - z * sin(T)), y * sin(T) + z * cos(T)]
}
const poly = pts => 'M' + pts.map(([x, y]) => n(x) + ' ' + n(y)).join('L')

// lay out the word, then flatten every outline into dense polylines so straight
// strokes bend properly once they are wrapped round the sphere
const cmds = []
const gs = font.stringToGlyphs('RENOX')
gs.reduce((x, g, i) => {
  cmds.push(...g.getPath(x, 0, 100).commands)
  return x + (g.advanceWidth + (gs[i + 1] ? font.getKerningValue(g, gs[i + 1]) : 0)) / font.unitsPerEm * 100 + TRACK
}, 0)
const bez = (q, t) => q.length < 2 ? q[0] : bez(q.slice(1).map((v, i) => [q[i][0] + (v[0] - q[i][0]) * t, q[i][1] + (v[1] - q[i][1]) * t]), t)
const outlines = []
let cur, p
for (const c of cmds) {
  if (c.type == 'Z') continue
  const q = [p, c.x1 != null && [c.x1, c.y1], c.x2 != null && [c.x2, c.y2], [c.x, c.y]].filter(Boolean)
  if (c.type == 'M') outlines.push(cur = [[c.x, c.y]])
  else for (let i = 1, k = max(2, ceil(q.slice(1).reduce((s, v, j) => s + hypot(v[0] - q[j][0], v[1] - q[j][1]), 0))); i <= k; i++) cur.push(bez(q, i / k))
  p = [c.x, c.y]
}
const xs = outlines.flat().map(v => v[0]), ys = outlines.flat().map(v => v[1])
const xm = (min(...xs) + max(...xs)) / 2, ym = (min(...ys) + max(...ys)) / 2
const k = SPAN / ((max(...xs) - min(...xs)) / 2)
const word = r => outlines.map(o => poly(o.map(([x, y]) => P((x - xm) * k, LAT + (ym - y) * k * cos(LAT), r))) + 'Z').join('') + islands(r)

// clouds: soft streaks drifting along latitudes, kept clear of the word
const clouds = Array.from({ length: 16 }, () => {
  const lat = (rnd() < .5 ? -46 + rnd() * 32 : 40 + rnd() * 20) * D, lon = (rnd() * 240 - 120) * D, len = (18 + rnd() * 36) * D
  const amp = (rnd() - .5) * 5 * D, w = n(4 + rnd() * 8), o = .2 + rnd() * .25
  const pts = Array.from({ length: 48 }, (_, i) => P(lon + len * i / 47, lat + amp * sin(i / 47 * PI), 1 + RISE * 1.2)).filter(v => v[2] > .1)
  return pts.length > 3 ? `<path d="${poly(pts)}" stroke-width="${w * 2.4}" opacity="${n(o * 50) / 100}" filter="url(#haze)"/><path d="${poly(pts)}" stroke-width="${w}" opacity="${n(o * 100) / 100}" filter="url(#soft)"/>` : ''
}).join('')

// islands: a small archipelago so the letters read as continents
const isles = [[-50, 45, 2.4], [44, 47, 1.7], [-38, -31, 3], [-24, -37, 1.3], [34, -34, 2.2], [50, -27, 1.2]]
  .map(([lon, lat, rad]) => [lon * D, lat * D, rad * D, rnd() * 9])
const islands = r => isles.map(([lon, lat, rad, ph]) => poly(Array.from({ length: 48 }, (_, i) => {
  const a = i / 48 * 2 * PI, q = rad * (1 + .2 * sin(3 * a + ph) + .1 * sin(5 * a + ph * 2))
  return P(lon + q * cos(a) / cos(lat), lat + q * sin(a), r)
})) + 'Z').join('')

// relief: stack shells from the sea floor up to the plateau, darkest first
const mix = (a, b, t) => '#' + [0, 2, 4].map(i => n(parseInt(a.slice(i + 1, i + 3), 16) * (1 - t) + parseInt(b.slice(i + 1, i + 3), 16) * t) | 0).map(v => v.toString(16).padStart(2, '0')).join('')
const relief = Array.from({ length: 9 }, (_, i) => `<path d="${word(1 + RISE * i / 9)}" fill="${mix('#4a1530', '#d2453a', i / 8)}"/>`).join('')

const cap = poly(Array.from({ length: 180 }, (_, i) => P(i * 2 * D, (75 + 1.6 * sin(i * 2 * D * 5) + .9 * sin(i * 2 * D * 13 + 1)) * D, 1 + RISE * .6))) + 'Z'

const ring = `<g id="ring" transform="translate(${C} ${C}) scale(1 ${n(sin(T) * 1000) / 1000})">
  <g fill="none" stroke="url(#ringTone)">
    ${RINGS.flatMap(([a, b, o], _, __, m = ceil((b - a) / .005)) => Array.from({ length: m }, (_, i) => {
      const r = a + (b - a) * (i + .5) / m
      return `<circle r="${n(r * R)}" stroke-width="${n((b - a) / m * R + .6)}" opacity="${n(o * (.55 + rnd() * .45) * 100) / 100}"/>`
    })).join('')}
  </g></g>`

const stars = Array.from({ length: 170 }, () => {
  const x = n(rnd() * S), y = n(rnd() * S), r = rnd() ** 3 * 2.2 + .5, o = n(.25 + rnd() * .75)
  return r > 2.1
    ? `<path d="M${x} ${y - r * 4}Q${x} ${y} ${x + r * 4} ${y}Q${x} ${y} ${x} ${y + r * 4}Q${x} ${y} ${x - r * 4} ${y}Q${x} ${y} ${x} ${y - r * 4}Z" fill="#fff" opacity="${o}"/>`
    : `<circle cx="${x}" cy="${y}" r="${n(r)}" fill="#fff" opacity="${o}"/>`
}).join('')

const lx = n(C + L[0] * R * .62), ly = n(C - L[1] * R * .62)
const svg = bg => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
<defs>
  <radialGradient id="space" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#1a1452"/><stop offset=".55" stop-color="#0a0828"/><stop offset="1" stop-color="#030210"/></radialGradient>
  <radialGradient id="ocean" gradientUnits="userSpaceOnUse" cx="${lx}" cy="${ly}" r="${R * 1.6}"><stop offset="0" stop-color="#7f8cff"/><stop offset=".3" stop-color="#4141e0"/><stop offset=".62" stop-color="#22178f"/><stop offset="1" stop-color="#0c0736"/></radialGradient>
  <radialGradient id="land" gradientUnits="userSpaceOnUse" cx="${lx}" cy="${ly}" r="${R * 1.5}"><stop offset="0" stop-color="#fff1b8"/><stop offset=".28" stop-color="#ffc25c"/><stop offset=".6" stop-color="#ff7b3d"/><stop offset="1" stop-color="#d43f3a"/></radialGradient>
  <radialGradient id="shade" gradientUnits="userSpaceOnUse" cx="${lx}" cy="${ly}" r="${R * 1.95}"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".22" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#04021a" stop-opacity="0"/><stop offset=".78" stop-color="#04021a" stop-opacity=".62"/><stop offset=".92" stop-color="#04021a" stop-opacity=".92"/></radialGradient>
  <radialGradient id="rim" cx=".5" cy=".5" r=".5"><stop offset=".8" stop-color="#7fe0ff" stop-opacity="0"/><stop offset=".96" stop-color="#8fe6ff" stop-opacity=".45"/><stop offset="1" stop-color="#d4f7ff" stop-opacity=".85"/></radialGradient>
  <radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset="${n(100 / 1.14) / 100}" stop-color="#6fd0ff" stop-opacity=".55"/><stop offset=".94" stop-color="#5a8cff" stop-opacity=".12"/><stop offset="1" stop-color="#5a8cff" stop-opacity="0"/></radialGradient>
  <radialGradient id="lit" gradientUnits="userSpaceOnUse" cx="${lx}" cy="${ly}" r="${R * 1.9}"><stop offset=".3" stop-color="#fff"/><stop offset=".9" stop-color="#222"/></radialGradient>
  <linearGradient id="ringTone" gradientUnits="userSpaceOnUse" x1="${-R * 1.9}" y1="0" x2="${R * 1.9}" y2="0"><stop offset="0" stop-color="#f4f0ff"/><stop offset=".5" stop-color="#c9c2ff"/><stop offset="1" stop-color="#7d74c9"/></linearGradient>
  <radialGradient id="moon" cx=".32" cy=".28" r=".85"><stop offset="0" stop-color="#f3eeff"/><stop offset=".5" stop-color="#a99fe0"/><stop offset="1" stop-color="#3a2f7c"/></radialGradient>
  <radialGradient id="moonGlow"><stop offset=".55" stop-color="#8fe6ff" stop-opacity=".35"/><stop offset="1" stop-color="#5a8cff" stop-opacity="0"/></radialGradient>
  <radialGradient id="moonShade" cx=".3" cy=".26" r=".95"><stop offset=".45" stop-color="#04021a" stop-opacity="0"/><stop offset="1" stop-color="#04021a" stop-opacity=".85"/></radialGradient>
  <mask id="litMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="url(#lit)"/></mask>
  <clipPath id="disc"><circle cx="${C}" cy="${C}" r="${R}"/></clipPath>
  <clipPath id="back"><rect width="${S}" height="${C}"/></clipPath>
  <clipPath id="front"><rect y="${C}" width="${S}" height="${C}"/></clipPath>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter>
  <filter id="haze" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="shore" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7"/></filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter>
</defs>
${bg ? `<rect width="${S}" height="${S}" fill="url(#space)"/>
<circle cx="${C - 330}" cy="${C - 250}" r="230" fill="#5b3cf5" opacity=".22" filter="url(#glow)"/>
<circle cx="${C + 360}" cy="${C + 300}" r="260" fill="#1fb6ff" opacity=".14" filter="url(#glow)"/>
${stars}` : ''}
<g transform="translate(${C + R * 1.55} ${C - R * 1.2})">
  <circle r="${R * .22}" fill="url(#moonGlow)"/>
  <circle r="${R * .13}" fill="url(#moon)"/>
  <g fill="#3b2f7a" opacity=".35"><ellipse cx="${-R * .04}" cy="${-R * .03}" rx="${R * .028}" ry="${R * .022}"/><ellipse cx="${R * .045}" cy="${R * .02}" rx="${R * .02}" ry="${R * .016}"/><ellipse cx="${-R * .01}" cy="${R * .065}" rx="${R * .015}" ry="${R * .011}"/></g>
  <circle r="${R * .13}" fill="url(#moonShade)"/>
</g>
<use href="#ring" clip-path="url(#back)"/>
<circle cx="${C}" cy="${C}" r="${R * 1.14}" fill="url(#halo)" mask="url(#litMask)"/>
<g clip-path="url(#disc)">
  <circle cx="${C}" cy="${C}" r="${R}" fill="url(#ocean)"/>
  <path d="${word(1)}" fill="none" stroke="#6ff0ff" stroke-width="22" stroke-linejoin="round" opacity=".34" filter="url(#shore)"/>
  <path d="${word(1)}" fill="none" stroke="#9ff6ff" stroke-width="7" stroke-linejoin="round" opacity=".5" filter="url(#soft)"/>
  ${relief}
  <path d="${word(1 + RISE)}" fill="url(#land)"/>
  <path d="${cap}" fill="#eef8ff"/>
  <g fill="none" stroke="#fff" stroke-linecap="round">${clouds}</g>
  <circle cx="${C}" cy="${C}" r="${R}" fill="url(#shade)"/>
  <circle cx="${C}" cy="${C}" r="${R}" fill="url(#rim)" mask="url(#litMask)"/>
</g>
<use href="#ring" clip-path="url(#front)"/>
<defs>${ring}</defs>
</svg>`

for (const [name, bg] of [['logo', 1], ['logo-transparent', 0]]) {
  const s = svg(bg)
  writeFileSync(at(name + '.svg'), s)
  writeFileSync(at(name + '.png'), new Resvg(s, { fitTo: { mode: 'width', value: 2048 }, background: bg ? '#030210' : undefined }).render().asPng())
}
