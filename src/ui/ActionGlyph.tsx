import type { ReactNode } from 'react'
import { iconUrl } from '../farm/icons'
import type { ProduceId } from '../farm/data'
import type { ActionIcon, Verb } from '../lib/interaction'
import type { Nearby } from '../store'

// Line glyphs for what an action does (24 × 24, drawn with the current colour), and the action badge: the verb
// with a small picture of the thing itself — a hand with a lettuce, a can with a tomato, scissors with wool.

const GLYPHS: Record<Verb, ReactNode> = {
  pick: (
    <>
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M11 11V4a1.5 1.5 0 0 1 3 0v7" />
      <path d="M14 11V5.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M17 12V8.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a6.5 6.5 0 0 1-5-2.4L3.6 16a1.5 1.5 0 0 1 2.3-2L8 16" />
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

/** The verb, with a small picture of what it is about. */
export function ActionBadge({ icon, className }: { icon?: ActionIcon; className?: string }) {
  const verb = icon?.verb ?? 'pick'
  return (
    <span className={`act-badge${className ? ` ${className}` : ''}`} data-verb={verb}>
      <Glyph verb={verb} className="act-glyph" />
      {icon?.item && <img className="act-item" src={iconUrl(icon.item as ProduceId, 64)} alt="" draggable={false} />}
    </span>
  )
}
