import { DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree'
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple'
import { UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple'
import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import type { Slot } from '../../../src/farm/state'
import { art } from '../../../src/ui/art'
import { Check, X } from '../../../src/ui/glyphs'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { ITEM, LevelSheet } from '../level/LevelSheet'
import { clear, FarmArt, HoldToClear, play, savedAgo, Star, type SavesState } from './parts'
import './SavesA.css'

// A · a card for each farm: its house, its name, its level's star, its coins and when it was played — a touch on the
// card plays it (an empty place starts a new farm there). Everything else is in its ⋯: save it as a file, load one into
// it, and start it afresh — that one held, not tapped. Its moment: a touch on a card — it sinks, the "Playing" ribbon
// slides onto it from the card that had it; ⋯ unfolds the card's drawer under it; a full hold sweeps the farm off its
// card and a seedling grows in its place.

export function SavesA({ s, act }: { s: SavesState; act: Act<SavesState> }) {
  const [menu, setMenu] = useState<Slot | null>(null)
  const [told, setTold] = useState<string | null>(null)
  return (
    <LevelSheet name="v-saves-a" label="Your farms" onClose={act.close}>
      <m.header className="sa-head" variants={ITEM}>
        <img className="art" src={art('house-with-garden')} alt="" />
        <h2>Your farms</h2>
        <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <m.ul className="sa-list" variants={ITEM}>
        {s.farms.map((f) => {
          const on = f.slot === s.playing
          return (
            <m.li key={f.slot} layout transition={SPRING.sheet} className={`sa-farm${on ? ' on' : ''}${f.exists ? '' : ' empty'}`}>
              <div className="sa-main">
                <m.button
                  className="sa-pick"
                  onClick={() => act.set(play(s, f.slot))}
                  aria-label={f.exists ? `Play Farm ${f.slot}` : `A new farm in place ${f.slot}`}
                  whileTap={{ scale: 0.97, y: 2 }}
                  transition={SPRING.pop}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <m.span
                      key={`${f.exists}`}
                      className="sa-pic"
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ x: -60, opacity: 0, rotate: -20 }}
                      transition={SPRING.soft}
                    >
                      <FarmArt f={f} />
                    </m.span>
                  </AnimatePresence>
                  <span className="sa-text">
                    <b>Farm {f.slot}</b>
                    {f.exists ? (
                      <span className="sa-facts">
                        <Star level={f.level} />
                        <span className="tag">
                          <img src={art('coin')} alt="" />
                          {f.coins.toLocaleString('en-US')}
                        </span>
                        {f.savedAt && <span className="sa-ago">{savedAgo(f)}</span>}
                      </span>
                    ) : (
                      <span className="sa-none">Empty · tap to start a farm</span>
                    )}
                  </span>
                  {on && (
                    <m.span className="sa-ribbon" layoutId="sa-ribbon" transition={SPRING.pop}>
                      Playing
                    </m.span>
                  )}
                </m.button>
                <m.button className="sa-more" {...PRESS} onClick={() => setMenu(menu === f.slot ? null : f.slot)} aria-expanded={menu === f.slot} aria-label={`More for Farm ${f.slot}`}>
                  <DotsThree weight="bold" />
                </m.button>
              </div>
              <AnimatePresence initial={false}>
                {menu === f.slot && (
                  <m.div
                    className="sa-drawer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: EASE.out }}
                  >
                    <div className="sa-acts">
                      <m.button className="btn soft small" disabled={!f.exists} {...PRESS} onClick={() => setTold(`Farm ${f.slot} saved as a file`)}>
                        <DownloadSimple weight="bold" /> Save file
                      </m.button>
                      <m.button className="btn soft small" {...PRESS} onClick={() => setTold(`Choose a farm file for Farm ${f.slot}`)}>
                        <UploadSimple weight="bold" /> Load file
                      </m.button>
                    </div>
                    {f.exists && (
                      <HoldToClear
                        label={`Hold to start Farm ${f.slot} afresh`}
                        onDone={() => {
                          act.set(clear(s, f.slot))
                          setMenu(null)
                          setTold(`Farm ${f.slot} starts afresh`)
                        }}
                      >
                        Hold to start afresh
                      </HoldToClear>
                    )}
                  </m.div>
                )}
              </AnimatePresence>
            </m.li>
          )
        })}
      </m.ul>
      <AnimatePresence>
        {told && (
          <m.p
            key={told}
            className="sa-told"
            role="status"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={SPRING.pop}
            onAnimationComplete={() => setTimeout(() => setTold(null), 1800)}
          >
            <Check weight="bold" /> {told}
          </m.p>
        )}
      </AnimatePresence>
      <m.p className="sa-note" variants={ITEM}>
        Kept on this device. A file keeps a copy.
      </m.p>
    </LevelSheet>
  )
}
