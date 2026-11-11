import type { RapierContext, RapierRigidBody } from '@react-three/rapier'
import { DOOR, insideHouse, roomAt } from '../../data/layout'
import { landBounds, ownedRects } from '../../farm/layout'
import { farm } from '../../farm/state'
import { useHome } from '../../store'
import { groundDistance, guideTo, inReach, interactable, type InteractableDef } from '../interaction'
import { lookedAt, turnTowards } from '../look'
import { playerState, type Point3 } from '../playerState'
import { toCells, withBlocked } from './grid'
import { Search, lineClear, nearestFree, pullString, type Field } from './path'
import { movingBlocked, physicsGrid, staticSignature, type Area, type PhysicsGrid } from './physics'
import { stopWalk, useWalk, walkHeading, walkStats, walkStick } from './walking'

// Walking by yourself to a mark tapped on the compass (src/lib/route): the way is found on a grid worked out from the
// physics world (physics.ts) with A* and the string pulled tight (path.ts), then walked with the stick — the same input
// the touch stick and walking on give the player, so the physics, the collisions, the steps and their sounds are the
// walk's own. Nothing moves you but the stick. It stops once the thing is within reach (the action button then offers
// it), turning the view to it; and as soon as you take over (src/scene/Player.tsx).

type World = RapierContext['world']
type Rapier = RapierContext['rapier']

const GOAL_IN = 0.3 // the way ends this far inside the thing's reach…
const ARRIVE_IN = 0.1 // …and you are there this far inside it
const PASSED = 0.35 // a turn of the way this near is behind you
const RUN_FROM = 8 // the way left this long: run (the stick's run)…
const WALK_UNDER = 5 // …and walk the last metres
const RUN_SPEED = 4.6 // the player's running speed (Player.tsx), metres a second
const LOOK_AHEAD = 1.6 // the view heads for the point of the way this far on
const PLAN_MS = [5, 12] // a frame spends this long finding the way at most: more on a slow frame, never a stall
const HELD_FOR = 1 // held up this long (and ten frames at least) — plan again once, then stop

interface Plan {
  search: Search
  field: Field
}
interface Route {
  pts: { x: number; z: number }[]
  /** the turn walked to now */
  next: number
  /** it only gets as near as it can (there is no way into reach) */
  partial: boolean
  /** at its end and not quite in reach: the last step goes straight at the thing */
  closing: boolean
  field: Field
}

/** The land the player can reach: the garden and the fields bought (src/farm/layout.ts). */
function landArea(): Area & { key: string } {
  const b = landBounds(farm.layout)
  const rs = ownedRects(farm.layout)
  return { ...b, key: `${b.minX},${b.maxX},${b.minZ},${b.maxZ}|${farm.layout.land.join(',')}`, on: (x, z) => rs.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) }
}

/** One walk at a time, for the player's body; `frame` runs every frame. */
export class Walker {
  private grid: PhysicsGrid | null = null
  private key = ''
  private seq = -1
  private plan: Plan | null = null
  private route: Route | null = null
  /** things that move, where they stood when they held you up */
  private moving: Set<number> | null = null
  private replans = 0
  private held = 0
  private heldFrames = 0
  private running = false
  private last: Point3 | null = null
  private limit = Infinity
  /** just arrived (first person): the view keeps turning to the thing while the body comes to rest */
  private settle: { def: InteractableDef; at: number } | null = null

  constructor(
    private readonly world: World,
    private readonly rapier: Rapier,
    private readonly body: () => RapierRigidBody | null | undefined,
  ) {}

  /** The grid as the world is now: made again when anything fixed changed (or the door, or the land). */
  private gridNow(): PhysicsGrid {
    const area = landArea()
    const shut = !useHome.getState().doors[DOOR.id]
    const key = `${area.key}|${staticSignature(this.world, shut)}`
    if (!this.grid || key !== this.key) {
      this.grid = physicsGrid(this.world, this.rapier, area, shut)
      this.key = key
      walkStats.grids++
    }
    return this.grid
  }

  private reset() {
    this.plan = null
    this.route = null
    this.moving = null
    this.replans = 0
    this.held = 0
    this.heldFrames = 0
    this.running = false
    this.last = null
    this.limit = Infinity
    walkStick.on = false
    walkHeading.yaw = null
  }

