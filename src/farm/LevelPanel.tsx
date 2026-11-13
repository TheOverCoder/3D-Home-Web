import { flyCoins } from '../fx/coins'
import { coinsToFly, reducedMotion } from '../fx/fx'
import { GarmentPic } from '../home/WardrobePanel'
import { useHome } from '../store'
import { art } from '../ui/art'
import { Coins, Shell } from '../ui/Sheet'
import { garmentAt, nextGarment } from './outfit'
import { claimLevel, farm, useFarm } from './state'
import { levelProgress, levelReward, unpaidCoins } from './xp'

// The level's card (the level chip at the top opens it): how much XP is left to the next level, and what that level
// brings — its coins, and a garment for the wardrobe every fifth level, shown big so it is plain that it comes next.
// When the next garment is further off, which level brings it. The coins of the levels reached are claimed here.

export function LevelPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const { level, into, need, top } = levelProgress(farm.xp.points)
  const unpaid = unpaidCoins(farm.xp)
  const next = level + 1
  const gift = top ? undefined : garmentAt(next)
  const later = gift ? undefined : nextGarment(level)
  const claim = (button: HTMLElement) => {
    const r = button.getBoundingClientRect()
    const coins = claimLevel()
    if (coins > 0 && !reducedMotion()) flyCoins(r.left + r.width / 2, r.top + r.height / 2, coinsToFly(coins))
  }
  return (
    <Shell
      title={`Level ${level}`}
      art={art('glowing-star')}
      sub={
        top ? (
          <span className="tag ok">The top level</span>
        ) : (
          <span className="tag">
            {need - into} XP to level {next}
          </span>
        )
      }
      onClose={close}
    >
      <div className="level-card-bar" role="progressbar" aria-label={`Level ${level}: XP to level ${next}`} aria-valuemin={0} aria-valuemax={need} aria-valuenow={into}>
        <span style={{ width: `${(100 * into) / need}%` }} />
      </div>
      {!top && (
        <section className={`level-next${gift ? ' gift' : ''}`} aria-label={`What level ${next} brings`}>
          <h3>At level {next}</h3>
          <div className="level-rewards">
            {gift && (
              <div className="level-gift">
                <GarmentPic g={gift} />
                <span>
                  <b>{gift.name}</b>
                  <span className="tag ok">New garment</span>
                </span>
              </div>
            )}
            <span className="level-coins">
              <img className="art" src={art('coin')} alt="" />+{levelReward(next)}
            </span>
          </div>
        </section>
      )}
      {later && (
        <p className="level-later">
          <GarmentPic g={later} />
          <span>
            Next garment at <b>level {later.level}</b>
          </span>
        </p>
      )}
      {unpaid > 0 && (
        <div className="farm-confirm">
          <button className="btn soft" onClick={close}>
            Cancel
          </button>
          <button className="btn leaf farm-buy" onClick={(e) => claim(e.currentTarget)} aria-label={`Claim ${unpaid} coins`}>
            Claim <Coins n={unpaid} />
          </button>
        </div>
      )}
    </Shell>
  )
}
