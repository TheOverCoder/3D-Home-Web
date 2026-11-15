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
import { clear, FarmArt, HoldToClear, play, savedAgo, Star, type SavesState } from './parts'
import './SavesC.css'

// C · one farm at a time, in full: three tabs at the top (Farm 1 · 2 · 3, each with its level's star), and under them
// the chosen farm as a card of pictures with numbers — its level, its coins, the beds growing, its animals — then
// one big Play, and quieter, its file and the hold to start afresh. Sideways the card on the left, the
// presses on the right. Its moment: a tab — the highlight slides to it and the card turns over to that farm.

export function SavesC({ s, act }: { s: SavesState; act: Act<SavesState> }) {
  const [pick, setPick] = useState<Slot>(s.playing)
  const f = s.farms.find((x) => x.slot === pick) ?? s.farms[0]
  return (
    <LevelSheet name="v-saves-c" label="Your farms" onClose={act.close}>
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
                <b>Farm {x.slot}</b>
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
            <FarmArt f={f} className="sc-pic" />
            {f.exists ? (
              <>
                <p className="sc-when">{f.savedAt ? `Played ${savedAgo(f)} ago` : 'Not played yet'}</p>
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
              <p className="sc-empty">An empty place: a new farm starts here, with {f.coins} coins.</p>
            )}
          </m.section>
        </AnimatePresence>
        <div className="sc-acts">
          <m.button className="btn primary sc-go" whileTap={{ scale: 0.96, y: 3 }} transition={SPRING.pop} onClick={() => act.set(play(s, f.slot))}>
            {f.exists ? (f.slot === s.playing ? 'Keep playing' : `Play Farm ${f.slot}`) : 'Start this farm'}
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
            <HoldToClear label={`Hold to start Farm ${f.slot} afresh`} onDone={() => act.set(clear(s, f.slot))}>
              Hold to start afresh
            </HoldToClear>
          )}
        </div>
      </div>
    </LevelSheet>
  )
}
