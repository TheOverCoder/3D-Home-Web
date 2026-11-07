import { create } from 'zustand'
import { farmSound, placeSound } from '../audio/sound'
import { useHome } from '../store'
import {
  BEDS,
  COW,
  CROPS,
  EGG,
  EXPANSIONS,
  GATE_SPOT,
  LANE_ENDS,
  LANE_Z,
  LEMON_TREE,
  MILL,
  MILLABLE,
  NAMES,
  PRODUCE,
  RECIPES,
  START_COINS,
  UPGRADES,
  VISITOR,
  WATER_SHARE,
  count,
  cropById,
  produceById,
  recipeById,
  type CakeId,
  type CropId,
  type Expansion,
  type MillInput,
  type MillOutput,
  type ProduceId,
  type UpgradeId,
} from './data'

// The farm runs on a plain object that the scene reads every frame (growth, water, people walking), so nothing
// re-renders 60 times a second. Anything the interface shows changes in steps — planted, thirsty, ripe, sold —
// and each step bumps `useFarm`'s revision so the panels and the HUD redraw.

export interface BedState {
  built: boolean
  crop: CropId | null
  growth: number // seconds grown so far
  water: number // seconds of water left in the soil
}

export interface Look {
  shirt: string
  trousers: string
  skin: string
  hair: string
  hairStyle: 0 | 1 | 2 // short, long, bun
  hat: boolean
  height: number
}

export interface Visitor {
  id: number
  name: string
  look: Look
  want: ProduceId
  qty: number
  offer: number
  phase: 'arriving' | 'waiting' | 'leaving'
  path: { x: number; z: number }[]
  leg: number
  x: number
  z: number
  heading: number
  moving: boolean
  waited: number
  mood: 'neutral' | 'happy' | 'sad'
  moodAt: number // farm clock when the mood changed (the scene plays a little reaction)
}

export interface MillState {
  input: MillInput | null // what is being milled right now
  count: number
  progress: number // seconds
  output: MillOutput | null // what is waiting to be collected
  ready: number
}

export interface OvenState {
  baking: CakeId | null
  progress: number // seconds
  ready: CakeId | null
}

export interface FarmData {
  coins: number
  inv: Record<ProduceId, number>
  beds: BedState[]
  lemons: number
  lemonTimer: number
  eggs: number
  eggTimer: number
  hens: number
  cows: number
  milk: number[] // bottles waiting at each cow
  milkTimer: number[]
  mill: MillState
  oven: OvenState
  sprinkler: boolean
  compost: boolean
  expansions: Record<Expansion, boolean>
  started: boolean // the player has planted something: from then on buyers come by
  planted: CropId[] // kinds ever planted: buyers ask for what you grow
  made: ProduceId[] // everything the farm has ever produced: buyers ask for that too
  stats: { harvested: number; sold: number; earned: number; declined: number; baked: number }
  visitors: Visitor[]
  nextVisitorIn: number
  clock: number // seconds of farm time since the page opened
}

const KEY = '3d-home:farm:v1'
const produceIds = PRODUCE.map((p) => p.id)
const emptyInv = () => Object.fromEntries(produceIds.map((id) => [id, 0])) as Record<ProduceId, number>
const freshMill = (): MillState => ({ input: null, count: 0, progress: 0, output: null, ready: 0 })
const freshOven = (): OvenState => ({ baking: null, progress: 0, ready: null })

function fresh(): FarmData {
  return {
    coins: START_COINS,
    inv: emptyInv(),
    beds: BEDS.map((b) => ({ built: b.price === 0 && !b.expansion, crop: null, growth: 0, water: 0 })),
    lemons: 3,
    lemonTimer: 0,
    eggs: 1,
    eggTimer: 0,
    hens: EGG.startHens,
    cows: COW.startCows,
    milk: Array.from({ length: COW.startCows }, () => 1),
    milkTimer: Array.from({ length: COW.startCows }, () => 0),
    mill: freshMill(),
    oven: freshOven(),
    sprinkler: false,
    compost: false,
    expansions: { east: false, west: false },
    started: false,
    planted: [],
    made: [],
    stats: { harvested: 0, sold: 0, earned: 0, declined: 0, baked: 0 },
    visitors: [],
    nextVisitorIn: VISITOR.firstAfter,
    clock: 0,
  }
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const int = (v: unknown, d: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(num(v, d))))
const isProduce = (v: unknown): v is ProduceId => produceIds.includes(v as ProduceId)

