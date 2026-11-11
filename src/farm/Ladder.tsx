import { farmSound } from '../audio/sound'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import { Coins, Purse, Shell, useArmed } from '../ui/Sheet'
import { art, type ArtId } from '../ui/art'
import { ArrowRight, Check } from '../ui/glyphs'
import { LADDERS, type LadderId } from './data'
import { ladderPrice } from './market'
import { buyLadder, farm, ladderLevel, ladderMaxed, ladderOpen, useFarm } from './state'

// Upgrade ladders (LADDERS in ./data; buyLadder in ./state): one row (its name, what it is now → after the next step,
// its price on the button) and one card that asks before a step is bought, for every ladder — as the office shows its
// upgrades (src/farm/OrdersPanel.tsx, OfficeUpgrade and OfficeUpgradePanel).

/** Each ladder's picture. */
const LADDER_ART: Record<LadderId, ArtId> = { rate: 'coin', places: 'package', group: 'shopping-cart', pace: 'person-running', stock: 'building-construction', discount: 'coin' }

/** What a ladder means now → after its next step (now only, at its top), as two chips that wrap on a narrow screen. */
function Say({ id }: { id: LadderId }) {
  const k = ladderLevel(id)
  const say = LADDERS[id].say
  return (
    <span className="ladder-say">
      <span className="tag">{say(k)}</span>
      {!ladderMaxed(id) && (
        <>
          <ArrowRight weight="bold" className="effect-arrow" />
          <span className="tag">
            <b>{say(k + 1)}</b>
          </span>
        </>
      )}
    </span>
  )
}

/** A ladder as a row: its picture, name, level, now → next, and its price on the button (which opens its card). */
export function LadderRow({ id }: { id: LadderId }) {
  useFarm((s) => s.rev)
  const openPanel = useHome((s) => s.openPanel)
  // the panel this row is on (the manager's, the computer, the contractor's), for its card to go back to
  const kind = useHome((s) => s.panel?.kind)
  const from = kind === 'manager' || kind === 'market' || kind === 'contractor' ? kind : undefined
  const def = LADDERS[id]
  const k = ladderLevel(id)
  const max = ladderMaxed(id)
  const price = ladderPrice(id, k)
  return (
    <div className={`farm-shop-item ladder-row${max ? ' owned' : ''}`}>
      <img className="art" src={art(LADDER_ART[id])} alt="" />
      <div className="farm-shop-text">
        <strong>{def.name}</strong>
        <div className="farm-shop-tags">
          <span className={`tag ${max ? 'ok' : 'level'}`}>{max ? 'Max' : `Level ${k + 1}`}</span>
          <Say id={id} />
        </div>
      </div>
      <button
        className={`btn small${max ? ' soft' : ''}`}
        disabled={max || !ladderOpen(id) || farm.coins < price}
        onClick={() => openPanel({ kind: 'ladder', id, from })}
        aria-label={max ? `${def.name}: done` : `${def.name}, level ${k + 1}, for ${price} coins`}
      >
        {max ? <Check weight="bold" /> : <Coins n={price} />}
      </button>
    </div>
  )
}

/** The card that asks before a ladder's step is bought: its picture, now → after, Not now, and Buy with the price.
 *  Opened from a panel (its `from`), it goes back there; opened from the world (a price tag), it closes. */
export function LadderCard({ id }: { id: LadderId }) {
  useFarm((s) => s.rev)
  const openPanel = useHome((s) => s.openPanel)
  const close = useHome((s) => s.closePanel)
  const from = useHome((s) => (s.panel?.kind === 'ladder' ? s.panel.from : undefined))
  const armed = useArmed()
  const def = LADDERS[id]
  const max = ladderMaxed(id)
  const price = ladderPrice(id, ladderLevel(id))
  const open = ladderOpen(id) && !max
  const afford = open && farm.coins >= price
  const back = () => (from ? openPanel({ kind: from }) : close())
  const confirm = () => {
    if (!armed || !buyLadder(id)) return
    farmSound('build')
    playGesture('interact')
    back()
  }
  return (
    <Shell
      title={def.name}
      art={art(LADDER_ART[id])}
      sub={
        <>
          <Purse />
          <Say id={id} />
        </>
      }
      onClose={close}
    >
      <p className="farm-line">{def.blurb}</p>
      <div className="farm-confirm">
        <button className="btn soft" onClick={back}>
          Not now
        </button>
        <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={!afford} aria-disabled={!armed} onClick={confirm}>
          {max ? (
            <>
              <Check weight="bold" />
              Max
            </>
          ) : afford || !open ? (
            <>
              Buy · <Coins n={price} />
            </>
          ) : (
            <>Needs {price - farm.coins} more</>
          )}
        </button>
      </div>
    </Shell>
  )
}
