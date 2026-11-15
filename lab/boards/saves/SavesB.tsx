import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple'
import { UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple'
import { AnimatePresence, m } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Slot } from '../../../src/farm/state'
import { art } from '../../../src/ui/art'
import { ArrowRight, X } from '../../../src/ui/glyphs'
import { PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { ITEM, LevelSheet } from '../level/LevelSheet'
import { clear, FarmArt, HoldToClear, play, savedAgo, Star, type SavesState } from './parts'
import './SavesB.css'

// B · postcards: each farm a big postcard in a row you slide through (the next one peeks at the edge), its house on a
// sunny picture, its level, coins and when it was played. Under the row, for the card in front: one big button (Play
// Farm 2, or Start a new farm), and the quieter ones — save as a file, load a file, and hold to start afresh. Its
// moment: sliding — the card in front grows a little and lights, the others step back; a full hold makes the house
// fly off the card and a seedling sprout.

export function SavesB({ s, act }: { s: SavesState; act: Act<SavesState> }) {
  const [front, setFront] = useState<Slot>(s.playing)
  const row = useRef<HTMLDivElement>(null)
  const f = s.farms.find((x) => x.slot === front) ?? s.farms[0]
  // the card in front follows the slide
  const onScroll = () => {
    const el = row.current
    if (!el) return
    const cards = [...el.children] as HTMLElement[]
    const mid = el.scrollLeft + el.clientWidth / 2
    let best = cards[0]
    for (const c of cards) if (Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - mid)) best = c
    const slot = Number(best.dataset.slot) as Slot
    if (slot !== front) setFront(slot)
  }
  // the row alone slides (scrollIntoView would move the sheet too)
  const centre = (slot: Slot, smooth: boolean) => {
    const el = row.current
    const card = el?.querySelector<HTMLElement>(`[data-slot="${slot}"]`)
    if (!el || !card) return
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' })
  }
  const bring = (slot: Slot) => {
    centre(slot, true)
    setFront(slot)
  }
  useEffect(() => {
    centre(s.playing, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <LevelSheet name="v-saves-b" label="Your farms" onClose={act.close}>
      <m.header className="sb-head" variants={ITEM}>
        <h2>Your farms</h2>
        <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <m.div className="sb-row" ref={row} onScroll={onScroll} variants={ITEM}>
        {s.farms.map((x) => (
          <m.button
            key={x.slot}
            data-slot={x.slot}
            className={`sb-card${x.slot === front ? ' front' : ''}${x.exists ? '' : ' empty'}`}
            onClick={() => bring(x.slot)}
            animate={{ scale: x.slot === front ? 1 : 0.92, opacity: x.slot === front ? 1 : 0.75 }}
            transition={SPRING.pop}
            aria-label={x.exists ? `Farm ${x.slot}, level ${x.level}` : `Place ${x.slot}, empty`}
          >
            <span className="sb-sky">
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                  key={`${x.exists}`}
                  className="sb-house"
                  initial={{ scale: 0.2, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ y: -80, x: 60, rotate: 30, opacity: 0 }}
                  transition={SPRING.soft}
                >
                  <FarmArt f={x} />
                </m.span>
              </AnimatePresence>
              {x.slot === s.playing && <span className="sb-playing">Playing</span>}
            </span>
            <span className="sb-foot">
              <b>Farm {x.slot}</b>
              {x.exists ? (
                <span className="sb-facts">
                  <Star level={x.level} />
                  <span className="tag">
                    <img src={art('coin')} alt="" />
                    {x.coins.toLocaleString('en-US')}
                  </span>
                </span>
              ) : (
                <span className="sb-none">Empty</span>
              )}
              {x.savedAt && <small>{savedAgo(x)}</small>}
            </span>
          </m.button>
        ))}
      </m.div>
      <m.div className="sb-dots" variants={ITEM} aria-hidden="true">
        {s.farms.map((x) => (
          <i key={x.slot} className={x.slot === front ? 'on' : ''} />
        ))}
      </m.div>
      <m.div className="sb-acts" variants={ITEM}>
        <m.button className="btn primary sb-go" whileTap={{ scale: 0.96, y: 3 }} transition={SPRING.pop} onClick={() => act.set(play(s, f.slot))}>
          {f.exists ? (f.slot === s.playing ? `Back to Farm ${f.slot}` : `Play Farm ${f.slot}`) : 'Start a new farm'}
          <ArrowRight weight="bold" />
        </m.button>
        <div className="sb-quiet">
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
      </m.div>
    </LevelSheet>
  )
}