/** The saved farm, made safe (a hand-edited or old save can never break the game), plus the time it was saved. */
function load(): { data: FarmData; savedAt: number | null } {
  const data = fresh()
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<FarmData> & { time?: number }
    if (!raw || typeof raw !== 'object') return { data, savedAt: null }
    data.coins = Math.max(0, Math.round(num(raw.coins, START_COINS)))
    for (const id of produceIds) data.inv[id] = Math.max(0, Math.round(num(raw.inv?.[id], 0)))
    data.expansions = { east: !!raw.expansions?.east, west: !!raw.expansions?.west }
    raw.beds?.forEach((b, i) => {
      const def = BEDS[i]
      if (!data.beds[i] || !b || !def) return
      const present = !def.expansion || data.expansions[def.expansion]
      data.beds[i] = {
        built: present && (data.beds[i].built || !!b.built || !!def.expansion),
        crop: present && CROPS.some((c) => c.id === b.crop) ? (b.crop as CropId) : null,
        growth: Math.max(0, num(b.growth, 0)),
        water: Math.max(0, num(b.water, 0)),
      }
    })
    BEDS.forEach((def, i) => {
      if (def.expansion && data.expansions[def.expansion]) data.beds[i].built = true
    })
    data.lemons = int(raw.lemons, 3, 0, LEMON_TREE.max)
    data.lemonTimer = Math.max(0, num(raw.lemonTimer, 0))
    data.eggs = int(raw.eggs, 1, 0, EGG.max)
    data.eggTimer = Math.max(0, num(raw.eggTimer, 0))
    data.hens = int(raw.hens, EGG.startHens, EGG.startHens, EGG.maxHens)
    data.cows = int(raw.cows, COW.startCows, COW.startCows, COW.maxCows)
    data.milk = Array.from({ length: data.cows }, (_, i) => int(raw.milk?.[i], 1, 0, COW.max))
    data.milkTimer = Array.from({ length: data.cows }, (_, i) => Math.max(0, num(raw.milkTimer?.[i], 0)))
    const mill = raw.mill
    if (mill && typeof mill === 'object') {
      const input = mill.input && mill.input in MILLABLE ? mill.input : null
      const output = mill.output === 'sugar' || mill.output === 'flour' ? mill.output : null
      data.mill = {
        input,
        count: input ? int(mill.count, 0, 0, MILL.capacity) : 0,
        progress: input ? Math.max(0, num(mill.progress, 0)) : 0,
        output,
        ready: output ? int(mill.ready, 0, 0, MILL.capacity) : 0,
      }
    }
    const oven = raw.oven
    if (oven && typeof oven === 'object') {
      const valid = (v: unknown) => (RECIPES.some((r) => r.id === v) ? (v as CakeId) : null)
      data.oven = { baking: valid(oven.baking), progress: valid(oven.baking) ? Math.max(0, num(oven.progress, 0)) : 0, ready: valid(oven.ready) }
    }
    data.sprinkler = !!raw.sprinkler
    data.compost = !!raw.compost
    data.started = !!raw.started
    data.planted = Array.isArray(raw.planted) ? raw.planted.filter((c): c is CropId => CROPS.some((d) => d.id === c)) : []
    data.made = Array.isArray(raw.made) ? raw.made.filter(isProduce) : []
    data.stats = { ...data.stats, ...(raw.stats ?? {}) }
    return { data, savedAt: num(raw.time, 0) || null }
  } catch {
    return { data, savedAt: null }
  }
}

const loaded = load()
export const farm: FarmData = loaded.data

/** Revision counter: bumped whenever something the interface shows has changed. */
export const useFarm = create<{ rev: number }>(() => ({ rev: 0 }))
const bump = () => useFarm.setState((s) => ({ rev: s.rev + 1 }))

let saveTimer: number | undefined
function saveNow() {
  window.clearTimeout(saveTimer)
  saveTimer = undefined
  try {
    const { visitors: _v, nextVisitorIn: _n, clock: _c, ...rest } = farm
    localStorage.setItem(KEY, JSON.stringify({ ...rest, time: Date.now() }))
  } catch {
    /* storage full or blocked: the farm still works for this visit */
  }
}
const save = () => {
  if (saveTimer === undefined) saveTimer = window.setTimeout(saveNow, 1200)
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', saveNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow()
  })
}

const toast = (text: string) => useHome.getState().showToast(text)
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const remember = (id: ProduceId) => {
  if (!farm.made.includes(id)) farm.made.push(id)
}
const gain = (id: ProduceId, n: number) => {
  farm.inv[id] += n
  remember(id)
}

