import { vi } from 'vitest'
import {
  acceptOffer,
  buildBed,
  buy,
  buyLand,
  buyPiece,
  collect,
  collectMachine,
  currentSlot,
  declineOffer,
  farm,
  fixBed,
  freeSpotFor,
  harvestBeds,
  loadMachine,
  movePiece,
  movePlace,
  placeStored,
  plant,
  resetFarm,
  saveFarm,
  spawnVisitor,
  storePiece,
  switchSlot,
  tick,
  upgradeStore,
  water,
} from './state'

// Saves for the unit tests (never part of the game): two written by the code before the tables, one played to, and the
// way the game starts from a save.

/** A farm as the code before the tables (PRODUCERS and MACHINES in src/farm/data.ts) saved it: the lemon tree, the nest,
 *  the cows and the sheep in fields of their own, the mill at work, the loom and the oven done. Written by that code;
 *  all of it but the house's furniture, which this does not touch. */
export const OLD_SAVE = {
  coins: 321,
  inv: {
    lettuce: 0,
    carrot: 0,
    strawberry: 0,
    tomato: 0,
    corn: 0,
    pumpkin: 0,
    wheat: 2,
    sugarcane: 0,
    lemon: 4,
    egg: 3,
    milk: 2,
    wool: 1,
    sugar: 1,
    flour: 1,
    cloth: 0,
    lemon_cake: 0,
    strawberry_cake: 0,
    carrot_cake: 0,
    pumpkin_pie: 0,
  },
  beds: [
    { built: true, crop: 'lettuce', growth: 20, water: 4.5, fixed: null },
    { built: true, crop: null, growth: 0, water: 0, fixed: null },
    { built: true, crop: null, growth: 0, water: 0, fixed: null },
    { built: true, crop: null, growth: 0, water: 0, fixed: null },
    ...Array.from({ length: 9 }, () => ({ built: false, crop: null, growth: 0, water: 0, fixed: null })),
  ],
  lemons: 5,
  lemonTimer: 12.5,
  eggs: 4,
  eggTimer: 17.25,
  hens: 4,
  cows: 3,
  milk: [2, 0, 3],
  milkTimer: [10.5, 44, 0.75],
  sheep: 3,
  wool: [1, 2, 0],
  woolTimer: [30.5, 0, 59],
  mill: { input: 'wheat', count: 5, progress: 7.5, output: null, ready: 0 },
  oven: { baking: null, progress: 0, ready: 'strawberry_cake' },
  loom: { count: 0, progress: 0, ready: 3 },
  sprinkler: false,
  compost: false,
  expansions: { east: false, west: false },
  queueLevel: 0,
  paceLevel: 0,
  started: true,
  planted: ['lettuce'],
  made: ['lettuce', 'egg', 'milk', 'flour'],
  stats: { harvested: 40, sold: 12, earned: 99, declined: 1, baked: 2 },
  layout: {
    places: {
      hens: { x: 11.6, z: 6.7, rot: 0 },
      cows: { x: 11.35, z: -2.9, rot: 0 },
      sheep: { x: -2.1, z: -10.45, rot: 0 },
      lemon: { x: -6.1, z: 10.3, rot: 0 },
      tree0: { x: -11.2, z: -10.2, rot: 0 },
      tree1: { x: 10.8, z: -10.6, rot: 0 },
      tree2: { x: -11.6, z: 9.6, rot: 0 },
    },
    land: [],
  },
  nextVisitorIn: 20,
  queue: [{ name: 'Omer', look: { shirt: '#5c8a4a', trousers: '#5a4636', skin: '#f1c7a5', hair: '#b9b2a8', hairStyle: 0, hat: false, height: 1.027828637076638 }, want: 'egg', qty: 2, offer: 5 }],
  time: 1794336190566,
}

/** The same code's save of a farm where everything else is the other way: the mill done, the oven baking, the loom at
 *  work, the tree and the nest full, two of four sheep with a full fleece. */
export const OLD_SAVE_2 = {
  ...OLD_SAVE,
  lemons: 8,
  lemonTimer: 29.5,
  eggs: 6,
  eggTimer: 39.5,
  hens: 6,
  cows: 1,
  milk: [0],
  milkTimer: [3],
  sheep: 4,
  wool: [2, 2, 1, 0],
  woolTimer: [0, 0, 12, 1.5],
  mill: { input: null, count: 0, progress: 0, output: 'sugar', ready: 4 },
  oven: { baking: 'carrot_cake', progress: 12.25, ready: null },
  loom: { count: 2, progress: 5.5, ready: 0 },
}

