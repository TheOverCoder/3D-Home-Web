import type { ReactNode } from 'react'
import { iconUrl } from '../farm/icons'
import type { ProduceId } from '../farm/data'
import type { ActionIcon, Verb } from '../lib/interaction'
import type { Nearby } from '../store'

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
  build: (
    <>
      <path d="M10 7.5 13.5 4l6 6-3.5 3.5z" />
      <path d="M13 10.5 4.7 18.8a1.5 1.5 0 0 0 2.1 2.1L15 12.7" />
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
  wait: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  guide: (
    <>
      <path d="M12 2.8 19.5 20 12 16.2 4.5 20Z" />
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
 *  blue to water, gold to sell, orange to build). */
const VERB_COLOUR: Record<Verb, string> = {
  pick: '#3c9a4b',
  water: '#2f86d6',
  plant: '#6f9a2a',
  shear: '#8a63c9',
  sell: '#d99a1e',
  build: '#e0662c',
  make: '#c4553a',
  shop: '#23978a',
  switch: '#d8a92e',
  door: '#8d6e63',
  watch: '#5c6bc0',
  wait: '#8a94a6',
  drop: '#607d8b',
  guide: '#f08c1a',
}

/** The word under a button when the label does not start with a better one. */
const VERB_WORD: Record<Verb, string> = {
  pick: 'Take',
  water: 'Water',
  plant: 'Plant',
  shear: 'Shear',
  sell: 'Sell',
  build: 'Build',
  make: 'Make',
  shop: 'Shop',
  switch: 'Switch',
  door: 'Door',
  watch: 'Open',
  wait: 'Wait',
  drop: 'Put down',
  guide: 'Next',
}

/** Labels that start with one of these say the job in their first word ("Collect 2 eggs", "Milk Bella"). */
const LEADING = new Set(['Harvest', 'Water', 'Plant', 'Collect', 'Milk', 'Shear', 'Pick', 'Take', 'Weave', 'Bake', 'Build', 'Expand', 'Sell', 'Open', 'Close', 'Next', 'Switch'])

/** One word for what a press does: the icon's own, else the label's first word when it is a job, else the verb's. */
export function actionWord(icon: ActionIcon | undefined, label: string): string {
  if (icon?.word) return icon.word
  if (/^Pick up\b/.test(label)) return 'Pick up'
  const first = label.split(/[\s:·]/)[0]
  return LEADING.has(first) ? first : VERB_WORD[icon?.verb ?? 'pick']
}

/** A button's face: the thing itself, big, with the verb's coloured mark in its corner — or, for something with
 *  no picture (a door, a lamp, the shop), the verb's glyph on its own. */
export function ActionFace({ icon, className }: { icon?: ActionIcon; className?: string }) {
  const verb = icon?.verb ?? 'pick'
  const colour = VERB_COLOUR[verb]
  return (
    <span className={`act-face${icon?.item ? ' has-item' : ''}${className ? ` ${className}` : ''}`} data-verb={verb} style={{ ['--verb' as string]: colour }}>
      {icon?.item ? (
        <>
          <img className="act-face-item" src={iconUrl(icon.item as ProduceId)} alt="" draggable={false} />
          <span className="act-face-mark">
            <Glyph verb={verb} className="act-glyph" />
          </span>
        </>
      ) : (
        <Glyph verb={verb} className="act-face-glyph" />
      )}
    </span>
  )
}