  /**
   * One frame of walking to the mark: sets `walkStick` (where to push the stick, in the frame of `forward`, the view's
   * direction on the ground) and `walkHeading`. `speed` is how fast the body moves now, `firstPerson` whether the view
   * turns to the thing on arrival.
   */
  frame(dt: number, pos: Point3, speed: number, forward: { x: number; z: number }, firstPerson: boolean) {
    const w = useWalk.getState()
    if (!w.id) {
      if (this.seq !== -1) {
        this.reset()
        this.seq = -1
      }
      // arrived: the body slows to a stop over a step or so (more on a slow page); the view stays on the thing meanwhile,
      // unless you look round yourself
      const s = this.settle
      if (s && firstPerson && speed > 0.15 && performance.now() - s.at < 1500 && lookedAt.time < s.at) {
        turnTowards({ x: pos.x, y: playerState.eye.y, z: pos.z }, s.def.aim ?? s.def.position)
      } else this.settle = null
      return
    }
    this.settle = null
    if (w.seq !== this.seq) {
      this.reset()
      this.seq = w.seq
      Object.assign(walkStats, { seconds: 0, walked: 0, frames: 0, longestStep: 0, fastestTurn: 0, replans: 0, planMs: 0, planFrames: 0, slowestFrameMs: 0, expanded: 0 })
    }
    const def = interactable(w.id)
    if (!def) return this.end('gone')
    // the walk so far (a jump of more than a few metres in a frame is not walking: something put you elsewhere)
    if (this.last) {
      const step = Math.hypot(pos.x - this.last.x, pos.z - this.last.z)
      if (step > 3) return this.end('moved')
      walkStats.walked += step
      walkStats.longestStep = Math.max(walkStats.longestStep, step)
    }
    this.last = { ...pos }
    walkStats.seconds += Math.min(dt, 0.5)
    walkStats.frames++
    // there: the action button offers it
    if (inReach(def, pos, ARRIVE_IN)) return this.end('arrived', def, pos, firstPerson)
    if (walkStats.seconds > this.limit) return this.end('slow')
    if (!this.route) {
      if (!this.plan && !this.begin(def, pos)) return this.end('no-way', def, pos, firstPerson)
      if (!this.think(dt)) return
      if (!this.finish(def, pos, firstPerson)) return
    }
    this.follow(dt, def, pos, speed, forward)
  }

  /** Starts finding the way from where you stand to anywhere within reach of the thing (false: you stand nowhere free). */
  private begin(def: InteractableDef, pos: Point3): boolean {
    const g = this.gridNow()
    const field = this.moving ? withBlocked(g, this.moving) : g
    const [cx, cz] = toCells(g, pos.x, pos.z)
    // where you stand, or the nearest free cell (the body may be brushing a wall)
    const start = nearestFree(field, cx, cz, 4)
    if (start < 0) return false
    const reach = def.radius - GOAL_IN
    const out = !insideHouse(def.position.x, def.position.z)
    const room = out ? null : roomAt(def.position.x, def.position.z)
    const { x0, z0, cell, w } = g
    const far = (k: number) => {
      const i = k % w
      return groundDistance(x0 + (i + 0.5) * cell, z0 + ((k - i) / w + 0.5) * cell, def.position, def.box)
    }
    const goal = (k: number) => {
      if (far(k) > reach) return false
      const i = k % w
      const x = x0 + (i + 0.5) * cell
      const z = z0 + ((k - i) / w + 0.5) * cell
      // in the thing's own space: outdoors for a thing outdoors, its room for one indoors
      return out ? !insideHouse(x, z) : roomAt(x, z) === room
    }
    this.plan = { search: new Search(field, start, goal, (k) => Math.max(0, far(k) - reach) / cell), field }
    return true
  }

  /** Works on the way for a few milliseconds; true once it is found (or found not to be there). */
  private think(dt: number): boolean {
    const plan = this.plan!
    const budget = Math.min(PLAN_MS[1], Math.max(PLAN_MS[0], dt * 1000 * 0.15))
    const t0 = performance.now()
    const before = plan.search.expanded
    while (plan.search.status === 'running' && performance.now() - t0 < budget) plan.search.step(16)
    const ms = performance.now() - t0
    walkStats.planMs += ms
    walkStats.planFrames++
    walkStats.slowestFrameMs = Math.max(walkStats.slowestFrameMs, ms)
    walkStats.expanded += plan.search.expanded - before
    const g = this.grid!
    Object.assign(walkStats, { probes: g.probed, capsules: g.stats.capsules, blocks: g.stats.blocks, probeMs: g.stats.ms })
    return plan.search.status !== 'running'
  }

