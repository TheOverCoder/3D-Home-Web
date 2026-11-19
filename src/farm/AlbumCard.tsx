import { AnimatePresence, m, type Variants } from 'motion/react'
import { useState } from 'react'
import { art } from '../ui/art'
import { GarmentPic } from '../ui/GarmentPic'
import { Check } from '../ui/glyphs'
import { EASE, ITEM, PRESS, SPRING, STAGGER } from '../ui/motion'
import { PanelSheet } from '../ui/PanelSheet'
import type { AlbumView, PageView, TilePic, TileView } from './album'
import { iconUrl, shopArtUrl, skinArtUrl } from './icons'
import './AlbumCard.css'

// How the farm album looks (its view is ./album.ts, made from the farm by ./AlbumPanel.tsx). On the game's paper, on its
// sheet (src/ui/PanelSheet.tsx): the open book, "Album", how many pages and tiles are done. It opens on its contents —
// the long ladders across the top (the wardrobe's garments, the goals' medals, the days played) and every page as a row:
// its picture, its name, how full it is, and the garment it gives, a silhouette until it is done. A row touched opens
// its page (the sheet's back arrow returns): its tiles in a grid, each earned one in its colours (new ones marked new),
// each still to earn a silhouette; a tile touched says how to earn it, in the one line under them. Nothing here is a
// button that pays: a page finished gives its garment by itself.

/** A tile's picture: a good (its model), interface art, a kind of the edit shop's, a tool's skin. */
function picUrl(p: TilePic): string {
  if ('item' in p) return iconUrl(p.item)
  if ('art' in p) return art(p.art)
  if ('decor' in p) return shopArtUrl(p.decor)
  return skinArtUrl(p.skin[0], p.skin[1])
}

export function AlbumCard({ v, onClose }: { v: AlbumView; onClose: () => void }) {
  const [at, setAt] = useState<string | null>(null)
  const page = at ? v.pages.find((p) => p.id === at) : undefined
  return (
    <PanelSheet
      label="Album"
      title={page ? page.name : 'Album'}
      pic={art('open-book')}
      back={page ? () => setAt(null) : undefined}
      sub={
        <>
          <span className="tag" aria-label={`${v.done} of ${v.pages.length} pages done`}>
            {v.done}/{v.pages.length} pages
          </span>
          <span className="tag" aria-label={`${v.tiles.got} of ${v.tiles.of} tiles`}>
            {v.tiles.got}/{v.tiles.of} tiles
          </span>
        </>
      }
      className="album-card"
      onClose={onClose}
    >
      <AnimatePresence mode="wait">{page ? <Page key={page.id} p={page} /> : <Contents key="contents" v={v} onOpen={setAt} />}</AnimatePresence>
    </PanelSheet>
  )
}

/** The contents or a page: it comes in from the side, its blocks one after another, and goes quickly. It holds its
 *  blocks' variants itself, so one opened after the sheet came in still brings them in. */
const PAGE: Variants = {
  hidden: { opacity: 0, x: 18 },
  show: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE.out, staggerChildren: 0.05 } },
  out: { opacity: 0, x: -18, transition: { duration: 0.12 } },
}
const SLIDE = { variants: PAGE, initial: 'hidden', animate: 'show', exit: 'out' } as const

