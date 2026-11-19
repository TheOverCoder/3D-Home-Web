import { useEffect } from 'react'
import { coarsePointer } from '../../lib/device'
import { useHome } from '../../store'
import { GoodPic } from '../../ui/GoodPic'
import { Coins, Shell } from '../../ui/Sheet'
import { art } from '../../ui/art'
import { Check, Clock, Users, X } from '../../ui/glyphs'
import { acceptOffer, canSell, clockText, declineOffer, fairPrice, farm, inLine, placesInLine, sellAll, sellAllPreview, useFarm, waiting, type Visitor } from '../state'
import { Portrait } from '../../ui/Portrait'
import { Hearts } from '../people/Hearts'
import { heartsOf } from '../people/friends'
import '../people/QueuePeople.css'

/** A pale shirt colour wants a dark number on it. */
const light = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 160
}

function Tag({ v }: { v: Visitor }) {
  const ratio = v.offer / fairPrice(v.want, v.qty)
  const tag = ratio >= 1.15 ? 'generous' : ratio >= 0.9 ? 'fair' : 'low'
  return <span className={`farm-tag ${tag}`}>{tag === 'generous' ? 'Generous' : tag === 'fair' ? 'Fair' : 'Low'}</span>
}

/** The line at the gate: sell to one buyer, to everyone you have enough for, or send someone away. */
export function QueuePanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const line = waiting()
  const coming = inLine().length - line.length
  const all = sellAllPreview()
  const places = placesInLine()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      const front = waiting()
      // (not a letter of WASD: walking away from the panel must never sell anything)
      if (e.key === 'Enter' && e.shiftKey) sellAll()
      else if (e.key === 'Enter' || k === 'y') {
        const v = front.find(canSell)
        if (v) acceptOffer(v.id)
      } else if (k === 'n' || e.key === 'Backspace') {
        if (front[0]) declineOffer(front[0].id)
      } else return
      // the key did its job here: it must not also press whichever button has the focus (it would close the panel)
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const next = farm.started ? (line.length + coming >= places ? 'full' : clockText(farm.nextVisitorIn)) : null
  return (
    <Shell
      title="Buyers"
      art={art('shopping-bags')}
      sub={
        <>
          <span className="tag">
            <Users weight="bold" />
            {line.length}/{places}
          </span>
          {next && (
            <span className="tag">
              <Clock weight="bold" />
              {next === 'full' ? 'line full' : `next ${next}`}
            </span>
          )}
        </>
      }
      onClose={close}
    >
      <button className="primary farm-sell-all" disabled={!all.buyers} onClick={() => sellAll()}>
        {all.buyers ? (
          <>
            Sell to {all.buyers} · <Coins n={all.coins} />
          </>
        ) : (
          'Nothing to sell yet'
        )}
      </button>
      <div className="farm-list farm-queue">
        {line.map((v, i) => {
          const have = farm.inv[v.want]
          const ok = canSell(v)
          return (
            <div key={v.id} className={`farm-buyer${ok ? ' ok' : ''}`}>
              {/* a neighbour: their portrait (the face at the gate) in place of the shirt's colour, as big; their hearts a chip,
                  first among those under their name (a line that wraps: the row keeps to a phone's width) */}
              {v.who ? (
                <Portrait who={v.who} size={30} move={false} />
              ) : (
                <span className="farm-avatar small" style={{ background: v.look.shirt, color: light(v.look.shirt) ? '#1d232c' : '#fff' }} aria-hidden="true">
                  {i + 1}
                </span>
              )}
              <GoodPic good={v.want} count={v.qty} className="farm-want" />
              <div className="farm-buyer-body">
                <strong>{v.name}</strong>
                <span>
                  {v.who && <Hearts n={heartsOf(farm.friends[v.who]?.points ?? 0)} chip />}
                  <span className={`tag ${ok ? 'ok' : 'short'}`} title={`You have ${have}`}>
                    {ok && <Check weight="bold" />}
                    {Math.min(have, v.qty)}/{v.qty}
                  </span>
                  <Tag v={v} />
                  {v.gift && <img className="farm-surprise small" src={art('wrapped-gift')} alt="and a surprise" title="Brings a surprise: a building material" />}
                </span>
              </div>
              <div className="farm-buyer-actions">
                <button className="btn leaf small" disabled={!ok} onClick={() => acceptOffer(v.id)} aria-label={`Sell to ${v.name} for ${v.offer} coins`}>
                  Sell <Coins n={v.offer} />
                </button>
                <button className="btn soft round small" onClick={() => declineOffer(v.id)} aria-label={`Send ${v.name} away`}>
                  <X weight="bold" />
                </button>
              </div>
            </div>
          )
        })}
        {!line.length && <p className="farm-empty">{coming ? 'Someone is on the way.' : 'Nobody waiting.'}</p>}
      </div>
      {!coarsePointer && (
        <p className="farm-keys">
          <kbd>Enter</kbd> sell · <kbd>Shift</kbd>+<kbd>Enter</kbd> sell to all · <kbd>N</kbd> send away
        </p>
      )}
    </Shell>
  )
}
