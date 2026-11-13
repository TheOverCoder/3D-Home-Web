import { useEffect, useRef } from 'react'
import type { LevelView } from '../../../src/farm/levelView'
import { art } from '../../../src/ui/art'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { X } from '../../../src/ui/glyphs'
import { Coins } from '../../../src/ui/Shell'
import './LevelCardB.css'

// B · the showcase: what the next level brings is the hero — the garment big on a sunny stage under a ribbon "At level
// N", its coins a sticker beside it — and right under the stage the XP still needed to get it. The level itself is
// the small title above. Its moment: the rays turn once and the garment bounces in, as when it is won.

export function LevelCardB({ v, onClaim, onClose }: { v: LevelView; onClaim: (button: HTMLElement) => void; onClose: () => void }) {
  const next = v.level + 1
  const panel = useRef<HTMLDivElement>(null)
  // the sheet itself takes the focus (Tab goes on to its buttons; Esc closes it in the game)
  useEffect(() => panel.current?.focus({ preventScroll: true }), [])
  const part = v.top ? 100 : Math.min(100, (100 * v.into) / v.need)
  const rays = <span className="lv-rays" aria-hidden="true" />
  return (
    <div className="farm-backdrop v-level-b" onClick={onClose}>
      <div className={`farm-panel${v.top ? ' top' : ''}`} role="dialog" aria-modal="true" aria-label={`Level ${v.level}`} tabIndex={-1} ref={panel} onClick={(e) => e.stopPropagation()}>
        <header className="lv-head">
          <span className="lv-star" aria-hidden="true">
            <img className="art" src={art('glowing-star')} alt="" />
            <b>{v.level}</b>
          </span>
          <h2>Level {v.level}</h2>
          <button className="close" onClick={onClose} aria-label="Close (Esc)">
            <X weight="bold" />
          </button>
        </header>
        <div className="lv-show">
          {v.top ? (
            <div className="lv-stage">
              <div className="lv-prize">
                {rays}
                <img className="art lv-trophy" src={art('trophy')} alt="" />
              </div>
            </div>
          ) : (
            <section className={`level-next lv-stage${v.gift ? ' gift' : ''}`} aria-label={`What level ${next} brings`}>
              <h3 className="lv-ribbon">At level {next}</h3>
              {v.gift ? (
                <>
                  <div className="lv-prize">
                    {rays}
                    <GarmentPic g={v.gift} />
                  </div>
                  <div className="lv-caption">
                    <b>{v.gift.name}</b>
                    <span className="tag ok">New garment</span>
                  </div>
                  <span className="lv-sticker">
                    <img className="art" src={art('coin')} alt="" />
                    <b>+{v.nextCoins}</b>
                  </span>
                </>
              ) : (
                <div className="lv-prize lv-coins">
                  {rays}
                  <img className="art" src={art('coin')} alt="" />
                  <span>
                    <b>+{v.nextCoins}</b>
                    <small>coins</small>
                  </span>
                </div>
              )}
            </section>
          )}
          <div className="lv-meter">
            <div className="lv-bar" role="progressbar" aria-label={`Level ${v.level}: XP to level ${next}`} aria-valuemin={0} aria-valuemax={v.need} aria-valuenow={v.into}>
              <span style={{ width: `${part}%` }} />
            </div>
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
        </div>
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
