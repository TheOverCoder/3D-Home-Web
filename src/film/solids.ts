import { CABIN, COUNTER, DESK, ISLAND, MARKET_WALKIN, SHELF_RUN } from '../data/market'
import type { ToolKind } from '../farm/data'
import type { Scene } from './format'
import { PEN, PEN_TOOL, TOOL_FOOT } from './set'

// What a film's people and animals cannot walk through, on each set: the market's walls and fittings (the game's own
// rows: src/data/market.ts), the pen's fence and gate, the tool by the gate and the hens' old nest box. A walk goes
// round them (`route`: the shortest way past their corners, kept a body's width off them), so a film names where
// someone goes and never how to get round a desk; ./checks.ts reports anyone who still ends up inside one. All on the
// ground, in metres; nothing here draws.

export interface Solid {
  name: string
  x0: number
  x1: number
  z0: number
  z1: number
}

/** How wide each body is, as a circle on the ground (m): a person, and each herd's animal. */
export const BODY_RADIUS = { person: 0.2, hens: 0.1, cows: 0.42, sheep: 0.28 } as const

const T = 0.08

/** The pen's fence as lines (the north one in two, the gate's gap between), the gate's leaf swung 75° in from its west
 *  post, the tool's place outside the fence by the gate's east post, and the old nest box (the hens' film). */
function penSolids(herd?: ToolKind): Solid[] {
  const out: Solid[] = [
    { name: 'the fence', x0: PEN.x0 - T, x1: PEN.gate.x0, z0: PEN.z0 - T, z1: PEN.z0 + T },
    { name: 'the fence', x0: PEN.gate.x1, x1: PEN.x1 + T, z0: PEN.z0 - T, z1: PEN.z0 + T },
    { name: 'the fence', x0: PEN.x0 - T, x1: PEN.x1 + T, z0: PEN.z1 - T, z1: PEN.z1 + T },
    { name: 'the fence', x0: PEN.x0 - T, x1: PEN.x0 + T, z0: PEN.z0 - T, z1: PEN.z1 + T },
    { name: 'the fence', x0: PEN.x1 - T, x1: PEN.x1 + T, z0: PEN.z0 - T, z1: PEN.z1 + T },
  ]
  // the gate's leaf, swung in (a box round it)
  const swing = (75 * Math.PI) / 180
  const ex = PEN.gate.x0 + Math.cos(swing) * 2 * 0.98
  const ez = PEN.z0 + Math.sin(swing) * 2 * 0.98
  out.push({ name: 'the gate', x0: Math.min(PEN.gate.x0, ex) - 0.06, x1: Math.max(PEN.gate.x0, ex) + 0.06, z0: PEN.z0, z1: ez })
  if (herd) {
    const f = TOOL_FOOT[herd]
    out.push({ name: 'the tool', x0: PEN_TOOL.x - f.half, x1: PEN_TOOL.x + f.half, z0: PEN_TOOL.z - f.deep, z1: PEN_TOOL.z + 0.02 })
  }
  return out
}

/** The market's walls (those on the ground: a lintel over a doorway is walked under) and its fittings. */
function marketSolids(): Solid[] {
  return [
    ...MARKET_WALKIN.walls.filter((b) => b.y0 < 1).map((b) => ({ name: 'a wall', x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 })),
    { name: 'the counter', ...COUNTER },
    { name: 'the shelves', ...SHELF_RUN },
    { name: 'the island', ...ISLAND },
    { name: 'the desk', ...DESK },
    { name: 'the cabin', ...CABIN },
  ].map(({ name, x0, x1, z0, z1 }) => ({ name, x0, x1, z0, z1 }))
}

const cache = new Map<string, Solid[]>()

/** The solids of a scene's place (the pen's with its herd's tool). */
export function solidsOf(place: Scene['place'], herd?: ToolKind): Solid[] {
  const key = `${place}|${herd ?? ''}`
  let s = cache.get(key)
  if (!s) cache.set(key, (s = place === 'pen' ? penSolids(herd) : marketSolids()))
  return s
}