// ───────────────────────────── beds ─────────────────────────────

export type BedStage = 'unbought' | 'locked' | 'empty' | 'thirsty' | 'growing' | 'ripe'

export function bedStage(i: number): BedStage {
  const b = farm.beds[i]
  const def = BEDS[i]
  if (def.expansion && !farm.expansions[def.expansion]) return 'unbought'
  if (!b.built) return 'locked'
  if (!b.crop) return 'empty'
  if (b.growth >= cropById(b.crop).growSeconds) return 'ripe'
  if (!farm.sprinkler && b.water <= 0) return 'thirsty'
  return 'growing'
}

/** 0 … 1 */
export const bedProgress = (i: number) => {
  const b = farm.beds[i]
  return b.crop ? Math.min(1, b.growth / cropById(b.crop).growSeconds) : 0
}

export const yieldOf = (crop: CropId) => Math.round(cropById(crop).yield * (farm.compost ? 1.5 : 1))

const fullWater = (crop: CropId) => cropById(crop).growSeconds * WATER_SHARE

export function plant(i: number, crop: CropId) {
  const b = farm.beds[i]
  const def = cropById(crop)
  if (!b?.built || b.crop || farm.coins < def.seedCost) return false
  farm.coins -= def.seedCost
  b.crop = crop
  b.growth = 0
  b.water = fullWater(crop) // seeds go in with a good soak
  farm.started = true
  if (!farm.planted.includes(crop)) farm.planted.push(crop)
  bump()
  save()
  return true
}

export function water(i: number) {
  const b = farm.beds[i]
  if (!b?.crop) return false
  b.water = fullWater(b.crop)
  bump()
  save()
  return true
}

export function harvest(i: number) {
  const b = farm.beds[i]
  if (!b?.crop || bedStage(i) !== 'ripe') return 0
  const n = yieldOf(b.crop)
  gain(b.crop, n)
  farm.stats.harvested += n
  const crop = b.crop
  b.crop = null
  b.growth = 0
  b.water = 0
  toast(`+ ${count(crop, n)}`)
  bump()
  save()
  return n
}

export function buildBed(i: number) {
  const b = farm.beds[i]
  const price = BEDS[i]?.price ?? 0
  if (!b || b.built || BEDS[i]?.expansion || farm.coins < price) return false
  farm.coins -= price
  b.built = true
  toast('A new bed, ready for seeds')
  bump()
  save()
  return true
}

// ───────────────────────────── tree, hens, cows ─────────────────────────────

export function pickLemons() {
  const n = farm.lemons
  if (!n) return 0
  farm.lemons = 0
  farm.lemonTimer = 0
  gain('lemon', n)
  farm.stats.harvested += n
  toast(`+ ${count('lemon', n)}`)
  bump()
  save()
  return n
}

export function collectEggs() {
  const n = farm.eggs
  if (!n) return 0
  farm.eggs = 0
  gain('egg', n)
  farm.stats.harvested += n
  toast(`+ ${count('egg', n)}`)
  bump()
  save()
  return n
}

export const cowName = (i: number) => COW.names[i % COW.names.length]

export function milkCow(i: number) {
  const n = farm.milk[i] ?? 0
  if (!n) return 0
  farm.milk[i] = 0
  farm.milkTimer[i] = 0
  gain('milk', n)
  farm.stats.harvested += n
  toast(`+ ${count('milk', n)} from ${cowName(i)}`)
  bump()
  save()
  return n
}

// ───────────────────────────── mill and oven ─────────────────────────────

export type MillStage = 'idle' | 'working' | 'done'
export const millStage = (): MillStage => (farm.mill.input ? 'working' : farm.mill.ready > 0 ? 'done' : 'idle')
export const millSecondsLeft = () => (farm.mill.input ? farm.mill.count * MILL.perItem - farm.mill.progress : 0)

/** Loads the mill with as much of `input` as it takes. */
export function millLoad(input: MillInput) {
  if (millStage() !== 'idle') return 0
  const n = Math.min(MILL.capacity, farm.inv[input])
  if (!n) return 0
  farm.inv[input] -= n
  farm.mill = { input, count: n, progress: 0, output: null, ready: 0 }
  bump()
  save()
  return n
}

