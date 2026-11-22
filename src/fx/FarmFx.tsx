import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type Camera } from 'three'
import { debugSet } from '../lib/debug'
import { profile } from '../lib/profile'
import { rewardKind } from '../lib/tier'
import { useHome } from '../store'
import { onLessMotion } from '../ui/still'
import { flyCoins, flyItem } from './coins'
import { flyXp } from './xp'
import { iconUrl } from '../farm/icons'
import { storeOf, type ProduceId } from '../farm/data'
import { goodsHeld, letGoodsGo, popInto } from '../ui/fly'
import { coinsFx, coinsToFly, effectsOn, farmFx, fxStats, takeFx, type FxRequest } from './fx'
import type { FxEngine, WeatherEngine } from './quarks'
import { freeze, reacting, stopReactions } from './react'
import { celebrate, takeRewardShows, type RewardShow } from './reward'
import { farm, rewardCounts, resetRewardCounts, seasonNow, weatherNow } from '../farm/state'
import { mapNow } from '../lib/world'
import { lookOf } from '../scene/weatherLook'

// Plays the effects the game asks for (src/fx/fx.ts). The particle engine (three.quarks, src/fx/quarks.ts) is a chunk
// of its own, imported a moment after the game starts playing — never before the first frame — and only where effects
// are drawn at all; its shader is compiled ahead of the first burst. A burst asked for before it has arrived plays if
// it is still fresh, else it is dropped. Coins fly on the page itself, from where the buyer stands on the screen.

/** An effect asked for before the engine arrived plays if it is younger than this, else it is dropped (it would come
 *  too late to mean anything) — or than three of the frames before it, where frames are slow (a phone that stalls,
 *  software rendering's second a frame: there a press's crystals were all dropped). A page hidden for a while stops
 *  its frames altogether, and what was asked meanwhile is still dropped: the frame before the gap was quick. */
const FRESH_MS = 700
const FRESH_FRAMES = 3
/** A gap between frames this long is a page that was hidden, not a slow frame (ms). */
const HIDDEN_MS = 10_000
/** At most this many coins in the air from one frame's sales (selling to a whole line at once). */
const MAX_COINS = 14
/** Goods flying to their store from one press: at most this many pictures (one a bed, an animal), this far apart (ms),
 *  each holding this long at the top of its pop (ms); the same press's crystals leave this much after the first. */
const MAX_GOODS = 8
const GOODS_STAGGER = 70
const GOODS_HOLD = 90
const XP_AFTER_GOODS = 120

const at = new Vector3()
/** For screenshots and tests (`window.__home.fx.time`): how fast the particles' clock runs. */
const time = { speed: 1 }

/** Follows the player's "less motion" choice (src/ui/still.ts) while the game runs. */
function useMotionOk() {
  const [ok, setOk] = useState(effectsOn)
  useEffect(() => onLessMotion(() => setOk(effectsOn())), [])
  return ok
}