// ───────────────────────────── the way round ─────────────────────────────

interface P {
  x: number
  z: number
}

/** How far a point is from a box (0 inside it). */
export const gap = (p: P, b: Solid) => Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1))

/** Whether the segment from a to b passes through a box grown by `r` (the slab test; touching is not passing). */
export function crosses(a: P, b: P, s: Solid, r: number) {
  let t0 = 0
  let t1 = 1
  for (const [p, q, lo, hi] of [
    [a.x, b.x, s.x0 - r, s.x1 + r],
    [a.z, b.z, s.z0 - r, s.z1 + r],
  ]) {
    const d = q - p
    if (Math.abs(d) < 1e-9) {
      if (p <= lo + 1e-6 || p >= hi - 1e-6) return false
      continue
    }
    let u0 = (lo - p) / d
    let u1 = (hi - p) / d
    if (u0 > u1) [u0, u1] = [u1, u0]
    t0 = Math.max(t0, u0)
    t1 = Math.min(t1, u1)
    if (t1 - t0 < 1e-6) return false
  }
  return true
}

const routes = new Map<string, P[]>()

/** The way from a to b for a body `r` wide round the solids: [b] when the straight way is clear, else the shortest way
 *  past their corners (each a body's width and a little off them). A solid either end stands in is no obstacle (one
 *  walks out of a doorway's box, a hen into her nest); a solid an end stands close to is kept only as far off as that
 *  end allows. No way round: straight (./checks.ts reports it). */
export function route(a: P, b: P, solids: Solid[], r: number): P[] {
  const key = `${a.x.toFixed(3)},${a.z.toFixed(3)}>${b.x.toFixed(3)},${b.z.toFixed(3)}|${r}|${solids.length}|${solids[0]?.x0 ?? 0}`
  const hit = routes.get(key)
  if (hit) return hit
  // each solid kept as far off as both ends allow (a little less than either end's own gap to it)
  const near = solids.flatMap((s) => {
    const room = Math.min(gap(a, s), gap(b, s))
    if (room <= 1e-3) return []
    return [{ s, r: Math.min(r, room - 2e-3) }]
  })
  const clear = (p: P, q: P) => near.every((n) => !crosses(p, q, n.s, n.r))
  let out: P[] = [b]
  if (!clear(a, b)) {
    // the corners a little outside each grown box, not inside another
    const nodes: P[] = [a, b]
    for (const n of near) {
      const m = n.r + 0.04
      for (const [x, z] of [
        [n.s.x0 - m, n.s.z0 - m],
        [n.s.x1 + m, n.s.z0 - m],
        [n.s.x0 - m, n.s.z1 + m],
        [n.s.x1 + m, n.s.z1 + m],
      ])
        if (near.every((o) => gap({ x, z }, o.s) > o.r)) nodes.push({ x, z })
    }
    // Dijkstra over the clear pairs
    const n = nodes.length
    const dist: number[] = Array.from({ length: n }, () => Infinity)
    const prev: number[] = Array.from({ length: n }, () => -1)
    const done: boolean[] = Array.from({ length: n }, () => false)
    dist[0] = 0
    for (;;) {
      let u = -1
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i
      if (u < 0 || u === 1) break
      done[u] = true
      for (let v = 0; v < n; v++) {
        if (done[v] || v === u) continue
        const d = dist[u] + Math.hypot(nodes[v].x - nodes[u].x, nodes[v].z - nodes[u].z)
        if (d < dist[v] && clear(nodes[u], nodes[v])) {
          dist[v] = d
          prev[v] = u
        }
      }
    }
    if (prev[1] >= 0) {
      out = []
      for (let v = 1; v > 0; v = prev[v]) out.unshift(nodes[v])
    }
  }
  routes.set(key, out)
  return out
}