  /** The way found: the string pulled tight along it, from where you stand. */
  private finish(def: InteractableDef, pos: Point3, firstPerson: boolean): boolean {
    const { search, field } = this.plan!
    const g = this.grid!
    this.plan = null
    const cells = pullString(field, search.path())
    const pts = cells.map((k) => {
      const i = k % g.w
      return { x: g.x0 + (i + 0.5) * g.cell, z: g.z0 + ((k - i) / g.w + 0.5) * g.cell }
    })
    if (search.status === 'none') {
      // no way into reach: as near as it gets, if that is nearer than here
      const end = pts[pts.length - 1]
      if (!end || groundDistance(end.x, end.z, def.position, def.box) > groundDistance(pos.x, pos.z, def.position, def.box) - 0.5) {
        this.end('no-way', def, pos, firstPerson)
        return false
      }
    }
    pts[0] = { x: pos.x, z: pos.z }
    if (pts.length < 2) pts.push(pts[0])
    let length = 0
    for (let k = 1; k < pts.length; k++) length += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z)
    walkStats.length = length
    walkStats.turns = pts.length - 2
    // a walk that takes far longer than the way at a walk is not getting there
    this.limit = walkStats.seconds + 20 + (3 * length) / 2.3
    this.route = { pts, next: 1, partial: search.status === 'none', closing: false, field }
    return true
  }

  private follow(dt: number, def: InteractableDef, pos: Point3, speed: number, forward: { x: number; z: number }) {
    const r = this.route!
    const g = this.grid!
    const pts = r.pts
    const last = pts.length - 1
    // the thing moved off (an animal wandering in its pen): its reach is no longer where the way ends — find it again
    const end = pts[last]
    if (!r.partial && groundDistance(end.x, end.z, def.position, def.box) > def.radius - ARRIVE_IN) {
      this.route = null
      return
    }
    // the farthest of the next few turns in plain sight is the one to head for (after a slow frame carried you past
    // one, or round a corner wider than the way)
    const [px, pz] = toCells(g, pos.x, pos.z)
    for (let k = Math.min(last, r.next + 3); k > r.next; k--) {
      const [qx, qz] = toCells(g, pts[k].x, pts[k].z)
      if (lineClear(r.field, px, pz, qx, qz, true)) {
        r.next = k
        break
      }
    }
    // a turn reached, or gone past, is behind you
    while (r.next < last) {
      const a = pts[r.next - 1]
      const b = pts[r.next]
      const sx = b.x - a.x
      const sz = b.z - a.z
      const along = ((pos.x - a.x) * sx + (pos.z - a.z) * sz) / (sx * sx + sz * sz || 1)
      if (Math.hypot(b.x - pos.x, b.z - pos.z) < PASSED || along >= 1) r.next++
      else break
    }
    const to = pts[r.next]
    const dx = to.x - pos.x
    const dz = to.z - pos.z
    const dist = Math.hypot(dx, dz)
    if (r.next === last && dist < PASSED) {
      // the end of the way and not in reach: as near as it gets; or the last few centimetres, straight at the thing
      if (r.partial || r.closing) return this.end('no-way', def, pos)
      r.closing = true
      pts.push({ x: def.position.x, z: def.position.z })
      return
    }
    // run while the way is long, walk the last metres, and round a sharp turn close ahead; a slow frame carries you a
    // long step, never past the next turn
    let rest = dist
    for (let k = r.next; k < last; k++) rest += Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].z - pts[k].z)
    if (rest > RUN_FROM) this.running = true
    else if (rest < WALK_UNDER) this.running = false
    let run = this.running
    if (run && r.next < last) {
      const n = pts[r.next + 1]
      const bend = Math.abs(Math.atan2(Math.sin(Math.atan2(n.x - to.x, n.z - to.z) - Math.atan2(dx, dz)), Math.cos(Math.atan2(n.x - to.x, n.z - to.z) - Math.atan2(dx, dz))))
      if ((dist < 1.8 && bend > 0.8) || RUN_SPEED * Math.min(dt, 0.5) > 0.7 * dist) run = false
    }
    // the stick, in the view's frame: x to the right of where it looks, y ahead
    const ux = dx / (dist || 1)
    const uz = dz / (dist || 1)
    walkStick.on = true
    walkStick.x = ux * -forward.z + uz * forward.x
    walkStick.y = ux * forward.x + uz * forward.z
    walkStick.run = run
    // the view heads for a point a little further along the way, so it turns before a corner, not at it
    let left = LOOK_AHEAD
    let from = { x: pos.x, z: pos.z }
    let ahead = to
    for (let k = r.next; k <= last; k++) {
      const d = Math.hypot(pts[k].x - from.x, pts[k].z - from.z)
      ahead = pts[k]
      if (d >= left) {
        ahead = { x: from.x + ((pts[k].x - from.x) * left) / d, z: from.z + ((pts[k].z - from.z) * left) / d }
        break
      }
      left -= d
      from = pts[k]
    }
    if (Math.hypot(ahead.x - pos.x, ahead.z - pos.z) > 0.2) walkHeading.yaw = Math.atan2(-(ahead.x - pos.x), -(ahead.z - pos.z))
    // held up (an animal in the way): plan again once round what moves, as it stands now; then stop, as walking on
    // stops at a wall — after a second, and ten frames at least (a page drawing a frame or two a second spends its
    // first second getting going)
    const held = speed < 0.3
    this.held = held ? this.held + dt : 0
    this.heldFrames = held ? this.heldFrames + 1 : 0
    if (this.held > HELD_FOR && this.heldFrames > 10) {
      if (this.replans >= 1) return this.end('blocked')
      this.replans++
      walkStats.replans++
      this.moving = movingBlocked(this.world, this.rapier, g, pos.x, pos.z, 4, this.body())
      this.route = null
      this.held = 0
      this.heldFrames = 0
      walkStick.on = false
    }
  }

  /** For the tests and ?debug: the way from `from` to a thing, found at once (no walking), with what it cost; `fresh`
   *  on a grid made anew (every cell it asks about worked out then). */
  planNow(id: string, from: { x: number; z: number } = playerState.position, fresh = false) {
    const def = interactable(id)
    if (!def) return null
    if (fresh) this.grid = null
    const t0 = performance.now()
    const before = { probes: this.gridNow().probed, ms: this.grid!.stats.ms }
    const saved = { plan: this.plan, moving: this.moving }
    this.moving = null
    const t1 = performance.now()
    if (!this.begin(def, { x: from.x, y: 0, z: from.z })) return null
    const { search, field } = this.plan!
    search.step()
    const t2 = performance.now()
    const g = this.grid!
    const pts = pullString(field, search.path()).map((k) => {
      const i = k % g.w
      return { x: g.x0 + (i + 0.5) * g.cell, z: g.z0 + ((k - i) / g.w + 0.5) * g.cell }
    })
    this.plan = saved.plan
    this.moving = saved.moving
    return {
      found: search.status === 'found',
      pts,
      expanded: search.expanded,
      probes: g.probed - before.probes,
      probeMs: g.stats.ms - before.ms,
      searchMs: t2 - t1,
      pullMs: performance.now() - t2,
      gridMs: t1 - t0,
    }
  }

  /** For measuring: drops the grid, so the next way found works out its cells afresh. */
  forget() {
    this.grid = null
  }

  /** For measuring: a fresh grid over the whole land, every cell worked out at once, and what it took. */
  measureGrid() {
    this.grid = null
    const t0 = performance.now()
    const g = this.gridNow()
    const sig = performance.now() - t0
    const t1 = performance.now()
    let free = 0
    for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.free(i, j)) free++
    return { w: g.w, h: g.h, cells: g.w * g.h, free, signatureMs: sig, ms: performance.now() - t1, probeMs: g.stats.ms, blocks: g.stats.blocks, empty: g.stats.empty, capsules: g.stats.capsules }
  }

  /** The walk is over: there (in first person the view turns to the thing), or there is no way to it (it turns you
   *  to it and marks it, as a mark tapped always did), or something else stopped it. */
  private end(why: string, def?: InteractableDef, pos?: Point3, firstPerson = false) {
    if (def && why === 'no-way') guideTo(def.id)
    else if (def && pos && why === 'arrived' && firstPerson) {
      turnTowards({ x: pos.x, y: playerState.eye.y, z: pos.z }, def.aim ?? def.position)
      this.settle = { def, at: performance.now() }
    }
    stopWalk(why)
    this.reset()
  }
}