export function millCollect() {
  const { output, ready } = farm.mill
  if (!output || !ready) return 0
  gain(output, ready)
  farm.mill = freshMill()
  toast(`+ ${count(output, ready)}`)
  bump()
  save()
  return ready
}

export type OvenStage = 'idle' | 'baking' | 'done'
export const ovenStage = (): OvenStage => (farm.oven.baking ? 'baking' : farm.oven.ready ? 'done' : 'idle')
export const ovenSecondsLeft = () => (farm.oven.baking ? recipeById(farm.oven.baking).seconds - farm.oven.progress : 0)
export const canBake = (id: CakeId) =>
  Object.entries(recipeById(id).needs).every(([k, n]) => farm.inv[k as ProduceId] >= (n ?? 0))

export function bake(id: CakeId) {
  if (ovenStage() !== 'idle' || !canBake(id)) return false
  for (const [k, n] of Object.entries(recipeById(id).needs)) farm.inv[k as ProduceId] -= n ?? 0
  farm.oven = { baking: id, progress: 0, ready: null }
  bump()
  save()
  return true
}

export function takeOut() {
  const id = farm.oven.ready
  if (!id) return null
  gain(id, 1)
  farm.stats.baked += 1
  farm.oven = freshOven()
  toast(`A ${produceById(id).name}, fresh from the oven`)
  bump()
  save()
  return id
}

// ───────────────────────────── the shop ─────────────────────────────

export function owned(u: UpgradeId) {
  switch (u) {
    case 'sprinkler':
      return farm.sprinkler
    case 'compost':
      return farm.compost
    case 'hen':
      return farm.hens >= EGG.maxHens
    case 'cow':
      return farm.cows >= COW.maxCows
    default:
      return farm.expansions[u]
  }
}

export function buy(id: UpgradeId) {
  const u = UPGRADES.find((x) => x.id === id)
  if (!u || owned(id) || farm.coins < u.price) return false
  farm.coins -= u.price
  if (id === 'sprinkler') farm.sprinkler = true
  else if (id === 'compost') farm.compost = true
  else if (id === 'hen') farm.hens = Math.min(EGG.maxHens, farm.hens + 1)
  else if (id === 'cow') {
    farm.cows = Math.min(COW.maxCows, farm.cows + 1)
    farm.milk.push(0)
    farm.milkTimer.push(0)
  } else {
    farm.expansions[id] = true
    BEDS.forEach((def, i) => {
      if (def.expansion === id) farm.beds[i].built = true
    })
  }
  toast(id === 'east' || id === 'west' ? `${EXPANSIONS[id].name}: the beds are in` : id === 'cow' ? `${cowName(farm.cows - 1)} joins the herd` : `${u.name}: done`)
  bump()
  save()
  return true
}

// ───────────────────────────── buyers ─────────────────────────────

const SHIRTS = ['#c9573f', '#3f6fa3', '#5c8a4a', '#d9a441', '#7b5aa6', '#2f8f8a', '#e07a5f', '#4d5d73', '#b23a48', '#f2cc8f']
const TROUSERS = ['#2b3038', '#3d4a5c', '#5a4636', '#1f2a24', '#6b6255', '#283044']
const SKINS = ['#f1c7a5', '#e0ac87', '#c68863', '#9a6646', '#704a32', '#f6d5bd']
const HAIRS = ['#2b2017', '#5a3a22', '#a8743f', '#d9b98a', '#1c1c1c', '#7b4b2a', '#b9b2a8']

let visitorSeq = 0

/** What a buyer asks for: mostly something you have, sometimes something your farm makes but has run out of. */
function chooseRequest(): { want: ProduceId; qty: number } {
  const stocked = produceIds.filter((id) => farm.inv[id] > 0)
  const known = [...new Set<ProduceId>([...farm.planted, ...farm.made, 'lemon', 'egg', 'milk'])]
  const fromStock = stocked.length > 0 && Math.random() < 0.72
  const want = fromStock ? pick(stocked) : pick(known)
  const def = produceById(want)
  const have = farm.inv[want]
  const qty = have > 0 && fromStock ? Math.max(1, Math.min(def.maxAsk, Math.round(have * rand(0.45, 1.15)))) : Math.round(rand(Math.min(2, def.maxAsk), def.maxAsk))
  return { want, qty: Math.max(1, qty) }
}

/** Mostly fair, now and then generous, sometimes cheeky: worth a look before saying yes. */
function priceFor(want: ProduceId, qty: number) {
  const r = Math.random()
  const factor = r < 0.15 ? 0.6 : r < 0.38 ? 0.85 : r < 0.66 ? 1 : r < 0.86 ? 1.25 : 1.6
  return Math.max(1, Math.round(produceById(want).price * qty * factor))
}