/** Saved just now: nothing grows on while it was away. */
export const justSaved = (save: object) => ({ ...save, time: Date.now() })

const slotKey = (n: number) => (n === 1 ? '3d-home:farm:v1' : `3d-home:farm:v1:slot${n}`)

/** Starts the farm from a save the way the page does: read from the browser's storage, then grown on for the time it
 *  was away. Switching to a slot loads it just so (slots 2 and 3 in turn: switching to the one being played does
 *  nothing). */
export function startFrom(save: string | object) {
  const n = currentSlot() === 2 ? 3 : 2
  localStorage.setItem(slotKey(n), typeof save === 'string' ? save : JSON.stringify(save))
  switchSlot(n)
}

/** The farm as the game saves it now. */
export function savedNow(): Record<string, unknown> {
  saveFarm()
  return JSON.parse(localStorage.getItem(slotKey(currentSlot()))!) as Record<string, unknown>
}

/** Math.random from a seed (mulberry32), for a farm played the same way every time. */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A farm played for a while, as the game saves it: something in every part of the save. The east beds, the west field
 *  and two meadows bought, the lemon tree moved out onto one; three cows, three sheep, four hens; beds growing (two
 *  watered, the rest dry), two set to a crop, a staked-out one built; things sold, declined, harvested and baked; the
 *  oven and the loom done, the mill at work; five buyers in a line of seven; the barn made bigger once, a building
 *  material or two kept; the pouf moved, a plant put away, a stool bought and stood in the kitchen, a plant bought and
 *  waiting in storage. The same every time (its buyers' looks and names come from a seed). */
export function playedSave(): Record<string, unknown> {
  const random = vi.spyOn(Math, 'random').mockImplementation(seeded(7))
  try {
    resetFarm()
    farm.coins = 5000
    for (const u of ['east', 'west', 'cow', 'cow', 'sheep', 'hen', 'hen', 'compost', 'queue', 'queue', 'pace'] as const) buy(u)
    buildBed(4)
    buyLand('north')
    buyLand('east')
    movePlace('lemon', { x: 0, z: -19, rot: 1 })
    plant(0, 'lettuce')
    plant(1, 'carrot')
    plant(4, 'corn')
    plant(6, 'wheat')
    plant(9, 'strawberry')
    plant(10, 'pumpkin')
    fixBed(2, 'tomato')
    fixBed(7, 'sugarcane')
    tick(25)
    water(0)
    water(1)
    tick(25)
    harvestBeds([0])
    plant(0, 'tomato')
    collect('tree')
    collect('cows', 1)
    collect('sheep', 0)
    acceptOffer(spawnVisitor({ want: 'lettuce', qty: 2, offer: 9, queued: true }).id)
    declineOffer(spawnVisitor({ want: 'cloth', qty: 2, offer: 40, queued: true }).id)
    Object.assign(farm.inv, { flour: 3, sugar: 3, egg: 6, milk: 3, strawberry: 8, lemon: 4, wool: 3, wheat: 9 })
    loadMachine('oven', 'strawberry_cake')
    loadMachine('loom', 'wool')
    tick(36)
    collectMachine('oven')
    loadMachine('oven', 'lemon_cake')
    tick(31)
    loadMachine('mill', 'wheat')
    tick(5)
    water(1)
    water(9)
    spawnVisitor({ want: 'egg', qty: 2, offer: 5, queued: true })
    spawnVisitor({ want: 'milk', qty: 1, offer: 4, queued: true })
    spawnVisitor({ want: 'lemon_cake', qty: 1, offer: 60, queued: true })
    // the barn a level bigger, a material or two left
    Object.assign(farm.inv, { brick: 2, plank: 1, nail: 1, iron: 1, log: 2 })
    upgradeStore('barn')
    movePiece('pouf', { x: -1.5, z: 1.5, rot: 0 })
    storePiece('plant-studio')
    buyPiece('stool')
    placeStored('stool', freeSpotFor('stool', 'kitchen')!)
    buyPiece('plant')
    return savedNow()
  } finally {
    random.mockRestore()
  }
}
