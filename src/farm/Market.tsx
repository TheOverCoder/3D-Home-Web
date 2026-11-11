// The supermarket and the contractor's corner in the scene: the walk-in building (src/scene/WalkIn.tsx), its fittings
// and the goods on its shelves (./marketGoods.ts), the people (./marketPeople.ts: the manager, the shoppers, the
// contractor), the things you press or tap — the manager, the computer, the till, each place on the shelves, the
// contractor's window — and `__home.market` (?debug). Where everything stands is src/data/market.ts; what each thing
// does is the farm's state (src/farm/state.ts).
//
// Before the shop is yours the manager buys your goods (his panel), and the computer behind him carries the shop's
// price tag once his rate is at its top; after, the computer is yours (the shop's panel), the till fills as shoppers
// pay, and a press at a place on the shelves stocks every place in reach that is short of its own good (as a bed set to
// one crop plants every like bed in reach); a place never set opens its card, and its gear opens it too. The
// contractor keeps hours (src/farm/day.ts): at night his window says when he is back.

import { useEffect, useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CanvasTexture, Group, SRGBColorSpace } from 'three'
import { farmSound, placeSound } from '../audio/sound'
import type { Box } from '../data/buildings'
import {
  BAYS,
  BAY_WIDTH,
  CABIN,
  CONTRACTOR_SPOT,
  CONTRACTOR_STAND,
  COUNTER,
  DESK,
  DESK_STAND,
  HALL,
  ISLAND,
  ISLAND_PANEL,
  MANAGER_SPOT,
  MANAGER_STAND,
  MARKET_WALKIN,
  SCREEN,
  SHELF_RUN,
  SHELF_YS,
  TILL,
} from '../data/market'
import { debugSet } from '../lib/debug'
import { playGesture } from '../lib/gestures'
import { groundDistance, useInteractable, type ActionIcon } from '../lib/interaction'
import { playerState } from '../lib/playerState'
import { Parts, type PartDef } from '../lib/sculpt'
import { BAY_DEPTH, CABIN_WINDOW, MARKET_SCREEN, MARKET_SIGN, fittingShapes, marketFittingsParts, putMarketFittings, type FittingPart } from '../models/market'
import { hidingPiece, walkInDoor, WalkIn } from '../scene/WalkIn'
import { useHome } from '../store'
import { LADDERS, MANAGER, SELLABLE, SHOP, count, produceById, type ProduceId } from './data'
import { untilPhase } from './day'
import { MAX_PLACES, ladderPrice, managerPct } from './market'
import { MarketGoods, goodsTriangles } from './marketGoods'
import { useMarketPeople } from './marketPeople'
import { contractorHere, farm, ladderOpen, managerNow, marketForSale, placesNow, restockPlaces, shoppersNow, takeTill, tillReady, useFarm } from './state'

const mmss = (seconds: number) => {
  const t = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
const middle = (b: Box) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 })
const half = (b: Box): [number, number, number] => [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2]

// ───────────────────────────── the fittings ─────────────────────────────

/** The fittings (src/models/market.ts): none casts, unless the pixel guard turns the inside's casters on — then they
 *  are made again at once, casting (each a model of its own either way, so the drawing pass leaves out those nobody can
 *  see; but a part that casts is drawn whole). */
class Fittings {
  readonly group = new Group()
  private parts: Parts<FittingPart> | null = null

  constructor() {
    this.group.name = 'market-fittings'
  }

  set(castShadow: boolean) {
    this.dispose()
    let parts: Parts<FittingPart>
    if (!castShadow) parts = marketFittingsParts()
    else {
      const shapes = fittingShapes()
      const defs = {} as Record<FittingPart, PartDef>
      for (const k of Object.keys(shapes) as FittingPart[]) defs[k] = { geometry: shapes[k].geometry(), max: k === 'bay' ? BAYS.length : 1, material: { roughness: 0.7 }, castShadow: true }
      parts = new Parts<FittingPart>(defs, 'market-fittings-casting')
      putMarketFittings(parts)
    }
    this.parts = parts
    this.group.add(parts.group)
  }

  dispose() {
    const p = this.parts
    if (!p) return
    p.group.removeFromParent()
    p.dispose()
    for (const m of Object.values(p.meshes)) m.geometry.dispose()
    this.parts = null
  }
}