export const fairPrice = (want: ProduceId, qty: number) => produceById(want).price * qty

export function spawnVisitor(opts: Partial<Pick<Visitor, 'want' | 'qty' | 'offer'>> & { from?: -1 | 1 } = {}) {
  const from = opts.from ?? (Math.random() < 0.5 ? -1 : 1)
  const request = opts.want ? { want: opts.want, qty: opts.qty ?? 2 } : chooseRequest()
  const startX = LANE_ENDS[from < 0 ? 0 : 1]
  const v: Visitor = {
    id: ++visitorSeq,
    name: pick(NAMES),
    look: {
      shirt: pick(SHIRTS),
      trousers: pick(TROUSERS),
      skin: pick(SKINS),
      hair: pick(HAIRS),
      hairStyle: pick([0, 1, 2] as const),
      hat: Math.random() < 0.3,
      height: rand(0.94, 1.05),
    },
    want: request.want,
    qty: request.qty,
    offer: opts.offer ?? priceFor(request.want, request.qty),
    phase: 'arriving',
    path: [
      { x: startX, z: LANE_Z + rand(-0.3, 0.3) },
      { x: GATE_SPOT.x + from * 0.6, z: LANE_Z },
      { x: GATE_SPOT.x, z: GATE_SPOT.z },
    ],
    leg: 1,
    x: startX,
    z: LANE_Z,
    heading: from < 0 ? Math.PI / 2 : -Math.PI / 2,
    moving: true,
    waited: 0,
    mood: 'neutral',
    moodAt: farm.clock,
  }
  farm.visitors.push(v)
  bump()
  return v
}

function leave(v: Visitor, mood: Visitor['mood']) {
  v.phase = 'leaving'
  v.mood = mood
  v.moodAt = farm.clock
  const exit = Math.random() < 0.5 ? -1 : 1
  v.path = [
    { x: v.x, z: v.z },
    { x: GATE_SPOT.x + exit * 0.6, z: LANE_Z },
    { x: LANE_ENDS[exit < 0 ? 0 : 1], z: LANE_Z + rand(-0.3, 0.3) },
  ]
  v.leg = 1
  v.moving = true
  const panel = useHome.getState().panel
  if (panel?.kind === 'offer' && panel.visitor === v.id) useHome.getState().closePanel()
  bump()
}

export const visitorById = (id: number) => farm.visitors.find((v) => v.id === id)

export function acceptOffer(id: number) {
  const v = visitorById(id)
  if (!v || v.phase !== 'waiting' || farm.inv[v.want] < v.qty) return false
  farm.inv[v.want] -= v.qty
  farm.coins += v.offer
  farm.stats.sold += v.qty
  farm.stats.earned += v.offer
  toast(`Sold ${count(v.want, v.qty)} · + ${v.offer} coins`)
  farmSound('coins')
  leave(v, 'happy')
  save()
  return true
}

export function declineOffer(id: number) {
  const v = visitorById(id)
  if (!v || v.phase !== 'waiting') return false
  farm.stats.declined += 1
  farmSound('decline')
  leave(v, 'sad')
  save()
  return true
}

// ───────────────────────────── time ─────────────────────────────

const stageKey = () =>
  farm.beds.map((_, i) => bedStage(i)).join() + `|${farm.lemons}|${farm.eggs}|${farm.milk.join(',')}|${millStage()}|${ovenStage()}`

function grow(dt: number) {
  for (const b of farm.beds) {
    if (!b.crop) continue
    const def = cropById(b.crop)
    if (b.growth >= def.growSeconds) continue
    // growth stops while the soil is dry; with sprinklers it never is
    const wet = farm.sprinkler ? dt : Math.min(dt, b.water)
    b.growth = Math.min(def.growSeconds, b.growth + wet)
    if (!farm.sprinkler) b.water = Math.max(0, b.water - dt)
  }
  farm.lemonTimer += dt
  while (farm.lemonTimer >= LEMON_TREE.every) {
    farm.lemonTimer -= LEMON_TREE.every
    if (farm.lemons < LEMON_TREE.max) farm.lemons++
  }
  farm.eggTimer += dt * farm.hens
  while (farm.eggTimer >= EGG.every) {
    farm.eggTimer -= EGG.every
    if (farm.eggs < EGG.max) farm.eggs++
  }
  for (let i = 0; i < farm.cows; i++) {
    farm.milkTimer[i] = (farm.milkTimer[i] ?? 0) + dt
    while (farm.milkTimer[i] >= COW.every) {
      farm.milkTimer[i] -= COW.every
      if ((farm.milk[i] ?? 0) < COW.max) farm.milk[i] = (farm.milk[i] ?? 0) + 1
    }
  }
  const m = farm.mill
  if (m.input) {
    m.progress += dt
    if (m.progress >= m.count * MILL.perItem) farm.mill = { input: null, count: 0, progress: 0, output: MILLABLE[m.input], ready: m.count }
  }
  const o = farm.oven
  if (o.baking) {
    o.progress += dt
    if (o.progress >= recipeById(o.baking).seconds) farm.oven = { baking: null, progress: 0, ready: o.baking }
  }
}

