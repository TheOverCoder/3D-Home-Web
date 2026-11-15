import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple'
import { UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple'
import { AnimatePresence, m } from 'motion/react'
import { ToggleGroup } from 'radix-ui'
import { useState } from 'react'
import type { Slot } from '../../../src/farm/state'
import { art } from '../../../src/ui/art'
import { ArrowRight, X } from '../../../src/ui/glyphs'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { ITEM, LevelSheet } from '../level/LevelSheet'
import { FARM_NAMES } from '../intro/data'
import photoWide from '../../stills/yard-clean-sideways.jpg'
import { clear, FarmArt, HoldToClear, play, savedAgo, Star, type SavesState } from './parts'
import './SavesC.css'

// C · one farm at a time, in full (chosen; round 3 polishes it into the reference): three tabs at the top (Farm 1 · 2 ·
// 3, each with its level's star, a green dot on the one being played), and under them the chosen farm as a card of
// pictures with numbers — its level, its coins, the beds growing, its animals, "Playing now" on the one being played —
// then one big Play, and quieter, its file and the hold to start afresh. An empty place says so in a picture and a
// chip (a new farm, with the coins it starts with). Sideways the card on the left, the presses on the right. Its
// moments: a tab — the highlight slides to it and the card turns over to that farm; Play — the house hops and the sheet
// goes, into that farm; a full hold — the red fill runs across, and the card turns over to an empty place.
//
// D is C with features the game does not have (`extras`): each farm's card shows a photo of the farm as it was last
// saved instead of the house picture, and its own name (the opening screen's D gives it).

/** SAMPLE (D): a photo of each farm as it was last saved — the lab has one still of the yard, cropped and tinted
 *  differently for each place; the game would take one from its own view when it saves. */
const PHOTO: Record<number, { at: string; tint: string }> = {
  1: { at: '30% 62%', tint: 'none' },
  2: { at: '72% 48%', tint: 'saturate(1.25) hue-rotate(-8deg)' },
  3: { at: '50% 85%', tint: 'sepia(0.35) saturate(1.2)' },
}

export function SavesC({ s, act, extras = false }: { s: SavesState; act: Act<SavesState>; extras?: boolean }) {
  const [pick, setPick] = useState<Slot>(s.playing)
  const [going, setGoing] = useState(false)
  const f = s.farms.find((x) => x.slot === pick) ?? s.farms[0]
  const name = (slot: Slot, exists: boolean) => (extras && exists ? FARM_NAMES[slot] : `Farm ${slot}`)
  const go = () => {
    if (going) return
    setGoing(true)
    act.set(play(s, f.slot))
    setTimeout(act.close, 320)
  }
  return (
    <LevelSheet name={`v-saves-c${extras ? ' v-saves-d' : ''}`} label="Your farms" onClose={act.close}>
      <m.header className="sc-head" variants={ITEM}>
        <h2>Your farms</h2>
        <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <m.div variants={ITEM}>
        <ToggleGroup.Root className="sc-tabs" type="single" value={String(pick)} onValueChange={(v) => v && setPick(Number(v) as Slot)} aria-label="Your farms">
          {s.farms.map((x) => (
            <ToggleGroup.Item key={x.slot} value={String(x.slot)} className="sc-tab" aria-label={`Farm ${x.slot}`}>
              {x.slot === pick && <m.span className="sc-tab-on" layoutId="sc-tab-on" transition={SPRING.pop} />}
              <span className="sc-tab-in">
                {x.exists ? <Star level={x.level} /> : <img className="art sc-seed" src={art('seedling')} alt="" />}
                <b>{extras && x.exists ? FARM_NAMES[x.slot].split(' ')[0] : `Farm ${x.slot}`}</b>
                {x.slot === s.playing && <i className="sc-dot" aria-label="playing" />}
              </span>
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </m.div>
      <div className="sc-body">
        <AnimatePresence mode="popLayout" initial={false}>
          <m.section
            key={`${f.slot}-${f.exists}`}
            className={`sc-card${f.exists ? '' : ' empty'}`}
            initial={{ opacity: 0, rotateY: -40 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: 40 }}
            transition={{ duration: 0.28, ease: EASE.out }}
            style={{ transformPerspective: 800 }}
          >
            {extras && f.exists ? (
              <span className="sd-photo">
                <img src={photoWide} alt={`${name(f.slot, true)}, as it was last saved`} style={{ objectPosition: PHOTO[f.slot].at, filter: PHOTO[f.slot].tint }} />
                <b>{name(f.slot, true)}</b>
              </span>
            ) : (
              <m.span className="sc-pic-wrap" animate={going ? { y: [0, -18, 0], scale: [1, 1.08, 1] } : undefined} transition={{ duration: 0.32, ease: EASE.out }}>
                <FarmArt f={f} className="sc-pic" />
              </m.span>
            )}
            {f.exists ? (
              <>
                <p className="sc-when">
                  {f.slot === s.playing && <span className="tag ok sc-now">Playing now</span>}
                  {f.savedAt ? `Played ${savedAgo(f)} ago` : 'Not played yet'}
                </p>
                <ul className="sc-stats">
                  <li>
                    <Star level={f.level} />
                    <span>
                      <b>{f.level}</b> level
                    </span>
                  </li>
                  <li>
                    <img className="art" src={art('coin')} alt="" />
                    <span>
                      <b>{f.coins.toLocaleString('en-US')}</b> coins
                    </span>
                  </li>
                  <li>
                    <img className="art" src={art('seedling')} alt="" />
                    <span>
                      <b>{f.growing}</b> beds growing
                    </span>
                  </li>
                  <li>
                    <img className="art" src={art('chicken')} alt="" />
                    <span>
                      <b>{f.animals}</b> animals
                    </span>
                  </li>
                </ul>
              </>
            ) : (
              <div className="sc-empty">
                <b>An empty place</b>
                <span className="tag">
                  <img src={art('coin')} alt="" />
                  {f.coins} to start a new farm
                </span>
              </div>
            )}
          </m.section>
        </AnimatePresence>
        <div className="sc-acts">
          <m.button className="btn primary sc-go" whileTap={{ scale: 0.96, y: 3 }} transition={SPRING.pop} onClick={go}>
            {f.exists ? (f.slot === s.playing ? 'Keep playing' : `Play ${name(f.slot, true)}`) : 'Start this farm'}
            <ArrowRight weight="bold" />
          </m.button>
          <div className="sc-quiet">
            <m.button className="btn soft small" disabled={!f.exists} {...PRESS}>
              <DownloadSimple weight="bold" /> Save file
            </m.button>
            <m.button className="btn soft small" {...PRESS}>
              <UploadSimple weight="bold" /> Load file
            </m.button>
          </div>
          {f.exists && (
            <HoldToClear label={`Hold to start ${name(f.slot, true)} afresh`} onDone={() => act.set(clear(s, f.slot))}>
              Hold to start afresh
            </HoldToClear>
          )}
        </div>
      </div>
    </LevelSheet>
  )
}
