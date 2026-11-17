import { useEffect, useState } from 'react'
import { farmSound, uiClick } from '../audio/sound'
import { playGesture } from '../lib/gestures'
import { allInteractables, groundDistance, interactable } from '../lib/interaction'
import { playerState } from '../lib/playerState'
import { useWalk, walkTo } from '../lib/route/walking'
import { useHome } from '../store'
import type { OfficeUpgradeId, ProduceId } from './data'
import { OrdersBoard } from './orderBoard/OrdersBoard'
import { officeRows, type OrdersActions, type OrdersView } from './orderBoard/view'
import { nearestPlace, placesOf } from './orderPlace'
import { buyOffice, contractorHere, declineOrder, farm, fillOrder, orderWaitSeconds, sendOrder, useFarm } from './state'

// The order board on the office's computer (the action button at the office opens it): the designed board
// (./orderBoard/OrdersBoard.tsx, which draws an OrdersView and calls OrdersActions) fed with the farm's, with the game's
// sounds on what it does. Each order with what it asks for, what it pays and whether it brings a surprise: Put in (what
// the silo and the barn have of it; the rest can follow), Send once it is all in (paid at once; its crates go out on
// the tractor), or × to decline it (what was put in goes back); a place whose order was declined counts down to the
// next. The office's two upgrades are its second tab; `office-upgrade` (an upgrade asked for) is the same board with
// the card that asks open. On the farm, "Show me" on a good the store is short of closes the board and walks you to
// where it is made (./orderPlace.ts), as a compass mark tapped does.

/** Draws again every second while open: the waits count down with the farm. */
function useSeconds() {
  const [, setNow] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
}

/** The board as the farm has it now (copies: the farm's orders change in place). */
export const ordersView = (): OrdersView => ({
  slots: farm.orders.map((slot) => ('order' in slot ? { order: { ...slot.order, lines: slot.order.lines.map((l) => ({ ...l })) } } : { wait: slot.wait })),
  inv: { ...farm.inv },
  wait: orderWaitSeconds(),
  office: officeRows(farm.office),
  coins: farm.coins,
})

/** The farm's order actions, each with its sound when it did something. */
const actions: OrdersActions = {
  put: (k) => {
    const n = fillOrder(k)
    if (n) {
      uiClick()
      farmSound('plant')
    }
    return n
  },
  send: (k) => {
    const ok = sendOrder(k)
    if (ok) playGesture('interact')
    return ok
  },
  decline: (k) => declineOrder(k),
  buy: (id) => {
    const ok = buyOffice(id)
    if (ok) {
      farmSound('build')
      playGesture('interact')
    }
    return ok
  },
}

/** Where to walk to for a good: the nearest place it is made with it ready to take, else the nearest (null: none on
 *  this map; a building material: the contractor, while he is in). */
export function placeFor(good: ProduceId): string | null {
  const from = playerState.position
  return nearestPlace(
    placesOf(
      good,
      farm.beds,
      allInteractables().map((d) => d.id),
      contractorHere(),
    ).map((id) => {
      const def = interactable(id)!
      const r = def.ready?.()
      return { id, ready: !!r && r.item === good, d: groundDistance(from.x, from.z, def.position, def.box) }
    }),
  )
}

/** "Show me": the board closes (a panel open would stop the walk at once) and you walk there, as from the compass. A
 *  walk there already (to that place, or to that good's mark) goes on. */
function showMe(good: ProduceId) {
  const id = placeFor(good)
  if (!id) return
  useHome.getState().closePanel()
  const w = useWalk.getState()
  if (w.id && (w.id === id || w.item === good)) return
  walkTo(id, good)
}

export function OrdersPanel({ asking = null }: { asking?: OfficeUpgradeId | null }) {
  useFarm((s) => s.rev)
  useSeconds()
  const openPanel = useHome((s) => s.openPanel)
  const close = useHome((s) => s.closePanel)
  // the walk stays on its map: on the farm only (the board is the farm's office's)
  const onFarm = useHome((s) => s.map) === 'farm'
  const act: OrdersActions = onFarm ? { ...actions, show: showMe, canShow: (good) => placeFor(good) !== null } : actions
  return <OrdersBoard v={ordersView()} act={act} asking={asking} onAsk={(id) => openPanel(id ? { kind: 'office-upgrade', id } : { kind: 'orders' })} onClose={close} />
}