/** The contents: the long ladders, then every page as a row. */
function Contents({ v, onOpen }: { v: AlbumView; onOpen: (id: string) => void }) {
  const c = v.cover
  return (
    <m.div className="al-contents" {...SLIDE}>
      <m.div className="al-ladders" variants={ITEM} aria-label="The long ladders">
        <span className="al-ladder">
          <img className="art" src={art('crown')} alt="" />
          <b>
            {c.garments.have}/{c.garments.of}
          </b>
          <small>garments</small>
        </span>
        <span className="al-ladder">
          <img className="art" src={art('trophy')} alt="" />
          <b>{c.medals}</b>
          <small>medals</small>
        </span>
        <span className="al-ladder">
          <img className="art" src={art('tear-off-calendar')} alt="" />
          <b>{c.days}</b>
          <small>{c.days === 1 ? 'day' : 'days'} played</small>
        </span>
      </m.div>
      <m.ul className="al-pages" variants={STAGGER} initial="hidden" animate="show">
        {v.pages.map((p) => (
          <m.li key={p.id} variants={ITEM}>
            <m.button
              type="button"
              className={`al-row${p.done ? ' done' : p.near?.almost ? ' almost' : ''}`}
              onClick={() => onOpen(p.id)}
              aria-label={`${p.name}: ${p.got} of ${p.of}${p.done ? ', done' : ''}`}
              {...PRESS}
            >
              <img className="art al-row-art" src={art(p.art)} alt="" />
              <span className="al-row-words">
                <b>{p.name}</b>
                <span className="al-bar" aria-hidden="true">
                  <i style={{ width: `${(p.got / p.of) * 100}%` }} />
                </span>
              </span>
              <span className="al-count">
                {p.got}/{p.of}
              </span>
              {p.garment && (
                <span className={`al-prize${p.done ? '' : ' shade'}`} aria-hidden="true">
                  <GarmentPic g={p.garment} />
                  {p.done && (
                    <i className="al-check">
                      <Check weight="bold" />
                    </i>
                  )}
                </span>
              )}
            </m.button>
          </m.li>
        ))}
      </m.ul>
    </m.div>
  )
}

/** A page: its garment, its tiles, and the one line (the tile touched, or what the page gives). */
function Page({ p }: { p: PageView }) {
  const [picked, setPicked] = useState<string | null>(null)
  const tile = p.tiles.find((t) => t.id === picked)
  const line = tile
    ? tileLine(tile)
    : p.done
      ? `Done: the ${p.garment?.name.toLowerCase() ?? 'page'} is in your wardrobe.`
      : `${p.of - p.got} to go: then a ${p.garment?.name.toLowerCase() ?? 'gift'} for your wardrobe.`
  return (
    <m.div className="al-page" {...SLIDE}>
      <div className="al-head">
        {p.garment && (
          <span className={`al-garment${p.done ? '' : ' shade'}`} aria-label={p.done ? `${p.garment.name}: yours` : `Finish the page for a ${p.garment.name.toLowerCase()}`}>
            <GarmentPic g={p.garment} />
          </span>
        )}
        <span className="al-head-words">
          <b>
            {p.got}/{p.of}
          </b>
          <small>{p.done ? 'Page done' : p.near?.almost ? 'Almost done' : 'Tiles earned'}</small>
        </span>
      </div>
      <m.ul className="al-tiles" variants={STAGGER} initial="hidden" animate="show">
        {p.tiles.map((t) => (
          <m.li key={t.id} variants={ITEM}>
            <m.button
              type="button"
              className={`al-tile ${t.state}${picked === t.id ? ' on' : ''}`}
              aria-pressed={picked === t.id}
              aria-label={`${t.name}: ${t.state === 'todo' ? t.how : 'earned'}`}
              onClick={() => setPicked((x) => (x === t.id ? null : t.id))}
              {...PRESS}
            >
              <img className="art" src={picUrl(t.pic)} alt="" draggable={false} />
              <small>{t.name}</small>
              {t.state === 'new' && (
                <m.i className="al-badge" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.pop, delay: 0.4 }}>
                  New
                </m.i>
              )}
            </m.button>
          </m.li>
        ))}
      </m.ul>
      <AnimatePresence mode="wait" initial={false}>
        <m.p key={line} className="al-line" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.08 } }}>
          {line}
        </m.p>
      </AnimatePresence>
    </m.div>
  )
}

/** A tile's words: how to earn it (how far, when it counts more than one), or that it is earned. */
function tileLine(t: TileView): string {
  if (t.state !== 'todo') return `${t.name}: earned.`
  return t.need > 1 ? `${t.name}: ${t.how} (${t.have} of ${t.need}).` : `${t.name}: ${t.how}.`
}
