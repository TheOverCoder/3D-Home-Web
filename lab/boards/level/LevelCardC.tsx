import { useEffect, useRef } from 'react'
import type { LevelView } from '../../../src/farm/levelView'
import { art } from '../../../src/ui/art'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { X } from '../../../src/ui/glyphs'
import { Coins } from '../../../src/ui/Shell'
import './LevelCardC.css'

// C · the road: a short road from your level (the chip's star) to the next one, filled as far as the XP has come; the
// next stop carries a small sign of what waits there (a present, or a coin), and from it hangs a card with what it
// brings. Its moment: the road fills, the next stop glows once and its card drops open.

export function LevelCardC({ v, onClaim, onClose }: { v: LevelView; onClaim: (button: HTMLElement) => void; onClose: () => void }) {
  const next = v.level + 1
  const panel = useRef<HTMLDivElement>(null)
  // the sheet itself takes the focus (Tab goes on to its buttons; Esc closes it in the game)
  useEffect(() => panel.current?.focus({ preventScroll: true }), [])
  const part = v.top ? 100 : Math.min(100, (100 * v.into) / v.need)
  const star = (
    <span className="lv-stop lv-now" aria-hidden="true">
      <img className="art" src={art('glowing-star')} alt="" />
      <b className={v.level > 99 ? 'long' : undefined}>{v.level}</b>
      {v.top && <img className="art lv-sign" src={art('trophy')} alt="" />}
    </span>
  )
  return (
    <div className="farm-backdrop v-level-c" onClick={onClose}>
      <div className={`farm-panel${v.top ? ' top' : ''}`} role="dialog" aria-modal="true" aria-label={`Level ${v.level}`} tabIndex={-1} ref={panel} onClick={(e) => e.stopPropagation()}>
        <header className="lv-head">
          <div className="lv-title">
            <h2>Level {v.level}</h2>
            <div className="farm-sub">
              {v.top ? (
                <span className="tag ok">The top level</span>
              ) : (
                <span className="tag">
                  {v.need - v.into} XP to level {next}
                </span>
              )}
            </div>
          </div>
          <button className="close" onClick={onClose} aria-label="Close (Esc)">
            <X weight="bold" />
          </button>
        </header>
        <div className="lv-road" role="progressbar" aria-label={`Level ${v.level}: XP to level ${next}`} aria-valuemin={0} aria-valuemax={v.need} aria-valuenow={v.into}>
          {v.top ? (
            <>
              <span className="lv-seg">
                <span className="lv-fill" style={{ width: '100%' }} />
              </span>
              {star}
            </>
          ) : (
            <>
              {star}
              <span className="lv-seg">
                <span className="lv-fill" style={{ width: `${part}%` }} />
              </span>
              <span className={`lv-stop lv-next${v.gift ? ' gift' : ''}`} aria-hidden="true">
                <b>{next}</b>
                <img className="art lv-sign" src={art(v.gift ? 'wrapped-gift' : 'coin')} alt="" />
              </span>
              <span className="lv-tail" aria-hidden="true" />
            </>
          )}
        </div>
        {!v.top && (
          <section className={`level-next lv-card${v.gift ? ' gift' : ''}`} aria-label={`What level ${next} brings`}>
            <h3>Level {next} brings</h3>
            <div className="lv-items">
              {v.gift && (
                <div className="lv-gift">
                  <GarmentPic g={v.gift} />
                  <span>
                    <b>{v.gift.name}</b>
                    <span className="tag ok">New garment</span>
                  </span>
                </div>
              )}
              <div className="lv-coins">
                <img className="art" src={art('coin')} alt="" />
                <span>
                  <b>+{v.nextCoins}</b>
                  <small>coins</small>
                </span>
              </div>
            </div>
          </section>
        )}
        {v.later && (
          <p className="level-later">
            <GarmentPic g={v.later} />
            <span>
              Next garment at <b>level {v.later.level}</b>
            </span>
          </p>
        )}
        {v.unpaid > 0 && (
          <div className="farm-confirm">
            <button className="btn soft" onClick={onClose}>
              Cancel
            </button>
            <button className="btn leaf farm-buy" onClick={(e) => onClaim(e.currentTarget)} aria-label={`Claim ${v.unpaid} coins`}>
              Claim <Coins n={v.unpaid} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