export function FarmFx() {
  const playing = useHome((s) => s.phase === 'playing')
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)
  const motionOk = useMotionOk()
  const engine = useRef<FxEngine | null>(null)
  const waiting = useRef<FxRequest[]>([])
  /** the last frame's length (ms), and so how old a request may be and still play (`FRESH_MS`) */
  const lastFrame = useRef(16)

  /** the farm's beds as last seen: another farm (started again, loaded) has others, and no reaction of the last goes on */
  const beds = useRef<unknown>(null)

  useEffect(() => {
    debugSet('fx', { stats: fxStats, time, play: farmFx, coins: coinsFx, held: goodsHeld })
    // every payout counted, by kind and tier (src/farm/state/rewards.ts); the reactions held still for a frozen pose
    debugSet('reward', { rewardCounts, resetRewardCounts })
    debugSet('react', { freeze, reacting, stopReactions })
  }, [])
  // the weather's rain, snow and rainbow: a renderer of their own, fed the season's and the weather's look (below)
  useWeatherFx(playing && motionOk)

  useEffect(() => {
    if (!playing || !motionOk) return
    let gone = false
    let made: FxEngine | null = null
    // after the first frames of play, when the page is idle: the engine is never in the way of starting
    const idle = (fn: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2500 }) : window.setTimeout(fn, 1200))
    const handle = idle(() => {
      import('./quarks')
        .then(({ createFx }) => {
          if (gone) return
          made = createFx(scene)
          engine.current = made
          fxStats.loaded = true
          return made.warm(gl, get().camera, scene)
        })
        .catch(() => {
          /* no effects this time (offline before the chunk was kept): the game plays on without them */
        })
    })
    return () => {
      gone = true
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle as number)
      else window.clearTimeout(handle as number)
      made?.dispose()
      engine.current = null
      fxStats.loaded = false
      fxStats.alive = 0
    }
  }, [playing, motionOk, scene, gl, get])

  useFrame(({ camera, size }, dt) => {
    const fx = engine.current
    const asked = takeFx()
    let coins = 0
    // asked since the frame before is fresh whatever this frame's length (one slow frame after a short one must not
    // drop a harvest's crystals), unless the gap is a page hidden: no frames ran, and what was asked is old news
    const gap = dt * 1000
    const freshMs = Math.max(FRESH_MS, FRESH_FRAMES * lastFrame.current, gap < HIDDEN_MS ? gap + FRESH_MS : 0)
    lastFrame.current = gap
    if (farm.beds !== beds.current) {
      if (beds.current) {
        stopReactions()
        letGoodsGo()
      }
      beds.current = farm.beds
    }
    /** the coins that changed hands this frame, and where: the numbers of the rewards' shows */
    const paid: Paid[] = []
    // goods collected fly to their store (none while a panel is open: it flies its own), and the crystals of the same
    // press leave a moment after them, so the two read as two
    const goodsFly = !useHome.getState().panel && asked.some((r) => r.kind === 'goods')
    let flew = 0
    for (const r of asked) {
      if (r.kind === 'item') {
        // a surprise: from where it was found on the screen (or low in the middle, when that is behind you); the barn's
        // gauge counts it in as it lands
        at.set(r.x, r.y, r.z).project(camera)
        const behind = at.z > 1
        const x = behind ? size.width / 2 : Math.min(size.width - 40, Math.max(40, ((at.x + 1) / 2) * size.width))
        const y = behind ? size.height * 0.6 : Math.min(size.height - 40, Math.max(90, ((1 - at.y) / 2) * size.height))
        if (r.item && flyItem(x, y, iconUrl(r.item as ProduceId), r.order, 'barn', { count: 1, hold: 1 })) fxStats.items++
      } else if (r.kind === 'goods') {
        // goods into their store: one picture with how many from each place they came from, a moment apart, to the
        // store's chip, whose gauge steps up as each lands (src/ui/fly.ts, popInto)
        if (!goodsFly || !r.good || flew >= MAX_GOODS || performance.now() - r.at > freshMs) continue
        const p = screenAt(r.x, r.y, r.z, camera, size)
        const good = r.good as ProduceId
        const n = r.count ?? 1
        const landed = () => fxStats.landed++
        if (popInto(p.x, p.y, { src: iconUrl(good), store: storeOf(good), count: n, hold: n, order: flew, stagger: GOODS_STAGGER, holdMs: GOODS_HOLD, landed })) {
          flew++
          fxStats.goods++
        }
      } else if (r.kind === 'xp') {
        // XP: crystals from where it was gained (or low in the middle, when that is behind you) into the level chip;
        // asked for while no frame ran (the page hidden), they would only take their XP back off the bar: it is there
        if (performance.now() - r.at > freshMs) continue
        at.set(r.x, r.y, r.z).project(camera)
        const behind = at.z > 1
        const x = behind ? size.width / 2 : Math.min(size.width - 30, Math.max(30, ((at.x + 1) / 2) * size.width))
        const y = behind ? size.height * 0.6 : Math.min(size.height - 30, Math.max(90, ((1 - at.y) / 2) * size.height))
        if (flyXp(x, y, r.xp ?? 1, goodsFly ? XP_AFTER_GOODS : 0)) fxStats.xp++
      } else if (r.kind === 'coins') {
        paid.push({ x: r.x, z: r.z, coins: r.coins ?? 0 })
        // from the buyer's place on the screen (or the bottom edge, when they are behind you)
        at.set(r.x, r.y, r.z).project(camera)
        const behind = at.z > 1
        const x = behind ? size.width / 2 : Math.min(size.width - 20, Math.max(20, ((at.x + 1) / 2) * size.width))
        const y = behind ? size.height - 40 : Math.min(size.height - 20, Math.max(20, ((1 - at.y) / 2) * size.height))
        const n = Math.min(coinsToFly(r.coins ?? 0), MAX_COINS - coins)
        if (n > 0) {
          const flown = flyCoins(x, y, n)
          coins += flown
          if (flown) fxStats.coins++
        }
      } else if (fx) {
        fx.burst(r, profile.particles)
        fxStats.started++
      } else waiting.current.push(r)
    }
    showRewards(takeRewardShows(), paid, camera, size, freshMs)
    // asked for while the engine was on its way: what is still fresh plays now
    if (waiting.current.length) {
      const now = performance.now()
      const fresh = waiting.current.filter((r) => now - r.at < freshMs)
      waiting.current = fx ? [] : fresh
      if (fx)
        for (const r of fresh) {
          fx.burst(r, profile.particles)
          fxStats.started++
        }
    }
    if (fx) {
      fx.update(dt * time.speed)
      fxStats.alive = fx.alive()
    }
  })

  return null
}

/** Coins that changed hands at a place on the ground this frame (a buyer paying, the till emptied). */
interface Paid {
  x: number
  z: number
  coins: number
}

/** A world point on the screen, kept `edge` px in from the sides and `top` px under the top (the chips' row); low in
 *  the middle when it is behind you. */