/** What you bump into: the counter, the shelving, the island, the desk, the cabin and the counter board under its
 *  window (it stands out into the corner: you stand at it, not in it). */
const WINDOW_COUNTER: Box = {
  x0: CABIN.x1,
  x1: CABIN.x1 + 0.26,
  z0: CABIN_WINDOW.z - CABIN_WINDOW.half[0] - 0.04,
  z1: CABIN_WINDOW.z + CABIN_WINDOW.half[0] + 0.04,
  y0: 0,
  y1: CABIN_WINDOW.y - CABIN_WINDOW.half[1],
}
const SOLID: Box[] = [COUNTER, SHELF_RUN, ISLAND, DESK, CABIN, WINDOW_COUNTER]

// ───────────────────────────── the screen and the sign ─────────────────────────────

/** The sign over the door and the shop window, on the board's face (MARKET_SIGN): the shop's name. */
function signTexture() {
  const W = 1024
  const H = Math.round((W * MARKET_SIGN.half[1]) / MARKET_SIGN.half[0])
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#2c5c36'
  g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(243,234,216,0.45)'
  g.lineWidth = 6
  g.strokeRect(10, 10, W - 20, H - 20)
  g.fillStyle = '#f3ead8'
  g.font = `800 ${Math.round(H * 0.62)}px Inter, system-ui, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('MARKET', W / 2, H / 2 + 4)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** The computer's screen. Before the shop is yours, the manager's: what he pays, and the shop's price once his rate is
 *  at its top. After, yours: a row per place (how full, green to red; grey while closed) and the coins in the till. */
function drawScreen(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!
  const W = c.width
  const H = c.height
  const m = farm.market
  g.fillStyle = '#10232c'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#2c8540'
  g.fillRect(0, 0, W, 34)
  g.fillStyle = '#f3ead8'
  g.font = '800 24px Inter, system-ui, sans-serif'
  g.textBaseline = 'middle'
  g.fillText(m.owned ? 'YOUR SHOP' : 'MARKET', 12, 18)
  if (!m.owned) {
    g.font = '800 44px Inter, system-ui, sans-serif'
    g.fillText(`${managerPct(farm.ladders.rate)}%`, 16, 70)
    // the rate's steps
    for (let k = 0; k < LADDERS.rate.levels; k++) {
      g.fillStyle = k < farm.ladders.rate ? '#6fd36a' : '#3a4a50'
      g.fillRect(16 + k * ((W - 32) / LADDERS.rate.levels), 98, (W - 32) / LADDERS.rate.levels - 6, 12)
    }
    if (marketForSale()) {
      g.fillStyle = '#ffc93c'
      g.font = '800 22px Inter, system-ui, sans-serif'
      g.fillText(`FOR SALE · ${MANAGER.shopPrice}`, 16, 132)
    }
    return
  }
  const open = placesNow()
  const rowH = (H - 44 - 30) / MAX_PLACES
  m.shelves.slice(0, MAX_PLACES).forEach((s, k) => {
    const y = 42 + k * rowH
    g.fillStyle = '#3a4a50'
    g.fillRect(12, y, W - 24, rowH - 3)
    if (k >= open) return
    const share = s.units / SHOP.units
    g.fillStyle = share >= 1 ? '#6fd36a' : share > 0 ? '#ffc93c' : '#e0604a'
    g.fillRect(12, y, Math.max(6, (W - 24) * share), rowH - 3)
  })
  g.fillStyle = '#ffc93c'
  g.font = '800 22px Inter, system-ui, sans-serif'
  g.fillText(`TILL ${m.till.coins}`, 12, H - 14)
}

function Screen() {
  const screen = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 150
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return { canvas: c, texture: t }
  }, [])
  useEffect(() => () => screen.texture.dispose(), [screen])
  const rev = useFarm((s) => s.rev)
  useEffect(() => {
    drawScreen(screen.canvas)
    screen.texture.needsUpdate = true
  }, [rev, screen])
  return (
    <mesh position={[MARKET_SCREEN.x, MARKET_SCREEN.y, MARKET_SCREEN.z]} rotation-y={MARKET_SCREEN.heading}>
      <planeGeometry args={[MARKET_SCREEN.half[0] * 2, MARKET_SCREEN.half[1] * 2]} />
      <meshStandardMaterial color="#000000" emissive="#ffffff" emissiveMap={screen.texture} emissiveIntensity={0.85} roughness={0.3} />
    </mesh>
  )
}

function Sign() {
  const sign = useMemo(signTexture, [])
  useEffect(() => () => sign.dispose(), [sign])
  // just in front of its board, facing the lane
  return (
    <mesh position={[MARKET_SIGN.x, MARKET_SIGN.y, MARKET_SIGN.z - 0.002]} rotation-y={MARKET_SIGN.heading}>
      <planeGeometry args={[MARKET_SIGN.half[0] * 2, MARKET_SIGN.half[1] * 2]} />
      <meshStandardMaterial map={sign} roughness={0.85} />
    </mesh>
  )
}

// ───────────────────────────── the goods ─────────────────────────────

/** The goods on the shelves, put again whenever the farm changes. */
function Goods({ goods }: { goods: MarketGoods }) {
  const rev = useFarm((s) => s.rev)
  useEffect(() => {
    goods.put(farm.market.shelves, farm.market.owned ? placesNow() : 0)
  }, [rev, goods])
  return <primitive object={goods.group} />
}

// ───────────────────────────── the places on the shelves ─────────────────────────────

/** How far from a place you can stock it (from its footprint's edge, on the ground). */
const BAY_REACH = 1.3

/** A place's footprint: its middle and half its size each way. */
function bayBox(k: number) {
  const b = BAYS[k]
  const fx = Math.sin(b.heading)
  const fz = Math.cos(b.heading)
  return {
    at: { x: b.x - fx * (BAY_DEPTH / 2), z: b.z - fz * (BAY_DEPTH / 2) },
    half: { x: Math.abs(fz) * (BAY_WIDTH / 2) + Math.abs(fx) * (BAY_DEPTH / 2), z: Math.abs(fx) * (BAY_WIDTH / 2) + Math.abs(fz) * (BAY_DEPTH / 2) },
  }
}
const BAY_BOXES = BAYS.map((_, k) => bayBox(k))

/** Whether you stand in front of a place (on the side it faces), within reach: the island's other face is not. */
function bayInReach(k: number, x: number, z: number) {
  const b = BAYS[k]
  if ((x - b.x) * Math.sin(b.heading) + (z - b.z) * Math.cos(b.heading) < -0.05) return false
  return groundDistance(x, z, BAY_BOXES[k].at, BAY_BOXES[k].half) <= BAY_REACH
}

const openPlace = (k: number) => farm.market.owned && k < placesNow()
/** A place you can stock now: open, its good set, not full, and some of it in the silo or the barn. */
const stockable = (k: number) => {
  const s = farm.market.shelves[k]
  return openPlace(k) && !!s.good && s.units < SHOP.units && farm.inv[s.good] > 0
}

/** The places one press at place k stocks: it, then every other place in reach that can be stocked. */
function baysToStock(k: number): number[] {
  if (!stockable(k)) return []
  const p = playerState.position
  const out = [k]
  for (let j = 0; j < BAYS.length; j++) if (j !== k && stockable(j) && bayInReach(j, p.x, p.z)) out.push(j)
  return out
}

/** What stocking these places puts up: the first good and how many, then any other good among them (each place takes
 *  up to SHOP.units, as far as the silo or the barn has it, in turn — as restockPlaces does). */
function stockOf(ks: number[]): Pick<ActionIcon, 'item' | 'count' | 'also'> {
  const left = new Map<ProduceId, number>()
  const got = new Map<ProduceId, number>()
  for (const k of ks) {
    const s = farm.market.shelves[k]
    const good = s.good!
    const have = left.get(good) ?? farm.inv[good]
    const n = Math.min(SHOP.units - s.units, have)
    left.set(good, have - n)
    got.set(good, (got.get(good) ?? 0) + n)
  }
  const [first, ...rest] = [...got].map(([item, n]) => ({ item, count: n }))
  return { ...first, ...(rest.length ? { also: rest } : {}) }
}

function Bay({ k }: { k: number }) {
  const bay = BAYS[k]
  const { at, half: h } = BAY_BOXES[k]
  const openPanel = useHome((s) => s.openPanel)
  useInteractable({
    id: `farm-market-bay-${k}`,
    position: [at.x, 0.9, at.z],
    aim: [bay.x, SHELF_YS[1] + 0.1, bay.z],
    box: h,
    radius: BAY_REACH,
    // open, and you in front of it; full, it offers nothing (its gear still shows)
    enabled: () => {
      if (!openPlace(k)) return false
      const p = playerState.position
      if (!bayInReach(k, p.x, p.z)) return false
      const s = farm.market.shelves[k]
      return !s.good || s.units < SHOP.units
    },
    same: () => {
      const ks = baysToStock(k)
      return ks.length ? `bays:stock:${ks.sort((a, b) => a - b).join(',')}` : undefined
    },
    label: () => {
      const s = farm.market.shelves[k]
      if (!s.good) return 'Choose what this place sells'
      if (farm.inv[s.good] <= 0) return `No ${produceById(s.good).plural} to put on the shelf`
      const ks = baysToStock(k)
      if (ks.length > 1) return `Stock ${ks.length} places`
      const n = stockOf(ks).count ?? 0
      return `Stock ${count(s.good, n)}`
    },
    icon: () => {
      const s = farm.market.shelves[k]
      if (!s.good) return { verb: 'drop', word: 'Stock' }
      if (farm.inv[s.good] <= 0) return { verb: 'wait', art: 'convenience-store' }
      return { verb: 'drop', word: 'Stock', ...stockOf(baysToStock(k)) }
    },
    // none of its good left: what it is short of
    needs: () => {
      const s = farm.market.shelves[k]
      return s.good && farm.inv[s.good] <= 0 ? [{ item: s.good, count: SHOP.units - s.units }] : null
    },
    run: () => {
      const s = farm.market.shelves[k]
      if (!s.good) {
        openPanel({ kind: 'market-place', place: k })
        return
      }
      const ks = baysToStock(k)
      if (!ks.length || !restockPlaces(ks)) return
      const { pan, near } = placeSound(bay.x, bay.z)
      playGesture('interact')
      farmSound('plant', pan, near)
    },
    // an open place: a gear for what it sells and its price; the first closed one: the price of another place
    tag: () => {
      if (!farm.market.owned) return null
      const top = { x: bay.x, y: 1.95, z: bay.z }
      if (openPlace(k)) return { kind: 'gear', label: 'What this place sells', at: top, open: () => openPanel({ kind: 'market-place', place: k }) }
      if (k !== placesNow() || !ladderOpen('places')) return null
      const price = ladderPrice('places', farm.ladders.places)
      return { kind: 'price', label: `${LADDERS.places.name} · ${price} coins`, price, at: top, open: () => openPanel({ kind: 'ladder', id: 'places' }) }
    },
  })
  return null
}

// ───────────────────────────── the manager, the computer, the till, the contractor ─────────────────────────────

function Counterparts() {
  const openPanel = useHome((s) => s.openPanel)

  // the manager, behind his desk until the shop is yours (he keeps buying while it is for sale)
  useInteractable({
    id: 'farm-market-manager',
    position: [MANAGER_STAND.x, 1.0, MANAGER_STAND.z],
    aim: [MANAGER_SPOT.x, 1.5, MANAGER_SPOT.z],
    radius: 1.2,
    enabled: () => !farm.market.owned,
    label: 'Sell to the manager',
    icon: { verb: 'sell', art: 'office-worker' },
    run: () => openPanel({ kind: 'manager' }),
  })

  // the computer: yours once the shop is; before, it offers nothing, and carries the shop's price tag once it is for sale
  useInteractable({
    id: 'farm-market-computer',
    position: [DESK_STAND.x, 1.0, DESK_STAND.z],
    aim: [SCREEN.x, SCREEN.y, SCREEN.z],
    radius: 1.2,
    enabled: () => farm.market.owned,
    label: 'Open your shop',
    icon: { verb: 'watch', art: 'desktop-computer' },
    run: () => openPanel({ kind: 'market' }),
    tag: () =>
      marketForSale()
        ? {
            kind: 'price',
            label: `Buy the shop · ${MANAGER.shopPrice} coins`,
            price: MANAGER.shopPrice,
            at: { x: SCREEN.x, y: SCREEN.y + 0.32, z: SCREEN.z },
            open: () => openPanel({ kind: 'market-buy' }),
          }
        : null,
  })

  // the till on the counter: what the shoppers paid
  const c = middle(COUNTER)
  const [hx, , hz] = half(COUNTER)
  useInteractable({
    id: 'farm-market-till',
    position: [c.x, 1.0, c.z],
    aim: [TILL.x, TILL.y + 0.12, TILL.z],
    box: { x: hx, z: hz },
    radius: 1.2,
    enabled: () => farm.market.owned && farm.market.till.coins > 0,
    label: () => `Take ${farm.market.till.coins} coins from the till`,
    icon: () => ({ verb: 'pick', item: 'coin', count: farm.market.till.coins, word: 'Take' }),
    ready: tillReady,
    run: () => {
      if (takeTill()) playGesture('interact')
    },
  })

  // the contractor at his cabin's window, in his hours; at night, when he is back
  useInteractable({
    id: 'farm-contractor',
    position: [CONTRACTOR_STAND.x, 1.0, CONTRACTOR_STAND.z],
    aim: [CONTRACTOR_SPOT.x, 1.5, CONTRACTOR_SPOT.z],
    radius: 1.3,
    label: () => (contractorHere() ? 'Trade with the contractor' : `The contractor is back in the morning · ${mmss(untilPhase(farm.day.t, 'morning'))}`),
    icon: () => (contractorHere() ? { verb: 'shop', art: 'construction-worker' } : { verb: 'wait', art: 'construction-worker', seconds: Math.ceil(untilPhase(farm.day.t, 'morning')) }),
    run: () => {
      if (contractorHere()) openPanel({ kind: 'contractor' })
    },
  })
  return null
}

// ───────────────────────────── the market ─────────────────────────────

/** The hiding pieces the walk-in registers (its walls, and the island's middle panel), for the tests. */
const HIDERS = [ISLAND_PANEL]

/** Who opens the front door besides you: the shoppers, and the manager on his way out. */
function* doorWalkers() {
  yield* shoppersNow()
  const m = managerNow()
  if (m) yield m
}

export function Market() {
  const goods = useMemo(() => new MarketGoods(), [])
  useEffect(() => () => goods.dispose(), [goods])
  // made on mount (and again on React's second mount in development), taken away on unmount
  const fittings = useMemo(() => new Fittings(), [])
  useEffect(() => {
    fittings.set(false)
    return () => fittings.dispose()
  }, [fittings])
  useMarketPeople()

  useEffect(() => {
    let casting = false
    debugSet('market', {
      /** the inside's fittings and goods cast a shadow, at once — the next render draws them into the sun's map (they
       *  do not cast: the pixel guard proves that changes nothing). The people stay out: they are the buyers' crowd. */
      casters: (on: boolean) => {
        if (on !== casting) {
          casting = on
          fittings.set(on)
          goods.setCasters(on)
        }
        // the shelves as they are now, both ways (a shopper may have bought since the last frame)
        goods.put(farm.market.shelves, farm.market.owned ? placesNow() : 0)
      },
      casting: () => casting,
      /** how far open the front door is (0 shut, 1 open): it opens for anyone within 2 m of the doorway */
      door: () => walkInDoor(MARKET_WALKIN.id),
      /** the hiding pieces the walk-ins' walls and the island's panel register (src/lib/visibility/walls.ts) */
      walls: [...MARKET_WALKIN.walls, ...HIDERS].map(hidingPiece),
      /** the triangles of one unit of each good on the shelves now, and of every good that can go there */
      goods: () => goods.triangles(),
      goodsTriangles: () => goodsTriangles(SELLABLE),
      hall: HALL,
    })
  }, [goods, fittings])

  return (
    <group name="farm-market">
      <WalkIn def={MARKET_WALKIN} hiders={HIDERS} walkers={doorWalkers} />
      <primitive object={fittings.group} />
      <Goods goods={goods} />
      <Screen />
      <Sign />
      {BAYS.map((_, k) => (
        <Bay key={k} k={k} />
      ))}
      <Counterparts />
      <RigidBody type="fixed" colliders={false}>
        {SOLID.map((b, i) => {
          const m = middle(b)
          return <CuboidCollider key={i} args={half(b)} position={[m.x, m.y, m.z]} />
        })}
      </RigidBody>
    </group>
  )
}
