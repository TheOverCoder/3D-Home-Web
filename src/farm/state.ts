import { machineLevel } from './machineView'
import { priceBoosts, priceEvents } from './prices'
import { priceFactor } from './events'
import { eventTime, farm, saveNow, switchesByPage, writeWith } from './state/core'
import { load, resumeFrom, startSlot, writeSlot } from './state/save'
import { stepsByPage } from './state/steps'

// The farm's state: one import for the whole game (`./state`), its parts in src/farm/state/, one module an area. The
// farm runs on a plain object that the scene reads every frame (growth, water, people walking), so nothing re-renders
// 60 times a second; anything the interface shows changes in steps (planted, thirsty, ripe, sold), and each step bumps
// `useFarm`'s revision so the panels and the HUD redraw.
//
// A module holds functions and its own few values: none reads the farm, or calls into another, as it loads. The farm is
// read from its save once, here, in start(), after every module is in. A new module is one line below.

export * from './state/core'
export * from './state/rewards'
export * from './state/levels'
export * from './state/stores'
export * from './state/ladders'
export * from './state/beds'
export * from './state/producers'
export * from './state/machines'
export * from './state/ready'
export * from './state/shop'
export * from './state/decor'
export * from './state/buyers'
export * from './state/orders'
export * from './state/contractor'
export * from './state/day'
export * from './state/market'
export * from './state/steps'
export * from './state/daily'
export * from './state/tick'
export * from './state/away'
export * from './state/save'
export * from './state/season'

/**
 * The farm as the page opens, once: the switches as the page has them (the week's events, the levels' locks, the first
 * steps: off where the game is tested), the slot this device played last read and made safe into the farm, the prices
 * told the machines' levels and the lucky draw, the farm written into its slot as it changes and as the page hides,
 * and then the line at the gate as it was left and the time since it was saved played on.
 */
function start() {
  switchesByPage()
  stepsByPage()
  startSlot()
  const loaded = load()
  Object.assign(farm, loaded.data)
  // what a machine makes sells for more at its level (every sale asks src/farm/prices.ts); only once the farm is here:
  // a save that loads before it asks nothing of it
  priceBoosts((id) => machineLevel(farm.machines[id].worked).boost.coins)
  writeWith(writeSlot)
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', saveNow)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow()
    })
  }
  // the lucky draw's goods sell for double on its day, wherever they are sold (every sale prices a good through priceOf)
  priceEvents((good) => priceFactor(good, farm.events, eventTime()))
  // the line at the gate as you left it; then the time the page was closed
  resumeFrom(loaded)
}

start()
