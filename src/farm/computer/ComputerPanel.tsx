import { useEffect, useState } from 'react'
import { farmSound, uiClick } from '../../audio/sound'
import { farmFx } from '../../fx/fx'
import { debugSet } from '../../lib/debug'
import { PIECES } from '../../home/catalogue'
import { deskOf, hasComputer, spotNear } from './place'
import { footprint } from '../../home/layout'
import { pieceUrl } from '../../home/pictures'
import { useHome } from '../../store'
import { PanelSheet } from '../../ui/PanelSheet'
import { Purse, useArmed } from '../../ui/Sheet'
import { phaseOf, hourOf } from '../day'
import { priceOf } from '../prices'
import { buyPiece, farm, ledgerNow, placeStored, useFarm } from '../state'
import { bookView } from './bookView'
import { ComputerDesk, type DeskView } from './ComputerDesk'
import { marketView } from './marketView'
import { computerNow } from './now'
import { planView } from './planView'
import { todayView } from './todayView'

// The house's computer, open (src/home/Computer.tsx; update-v1 mission 09): its desktop and apps drawn from the farm
// as it is now (./ComputerDesk.tsx draws, this reads), and the card the studio desk's price tag opens, which asks
// before the computer is bought and stands it by the desk. Every price it shows is the one a sale would take now: the
// views are worked out by the game's own rules (./marketView.ts), the market's mood judged on the day every sale
// judges it.

const deviceTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

/** Everything the desktop shows, from the farm now. */
export function deskView(): DeskView {
  const now = computerNow()
  const market = marketView(farm, now)
  const plan = planView(farm, now)
  const h = hourOf(farm.day.t)
  return {
    market,
    plan,
    book: bookView(ledgerNow(), now.day),
    today: todayView(market, plan),
    coins: farm.coins,
    day: now.day,
    clock: { device: deviceTime.format(Date.now()), farm: `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`, phase: phaseOf(farm.day.t) },
  }
}

export function ComputerPanel({ piece, buy }: { piece: string; buy?: boolean }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  // (?debug: what the computer shows, and what a sale takes, read together by the tests)
  useEffect(() => debugSet('computer', { view: deskView, price: priceOf, now: computerNow }), [])
  if (buy) return <BuyComputer desk={piece} onClose={close} />
  return <ComputerDesk v={deskView()} onClose={close} />
}

/** The desk's price tag's card: the computer, its price, Cancel or Buy (armed a moment after it opens). Bought, it
 *  stands at the free spot nearest the desk; with no room there it waits in storage (the toast says so). */
function BuyComputer({ desk, onClose }: { desk: string; onClose: () => void }) {
  const armed = useArmed()
  const [closing, setClosing] = useState(false)
  const price = PIECES.computer.price
  const afford = farm.coins >= price
  const owned = hasComputer(farm.home)
  const buy = () => {
    if (!armed || !afford || owned || !buyPiece('computer')) return
    const near = farm.home.pieces.find((p) => p.id === desk) ?? deskOf(farm.home)
    const spot = near && spotNear(farm.home, near)
    const r = spot ? placeStored('computer', spot) : null
    const placed = r?.ok && r.id ? farm.home.pieces.find((p) => p.id === r.id) : null
    if (placed) {
      const b = footprint(placed)
      farmFx('dust', (b.minX + b.maxX) / 2, 0.03, (b.minZ + b.maxZ) / 2, { half: { x: (b.maxX - b.minX) / 2, z: (b.maxZ - b.minZ) / 2 } })
    }
    farmSound('build', 0, 1)
    useHome.getState().showToast(placed ? 'Your computer stands by the desk' : 'Bought — it waits in storage: no room by the desk')
    setClosing(true)
  }
  return (
    <PanelSheet
      size="card"
      label="Buy a computer"
      title="Computer"
      pic={pieceUrl('computer')}
      sub={<Purse />}
      className="pc-buy"
      closing={closing}
      onClose={onClose}
      foot={{
        cancel: {
          label: 'Cancel',
          onPress: () => {
            uiClick()
            setClosing(true)
          },
        },
        action: afford ? { label: 'Buy', price, onPress: buy, disabled: owned } : { label: `Needs ${price - farm.coins} more`, onPress: () => {}, disabled: true },
      }}
    >
      <p className={`farm-line${armed ? '' : ' arming'}`}>Today&apos;s prices, what to grow, and your sales, at home.</p>
    </PanelSheet>
  )
}
