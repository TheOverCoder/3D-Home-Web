import { art } from '../ui/art'
import { GarmentPic } from '../ui/GarmentPic'
import { Coins, Shell } from '../ui/Shell'
import type { LevelView } from './levelView'

// How the level's card looks (the design layer: the design lab, lab/, shows it with no game round it). What it shows
// is ./levelView.ts, made from the farm's XP by ./LevelPanel.tsx.

export function LevelCard({ v, onClaim, onClose }: { v: LevelView; onClaim: (button: HTMLElement) => void; onClose: () => void }) {
  const next = v.level + 1
  return (
    <Shell
      title={`Level ${v.level}`}
      art={art('glowing-star')}
      sub={
        v.top ? (
          <span className="tag ok">The top level</span>
        ) : (
          <span className="tag">
            {v.need - v.into} XP to level {next}
          </span>
        )
      }
      onClose={onClose}
    >
      <div className="level-card-bar" role="progressbar" aria-label={`Level ${v.level}: XP to level ${next}`} aria-valuemin={0} aria-valuemax={v.need} aria-valuenow={v.into}>
        <span style={{ width: `${(100 * v.into) / v.need}%` }} />
      </div>
      {!v.top && (
        <section className={`level-next${v.gift ? ' gift' : ''}`} aria-label={`What level ${next} brings`}>
          <h3>At level {next}</h3>
          <div className="level-rewards">
            {v.gift && (
              <div className="level-gift">
                <GarmentPic g={v.gift} />
                <span>
                  <b>{v.gift.name}</b>
                  <span className="tag ok">New garment</span>
                </span>
              </div>
            )}
            <span className="level-coins">
              <img className="art" src={art('coin')} alt="" />+{v.nextCoins}
            </span>
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
    </Shell>
  )
}