function walk(v: Visitor, dt: number) {
  const target = v.path[v.leg]
  if (!target) {
    v.moving = false
    return true
  }
  const dx = target.x - v.x
  const dz = target.z - v.z
  const d = Math.hypot(dx, dz)
  const step = VISITOR.speed * dt
  v.moving = true
  if (d > 1e-3) {
    const want = Math.atan2(dx, dz)
    const diff = Math.atan2(Math.sin(want - v.heading), Math.cos(want - v.heading))
    v.heading += diff * Math.min(1, dt * 7)
  }
  if (d <= step) {
    v.x = target.x
    v.z = target.z
    v.leg++
    if (v.leg >= v.path.length) {
      v.moving = false
      return true
    }
  } else {
    v.x += (dx / d) * step
    v.z += (dz / d) * step
  }
  return false
}

function people(dt: number) {
  const step = Math.min(dt, 0.25)
  for (const v of [...farm.visitors]) {
    if (v.phase === 'arriving') {
      if (walk(v, step)) {
        v.phase = 'waiting'
        v.heading = Math.PI // facing the garden (north)
        v.moodAt = farm.clock
        toast(`${v.name} is at the garden gate`)
        const { pan, near } = placeSound(GATE_SPOT.x, GATE_SPOT.z)
        farmSound('bell', pan, Math.max(0.5, near))
        bump()
      }
    } else if (v.phase === 'waiting') {
      const want = Math.PI
      v.heading += Math.atan2(Math.sin(want - v.heading), Math.cos(want - v.heading)) * Math.min(1, step * 5)
      v.waited += dt
      if (v.waited > VISITOR.patience) {
        toast(`${v.name} could not wait any longer`)
        leave(v, 'sad')
      }
    } else if (walk(v, step)) {
      farm.visitors.splice(farm.visitors.indexOf(v), 1)
      bump()
    }
  }
  // the next one comes by once nobody is waiting at the gate
  if (!farm.started) return
  const busyGate = farm.visitors.some((v) => v.phase !== 'leaving')
  if (busyGate) return
  farm.nextVisitorIn -= dt
  if (farm.nextVisitorIn <= 0) {
    farm.nextVisitorIn = rand(VISITOR.every[0], VISITOR.every[1])
    spawnVisitor()
  }
}

let gifted = false
function neverStuck() {
  const broke = farm.coins < Math.min(...CROPS.map((c) => c.seedCost))
  const nothing = farm.beds.every((b) => !b.crop) && produceIds.every((id) => farm.inv[id] === 0) && millStage() === 'idle' && ovenStage() === 'idle'
  if (broke && nothing && !gifted) {
    gifted = true
    farm.coins += 6
    toast('A neighbour left 6 coins at the gate for seeds')
    bump()
    save()
  }
  if (!broke) gifted = false
}

/** Advances the farm by `dt` seconds of real time. */
export function tick(dt: number) {
  if (!(dt > 0)) return
  const before = stageKey()
  farm.clock += dt
  grow(dt)
  people(dt)
  neverStuck()
  if (stageKey() !== before) {
    bump()
    save()
  }
}

// growing on while the page was closed: up to three hours, with nobody at the gate in the meantime
if (loaded.savedAt) {
  const away = Math.min(3 * 3600, Math.max(0, (Date.now() - loaded.savedAt) / 1000))
  for (let left = away; left > 0; left -= 5) grow(Math.min(5, left))
}

/** Starts again from scratch (settings, tests). */
export function resetFarm() {
  const f = fresh()
  Object.assign(farm, f)
  saveNow()
  bump()
}

export { saveNow as saveFarm }
