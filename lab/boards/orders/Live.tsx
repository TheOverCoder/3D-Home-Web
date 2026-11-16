import { useState } from 'react'
import type { OfficeUpgradeId } from '../../../src/farm/data'
import { OrdersBoard } from '../../../src/farm/orderBoard/OrdersBoard'
import type { OrdersActions } from '../../../src/farm/orderBoard/view'
import type { Act } from '../../board'
import { buyOffice, decline, putIn, send, viewOf, type OrdersState } from './data'

// The order board as the game has it (src/farm/orderBoard/OrdersBoard.tsx, E of round 3, chosen), fed with the
// board's sample data instead of the farm: its presses do here what the farm's do there (./data.tsx). The card that
// asks for an office upgrade is the game's `office-upgrade` panel there; here, a state of this frame. "Show me" walks
// you to where a good is made there; here it only closes the board.

export function Live({ s, act }: { s: OrdersState; act: Act<OrdersState> }) {
  const [asking, setAsking] = useState<OfficeUpgradeId | null>(null)
  const acts: OrdersActions = {
    put: (k) => {
      const [next, n] = putIn(s, k)
      if (n) act.set(next)
      return n
    },
    send: (k) => {
      const next = send(s, k)
      if (next === s) return false
      act.set(next)
      return true
    },
    decline: (k) => {
      const next = decline(s, k)
      if (next === s) return false
      act.set(next)
      return true
    },
    buy: (id) => {
      const next = buyOffice(s, id)
      if (next === s) return false
      act.set(next)
      return true
    },
    // "Show me": in the game the board closes and you walk to where the good is made; here it closes (and opens again)
    show: () => act.close(),
    canShow: () => true,
  }
  return <OrdersBoard v={viewOf(s)} act={acts} asking={asking} onAsk={setAsking} onClose={act.close} />
}
