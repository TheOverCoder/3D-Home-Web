import { useEffect, useRef } from 'react'
import type { LevelView } from '../../../src/farm/levelView'
import { art } from '../../../src/ui/art'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { X } from '../../../src/ui/glyphs'
import { Coins } from '../../../src/ui/Shell'
import './LevelCardA.css'

// A · the medal: the level's star from the chip, big, in a ring that is the XP into this level, everything centred;
// what the next level brings as tiles side by side, the garment the big one. Its moment: the ring fills as it opens.
// Sideways, the medal on the left and what the next level brings beside it, the buttons across under both.

export function LevelCardA({ v, onClaim, onClose }: { v: LevelView; onClaim: (button: HTMLElement) => void; onClose: () => void }) {
  const next = v.level + 1
  const panel = useRef<HTMLDivElement>(null)
  // the sheet itself takes the focus (Tab goes on to its buttons; Esc closes it in the game)
  useEffect(() => panel.current?.focus({ preventScroll: true }), [])
  const part = v.top ? 100 : Math.min(100, (100 * v.into) / v.need)
  return (
    <div className="farm-backdrop v-level-a" onClick={onClose}>
      <div className={`farm-panel${v.top ? ' top' : ''}`} role="dialog" aria-modal="true" aria-label={`Level ${v.level}`} tabIndex={-1} ref={panel} onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close (Esc)">
          <X weight="bold" />
        </button>
        <div className="lv-hero">
          <div className="lv-medal" role="progressbar" aria-label={`Level ${v.level}: XP to level ${next}`} aria-valuemin={0} aria-valuemax={v.need} aria-valuenow={v.into}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <defs>
                <linearGradient id="v-level-a-xp" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#a48bff" />
                  <stop offset="1" stopColor="#6a4be6" />
                </linearGradient>
              </defs>
              <circle className="lv-track" cx="60" cy="60" r="54" />
              <circle className="lv-fill" cx="60" cy="60" r="54" pathLength={100} style={{ strokeDashoffset: 100 - part }} />
            </svg>
            <img className="art" src={art('glowing-star')} alt="" />
            <b className={v.level > 99 ? 'long' : undefined}>{v.level}</b>
          </div>
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
        {!v.top && (
          <div className="lv-side">
            <section className={`level-next${v.gift ? ' gift' : ''}`} aria-label={`What level ${next} brings`}>
              <h3>Level {next} brings</h3>
              <div className={`lv-tiles${v.gift ? '' : ' solo'}`}>
                {v.gift && (
                  <div className="lv-tile lv-gift">
                    <GarmentPic g={v.gift} />
                    <b>{v.gift.name}</b>
                    <span className="tag ok">New garment</span>
                  </div>
                )}
                <div className="lv-tile lv-coins">
                  <img className="art" src={art('coin')} alt="" />
                  <span>
                    <b>+{v.nextCoins}</b>
                    <small>coins</small>
                  </span>
                </div>
              </div>
            </section>
            {v.later && (
              <p className="level-later">
                <GarmentPic g={v.later} />
                <span>
                  Next garment at <b>level {v.later.level}</b>
                </span>
              </p>
            )}
          </div>
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
