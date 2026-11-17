import { farmSound } from '../audio/sound'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import { Coins, Purse, Shell, useArmed } from '../ui/Sheet'
import { art, type ArtId } from '../ui/art'
import { ArrowRight, Check, Crown } from '../ui/glyphs'
import { LADDERS, TOOLS, type LadderId } from './data'
import { ladderPrice } from './market'
import { buyWithFilm } from '../film/films'
import { farm, ladderLevel, ladderMaxed, ladderOpen, useFarm } from './state'

// Upgrade ladders (LADDERS in ./data; buyLadder in ./state): one row (its name, what it is now → after the next step,
// its price on the button) and one card that asks before a step is bought, for every ladder — as the office shows its
// upgrades (src/farm/orderBoard/OrdersBoard.tsx, OfficeUpgrade and OfficeCard).

/** Each ladder's picture: a tool's three its tool's, the premium remotes what they open (the crown is on their card). */
const LADDER_ART: Partial<Record<LadderId, ArtId>> = {
  rate: 'coin',
  places: 'package',
  group: 'shopping-cart',
  pace: 'person-running',
  stock: 'building-construction',
  discount: 'coin',
  'machine-remote': 'gear',
  'animal-remote': 'nest-with-eggs',
}
const ladderArt = (id: LadderId): ArtId => {
  const def = LADDERS[id]
  return def.tool ? TOOLS[def.tool.kind].art : (LADDER_ART[id] ?? 'crown')
}

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
  const from = useHome((s) => s.panel) ?? undefined
  const def = LADDERS[id]
  const k = ladderLevel(id)
  const max = ladderMaxed(id)
  const price = ladderPrice(id, k)
  return (
    <div className={`farm-shop-item ladder-row${max ? ' owned' : ''}`}>
      <img className="art" src={art(ladderArt(id))} alt="" />
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
 *  Opened from a panel (its `from`), it goes back there; opened from the world (a price tag), it closes; over a panel
 *  that keeps it (a tool's upgrades: `onBack`), it goes away and leaves the panel be. A premium ladder (a remote) is
 *  in night velvet, a crown on its chip and its Buy. */
export function LadderCard({ id, onBack }: { id: LadderId; onBack?: () => void }) {
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
  const back = () => (onBack ? onBack() : from ? openPanel(from) : close())
  const premium = !!def.premium
  const confirm = () => {
    // (a tool's own step plays its build film: src/film/films.ts)
    if (!armed || !buyWithFilm(id)) return
    farmSound('build')
    playGesture('interact')
    back()
  }
  return (
    <Shell
      title={def.name}
      art={art(ladderArt(id))}
      className={`ladder-card${premium ? ' premium' : ''}`}
      sub={
        <>
          <Purse />
          {premium ? (
            <span className="tag velvet">
              <Crown weight="fill" className="crown" />
              Premium
            </span>
          ) : (
            <Say id={id} />
          )}
        </>
      }
      onClose={onBack ?? close}
    >
      <p className="farm-line">{def.blurb}</p>
      <div className="farm-confirm">
        <button className="btn soft" onClick={back}>
          Not now
        </button>
        <button className={`btn farm-buy${premium ? ' velvet' : ''}${armed ? '' : ' arming'}`} disabled={!afford} aria-disabled={!armed} onClick={confirm}>
          {max ? (
            <>
              <Check weight="bold" />
              Max
            </>
          ) : afford || !open ? (
            <>
              Buy ·{' '}
              {premium ? (
                <span className="farm-coins">
                  <img src={art('coin')} alt="" />
                  {price.toLocaleString('en-US')}
                </span>
              ) : (
                <Coins n={price} />
              )}
            </>
          ) : (
            <>Needs {price - farm.coins} more</>
          )}
        </button>
      </div>
    </Shell>
  )
}
