import type { ReactNode } from 'react'
import { iconUrl } from '../farm/icons'
import type { ProduceId } from '../farm/data'
import type { ActionIcon, Verb } from '../lib/interaction'
import type { Nearby } from '../store'
import { art } from './art'

// Line glyphs for what an action does (24 × 24, drawn with the current colour), and the faces of the action
// buttons: the thing itself, big (a lettuce, an egg, a bottle of milk), with the verb as a coloured mark in its
// corner (a basket, a can, scissors) and one word under the button — Harvest, Water, Collect, Milk — so what a
// press does reads at a glance, before any sentence.

const GLYPHS: Record<Verb, ReactNode> = {
  // a basket: what is ready goes in it
  pick: (
    <>
      <path d="M7.5 10a4.5 4.5 0 0 1 9 0" />
      <path d="M3.5 10.5h17l-1.6 8.3a1.5 1.5 0 0 1-1.5 1.2H6.6a1.5 1.5 0 0 1-1.5-1.2z" />
      <path d="M9 13.5v3.5M12 13.5v3.5M15 13.5v3.5" />
    </>
  ),
  water: (
    <>
      <path d="M4 10h10v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M14 12.5 19 8" />
      <path d="M17.5 6.5l3 3" />
      <path d="M6.5 10V8.5a2.5 2.5 0 0 1 5 0V10" />
      <path d="M20.5 13v.01M19 15.5v.01M21.5 16.5v.01" />
    </>
  ),
  plant: (
    <>
      <path d="M12 20v-8" />
      <path d="M12 12C12 8 9.5 5.5 5 5.5 5 9.5 7.5 12 12 12z" />
      <path d="M12 14.5c0-3.5 2.5-6 6.5-6 0 3.5-2.5 6-6.5 6z" />
      <path d="M7 20h10" />
    </>
  ),
  shear: (
    <>
      <circle cx="6" cy="6.5" r="2.8" />
      <circle cx="6" cy="17.5" r="2.8" />
      <path d="M8.4 8 20 17.5" />
      <path d="M8.4 16 20 6.5" />
    </>
  ),
  sell: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 9.2c-.6-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.9-2.8 2.1 0 2.8 5.8 1.4 5.8 4.2 0 1.2-1.3 2.1-3 2.1-1.3 0-2.4-.6-3-1.5" />
      <path d="M12 6v1.8M12 16.2V18" />
    </>
  ),
  make: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  shop: (
    <>
      <path d="M5 8.5h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z" />
      <path d="M9 11V7a3 3 0 0 1 6 0v4" />
    </>
  ),
  switch: (
    <>
      <path d="M9.5 18h5M10.5 21h3" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2V16h5v-.1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
    </>
  ),
  door: (
    <>
      <path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21" />
      <path d="M3.5 21h17" />
      <path d="M14.5 12.5v.01" />
    </>
  ),
  watch: (
    <>
      <rect x="2.5" y="4.5" width="19" height="13" rx="2" />
      <path d="M10.2 8.2v5.6l4.6-2.8z" />
      <path d="M8 21h8" />
    </>
  ),
  // a coat hanger: the wardrobe
  dress: (
    <>
      <path d="M9.6 5.6a2.4 2.4 0 1 1 3.2 2.3c-.5.2-.8.6-.8 1.1v.5" />
      <path d="M12 9.5 3.4 15.6a1 1 0 0 0 .6 1.8h16a1 1 0 0 0 .6-1.8z" />
    </>
  ),
  // a speech bubble: someone to talk to (the estate agent)
  talk: (
    <>
      <path d="M5 4.5h14A2.5 2.5 0 0 1 21.5 7v7.5A2.5 2.5 0 0 1 19 17h-8.5l-4.5 3.5V17H5a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 5 4.5z" />
      <path d="M8 10.8v.01M12 10.8v.01M16 10.8v.01" />
    </>
  ),
  // a car from the side: where it drives you
  drive: (
    <>
      <path d="M4.8 16.5H3.5v-3.1c0-.6.4-1.1 1-1.3l2.6-.8 2.1-3.1A2 2 0 0 1 10.9 7.3h4.3a2 2 0 0 1 1.6.8l2.6 3.4 1.5.5c.6.2 1 .7 1 1.3v3.2h-1.6" />
      <path d="M9.2 16.5h5.6" />
      <circle cx="7" cy="16.5" r="2.1" />
      <circle cx="17" cy="16.5" r="2.1" />
      <path d="M7.6 11.6h11.6" />
    </>
  ),
  wait: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  drop: (
    <>
      <path d="M12 3.5v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 20.5h14" />
    </>
  ),
}

