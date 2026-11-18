import { AnimatePresence, animate, m, useDragControls, useIsPresent, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { art } from './art'
import { CaretLeft, X } from './glyphs'
import { ARRIVE, PRESS, SHEET, SPRING, STAGGER, swipedAway } from './motion'
import { useSheetMode } from './sheetMode'

// The panel sheet (the base: CLAUDE.md, "Interface"; update-v1/CONTRACTS.md §1.8): the one sheet every panel is drawn
// on. A sheet of paper from the screen's edge — from the bottom upright, on the right sideways, in the middle on a
// computer — with the panel's picture, a title of a few words, a row of chips (or tabs) and ✕ at its top, its blocks
// coming in one after another (`ITEM` on each, from ./motion), and at most two buttons at its foot, Cancel first. A
// `card` is a question, as tall as what it asks. A swipe of its top (down upright, right sideways), a touch on the
// shade, ✕ or Esc sends it out the way it came; then `onClose`. Its host may also take it away (AnimatePresence round
// it, or `closing`): it goes out the same way. The shade lifts as a finger pulls the sheet away, and a sheet on its way
// out takes no touch: the next press goes to what is under it. Esc goes first to whatever is open over it (marked
// `data-over-sheet`), then back a page (`back`), then closes it. Its classes are the machine panel's (src/styles.css,
// "the panel sheet"), and it is a `.farm-panel` (what the game and its tests know a panel by).

/** Whatever is open over a sheet takes Esc before the sheet does: it says so with `data-over-sheet` (a card on this
 *  sheet says so too, so a card asked over a panel goes first; its own mark is not over itself). The good's bubble and
 *  a Shell card are named here until they carry the attribute themselves. */
const above = (self: Element | null) => Array.from(document.querySelectorAll('[data-over-sheet], .good-pop, .farm-backdrop')).some((e) => e !== self)

/** A button at the sheet's foot: its words, and the price on it (a coin and how many) where coins change hands. */
export interface FootButton {
  label: string
  onPress: () => void
  price?: number
  kind?: 'primary' | 'soft' | 'leaf' | 'berry'
  disabled?: boolean
}
const KIND: Record<NonNullable<FootButton['kind']>, string> = { primary: 'btn', soft: 'btn soft', leaf: 'btn leaf', berry: 'btn berry' }

function Foot({ b, kind, last }: { b: FootButton; kind: NonNullable<FootButton['kind']>; last?: boolean }) {
  return (
    <button className={`${KIND[b.kind ?? kind]}${last ? ' ps-action' : ''}`} disabled={b.disabled} onClick={b.onPress}>
      {b.label}
      {b.price !== undefined && (
        <>
          {' · '}
          <span className="farm-coins">
            <img src={art('coin')} alt="" />
            {b.price}
          </span>
        </>
      )}
    </button>
  )
}

export function PanelSheet({
  label,
  title,
  pic,
  sub,
  back,
  size = 'panel',
  foot,
  className = '',
  near,
  closing = false,
  onClose,
  children,
}: {
  /** what a screen reader calls the sheet */
  label: string
  title: string
  /** the picture at its top: an image's URL, or something drawn (the level's star with its number) */
  pic: string | ReactNode
  /** under the title: the row of chips, or tabs (the order board) */
  sub?: ReactNode
  /** a panel with pages (the machine's level): a way back in place of the picture, and Esc goes back before it closes */
  back?: () => void
  /** a `card` is a question, as tall as what it asks (a panel takes the room it needs, up to the sheet's most) */
  size?: 'panel' | 'card'
  /** the buttons at its foot: at most two, Cancel first, the action last (with its price) */
  foot?: { cancel?: FootButton; action: FootButton }
  /** the panel's own class, on the root (its rules read `.name .mp-sheet …`) */
  className?: string
  /** what stands beside the sheet, outside it (the remote's tag of a panel opened from afar) */
  near?: ReactNode
  /** the panel asks it to go out (it then calls `onClose`) */
  closing?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const mode = useSheetMode()
  // taken away by its host (AnimatePresence): it goes out all the same, and never calls onClose for it
  const here = useIsPresent()
  const [leaving, setLeaving] = useState(false)
  const out = leaving || closing || !here
  const sheet = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const controls = useDragControls()
  // Esc reads what is current (the page's way back changes with the page)
  const backNow = useRef(back)
  backNow.current = back
  useEffect(() => {
    sheet.current?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || above(root.current)) return
      e.stopPropagation()
      if (backNow.current) backNow.current()
      else setLeaving(true)
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [])
  // how far a finger has pulled the sheet towards its way out: the shade lifts with it
  const pull = useMotionValue(0)
  const shade = useTransform(pull, [0, 360], [1, 0.15])
  const along = (i: PanInfo) => Math.max(0, mode === 'right' ? i.offset.x : i.offset.y)
  const letGo = (_: unknown, i: PanInfo) => {
    if (swipedAway(mode, i)) setLeaving(true)
    else void animate(pull, 0, SPRING.pop)
  }
  const picture =
    typeof pic === 'string' ? (
      <m.img key="pic" className="art mp-head-art" src={pic} alt="" {...ARRIVE} exit={{ scale: 0.4, opacity: 0 }} />
    ) : (
      <m.span key="pic" className="mp-head-art ps-head-pic" {...ARRIVE} exit={{ scale: 0.4, opacity: 0 }}>
        {pic}
      </m.span>
    )
  return (
    <div
      ref={root}
      className={`mp-root mp-${mode} ps-root${size === 'card' ? ' ps-card' : ''}${foot ? ' ps-has-foot' : ''}${out ? ' ps-leaving' : ''} ${className}`}
      data-over-sheet={size === 'card' ? '' : undefined}
    >
      <m.div
        className="mp-shade ps-shade"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: out ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: out ? 0.18 : 0.24 }}
        onClick={() => setLeaving(true)}
      >
        <m.span style={{ opacity: shade }} />
      </m.div>
      <m.div
        ref={sheet}
        className="mp-sheet farm-panel ps-sheet"
        role={here ? 'dialog' : undefined}
        aria-modal={here ? true : undefined}
        aria-label={here ? label : undefined}
        aria-hidden={here ? undefined : true}
        tabIndex={-1}
        custom={mode}
        variants={SHEET}
        initial="hidden"
        animate={out ? 'out' : 'show'}
        exit="out"
        onAnimationComplete={(d) => d === 'out' && here && onClose()}
        drag={mode === 'middle' ? false : mode === 'right' ? 'x' : 'y'}
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        dragElastic={mode === 'right' ? { right: 0.9, left: 0 } : { bottom: 0.9, top: 0 }}
        dragMomentum={false}
        onDrag={(_, i) => pull.set(along(i))}
        onDragEnd={letGo}
      >
        <header
          className="mp-head"
          onPointerDown={(e) => {
            if (mode !== 'middle' && !(e.target as Element).closest('button')) controls.start(e)
          }}
        >
          <i className="mp-grab" aria-hidden="true" />
          {/* (the picture comes in as the sheet does; a page's way back takes its place) */}
          <AnimatePresence mode="popLayout">
            {back ? (
              <m.button
                key="back"
                className="mp-round"
                onClick={back}
                aria-label="Back"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                {...PRESS}
              >
                <CaretLeft weight="bold" />
              </m.button>
            ) : (
              picture
            )}
          </AnimatePresence>
          <div className="mp-head-text">
            <h2>{title}</h2>
            {sub && <div className="mp-sub">{sub}</div>}
          </div>
          <m.button className="mp-round" onClick={() => setLeaving(true)} aria-label="Close (Esc)" {...PRESS}>
            <X weight="bold" />
          </m.button>
        </header>
        <m.div className="ps-body" initial="hidden" animate="show" variants={STAGGER}>
          {children}
        </m.div>
        {foot && (
          <div className="ps-foot">
            {foot.cancel && <Foot b={foot.cancel} kind="soft" />}
            <Foot b={foot.action} kind="primary" last />
          </div>
        )}
      </m.div>
      {near}
    </div>
  )
}
