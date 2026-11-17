import { useEffect, useState } from 'react'
import { farmSound, uiClick } from '../audio/sound'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import type { OfficeUpgradeId } from './data'
import { OrdersBoard } from './orderBoard/OrdersBoard'
import { officeRows, type OrdersActions, type OrdersView } from './orderBoard/view'
import { buyOffice, declineOrder, farm, fillOrder, orderWaitSeconds, sendOrder, useFarm } from './state'

// The order board on the office's computer (the action button at the office opens it): the designed board
// (./orderBoard/OrdersBoard.tsx, which draws an OrdersView and calls OrdersActions) fed with the farm's, with the game's
// sounds on what it does. Each order with what it asks for, what it pays and whether it brings a surprise: Put in (what
// the silo and the barn have of it; the rest can follow), Send once it is all in (paid at once; its crates go out on
// the tractor), or × to decline it (what was put in goes back); a place whose order was declined counts down to the
// next. The office's two upgrades are its second tab; `office-upgrade` (an upgrade asked for) is the same board with
// the card that asks open. A good's picture says where it is made (src/ui/GoodPic.tsx; its way there:
// ./goods/GoodWays.ts).

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

export function OrdersPanel({ asking = null }: { asking?: OfficeUpgradeId | null }) {
  useFarm((s) => s.rev)
  useSeconds()
  const openPanel = useHome((s) => s.openPanel)
  const close = useHome((s) => s.closePanel)
  return <OrdersBoard v={ordersView()} act={actions} asking={asking} onAsk={(id) => openPanel(id ? { kind: 'office-upgrade', id } : { kind: 'orders' })} onClose={close} />
}
