import { useState } from 'react'
import type { Act } from '../../board'
import { Behind } from '../animal-tools/parts'
import { order, type OrdersState } from '../orders/data'
import { Live } from '../orders/Live'
import type { RemoteState } from './data'

// Today: the only "where is it made" in the game is the order board's bubble (src/farm/orderBoard/OrdersBoard.tsx):
// a good of an order tapped says its name, how many are in, what the store holds and where it comes from, with "Show
// me" (it walks you there) when the store has too few. Nowhere else; no remote. Here the game's own board with an
// order that wants flour, eggs and milk: tap a good to see its bubble.

const ORDERS: OrdersState = {
  slots: [
    {
      order: order([
        ['flour', 3, 0],
        ['egg', 4, 4],
        ['milk', 2, 1],
      ]),
    },
    { order: order([['wool', 2, 0]]) },
    { wait: 300 },
  ],
  inv: { flour: 0, egg: 12, milk: 1, wool: 0 },
  office: { slots: 0, wait: 0 },
  coins: 2400,
}

export function PremiumRemotesToday({ s, act }: { s: RemoteState; act: Act<RemoteState> }) {
  const [o, setO] = useState(ORDERS)
  return (
    <>
      <Behind coins={s.coins} level={14} />
      <Live s={o} act={{ set: setO, close: act.close }} />
    </>
  )
}