function screenAt(x: number, y: number, z: number, camera: Camera, size: { width: number; height: number }, edge = 40, top = 90) {
  at.set(x, y, z).project(camera)
  if (at.z > 1) return { x: size.width / 2, y: size.height * 0.6 }
  return { x: Math.min(size.width - edge, Math.max(edge, ((at.x + 1) / 2) * size.width)), y: Math.min(size.height - edge, Math.max(top, ((1 - at.y) / 2) * size.height)) }
}

/**
 * The world's reward request (update-v1/missions/05-world-feel.md, change 2): each reward paid at a place in the world
 * since the last frame (src/fx/reward.ts, queued by `rewarded`) is celebrated over where it was paid — its number and
 * its confetti, by its tier. The number is the coins that changed hands there this frame, each flight of coins counted
 * to the nearest show: a whole line sold is one show with the line's coins, one number. Its sound and its touch the farm
 * played as it paid (06's lines in the sale paths). A show that waited too long (no frames: the page hidden) is dropped.
 */
function showRewards(shows: RewardShow[], paid: Paid[], camera: Camera, size: { width: number; height: number }, freshMs: number) {
  if (!shows.length) return
  const coins = new Map<RewardShow, number>()
  const takers = shows.filter((s) => rewardKind(s.kind).family === 'coins')
  for (const p of paid) {
    let best: RewardShow | null = null
    for (const s of takers) if (!best || Math.hypot(s.x - p.x, s.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z)) best = s
    if (best) coins.set(best, (coins.get(best) ?? 0) + p.coins)
  }
  const now = performance.now()
  for (const s of shows) {
    if (now - s.at > freshMs) continue
    const n = coins.get(s)
    celebrate(s.kind, s.tier, screenAt(s.x, s.y, s.z, camera, size), { coins: n, sound: false })
    fxStats.rewards++
    if (n) fxStats.pops++
  }
}

/** For the tests and the stills (`window.__home.weatherFx`): what falls, how long its script takes, how many drops at
 *  the full (`most`: null, the tier's), and the weather run on by hand (`settle`: its clock that many seconds on, with
 *  the season's and the weather's look now, round the camera now). */
const weatherHook = { engine: null as WeatherEngine | null, most: null as number | null }

/**
 * The weather's feed (update-v1/missions/10-seasons-weather.md, change 4): rain, snow and the rainbow
 * (src/fx/quarks.ts, `weatherFx`) from the look of the season and the weather now (src/scene/weatherLook.ts), each frame,
 * on both maps, round the camera, as many as the tier draws (src/lib/profile.ts, `weather`), ending at the roofs of the
 * map in the scene (src/lib/world.ts, `shelters`, as the materials have them). Loaded as the bursts' engine is, once
 * playing and only with motion on (`on`): with less motion nothing falls, and the grey sky and the fog stay
 * (src/scene/Lighting.tsx, DayLight). Its clock is the effects' (`__home.fx.time`: 0 stops it).
 */
function useWeatherFx(on: boolean) {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)
  const engine = useRef<WeatherEngine | null>(null)
  const map = useRef<string | null>(null)
  useEffect(() => {
    debugSet('weatherFx', {
      get stats() {
        return weatherHook.engine?.stats ?? null
      },
      get most() {
        return weatherHook.most
      },
      set most(n: number | null) {
        weatherHook.most = n
      },
      get tiers() {
        return profile.weather
      },
      settle: (seconds: number) => {
        const s = get()
        weatherHook.engine?.update(lookOf(seasonNow(), weatherNow()), s.camera, seconds, mostNow(), pixelsOf(s.size.height, s.gl))
      },
    })
  }, [get])
  useEffect(() => {
    if (!on) return
    let gone = false
    let made: WeatherEngine | null = null
    const idle = (fn: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2500 }) : window.setTimeout(fn, 1200))
    const handle = idle(() => {
      import('./quarks')
        .then(({ weatherFx }) => {
          if (gone) return
          made = weatherFx(scene)
          engine.current = weatherHook.engine = made
          return made.warm(gl, get().camera, scene)
        })
        .catch(() => {
          /* no weather drawn this time (offline before the chunk was kept): the sky and the light still show it */
        })
    })
    return () => {
      gone = true
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle as number)
      else window.clearTimeout(handle as number)
      made?.dispose()
      engine.current = weatherHook.engine = null
    }
  }, [on, scene, gl, get])
  useFrame(({ camera, size, gl }, dt) => {
    const w = engine.current
    if (!w) return
    // another map: what fell on the last one goes
    const here = mapNow()
    if (map.current !== here) {
      if (map.current !== null) w.clear()
      map.current = here
    }
    w.update(lookOf(seasonNow(), weatherNow()), camera, dt * time.speed, mostNow(), pixelsOf(size.height, gl))
  })
}

/** How many drops fall at the full: the tests' own, or the tier's. */
const mostNow = () => weatherHook.most ?? profile.weather[useHome.getState().quality]
/** The drawing buffer's height in pixels (a flake's size on the screen). */
const pixelsOf = (height: number, gl: { getPixelRatio(): number }) => height * gl.getPixelRatio()