export function Glyph({ verb, className }: { verb: Verb; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[verb]}
    </svg>
  )
}

const ARROWS = {
  left: <path d="M15 5.5 8.5 12l6.5 6.5" />,
  right: <path d="M9 5.5 15.5 12 9 18.5" />,
  back: (
    <>
      <path d="M9 14 4.5 9.5 9 5" />
      <path d="M4.5 9.5h10a5 5 0 0 1 0 10H11" />
    </>
  ),
}

/** Which way to turn for it: left, right or round (nothing when it is ahead). */
export function TurnHint({ side, className }: { side: Nearby['side']; className?: string }) {
  if (!side || side === 'ahead') return null
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ARROWS[side]}
    </svg>
  )
}

/** Each verb's colour: the mark in a button's corner, so the kind of job reads before the word (green to take,
 *  blue to water, gold to sell). */
const VERB_COLOUR: Record<Verb, string> = {
  pick: '#3c9a4b',
  water: '#2f86d6',
  plant: '#6f9a2a',
  shear: '#8a63c9',
  sell: '#d99a1e',
  make: '#c4553a',
  shop: '#23978a',
  switch: '#d8a92e',
  door: '#8d6e63',
  watch: '#5c6bc0',
  dress: '#c2577a',
  talk: '#3f7fbf',
  drive: '#d4402f',
  wait: '#8a94a6',
  drop: '#607d8b',
}

/** The word under a button when the label does not start with a better one. */
const VERB_WORD: Record<Verb, string> = {
  pick: 'Take',
  water: 'Water',
  plant: 'Plant',
  shear: 'Shear',
  sell: 'Sell',
  make: 'Make',
  shop: 'Shop',
  switch: 'Switch',
  door: 'Door',
  watch: 'Open',
  dress: 'Dress',
  talk: 'Talk',
  drive: 'Drive',
  wait: 'Wait',
  drop: 'Put down',
}

/** Labels that start with one of these say the job in their first word ("Collect 2 eggs", "Milk Bella"). */
const LEADING = new Set(['Harvest', 'Water', 'Plant', 'Collect', 'Milk', 'Shear', 'Pick', 'Take', 'Weave', 'Bake', 'Mill', 'Sell', 'Open', 'Close', 'Switch'])

/** One word for what a press does: the icon's own, else the label's first word when it is a job, else the verb's. */
export function actionWord(icon: ActionIcon | undefined, label: string): string {
  if (icon?.word) return icon.word
  if (/^Pick up\b/.test(label)) return 'Pick up'
  const first = label.split(/[\s:·]/)[0]
  return LEADING.has(first) ? first : VERB_WORD[icon?.verb ?? 'pick']
}

/** The verb's coloured mark for the corner of a picture: what a press does with the thing (a basket to take it, a
 *  can to water it), in the verb's colour. */
export function VerbMark({ verb }: { verb: Verb }) {
  return (
    <span className="act-face-mark" style={{ ['--verb' as string]: VERB_COLOUR[verb] }}>
      <Glyph verb={verb} className="act-glyph" />
    </span>
  )
}

/** A button's face: the thing itself, big, with the verb's coloured mark in its corner (a good's picture, or the
 *  interface's art for what is no good: the line at the gate) — or, for something with no picture (a door, a lamp,
 *  the shop), the verb's glyph on its own. */
export function ActionFace({ icon, className }: { icon?: ActionIcon; className?: string }) {
  const verb = icon?.verb ?? 'pick'
  const picture = icon?.item ? iconUrl(icon.item as ProduceId) : icon?.art ? art(icon.art) : null
  return (
    <span className={`act-face${picture ? ' has-item' : ''}${className ? ` ${className}` : ''}`} data-verb={verb}>
      {picture ? (
        <>
          <img className="act-face-item" src={picture} alt="" draggable={false} />
          <VerbMark verb={verb} />
        </>
      ) : (
        <Glyph verb={verb} className="act-face-glyph" />
      )}
    </span>
  )
}
