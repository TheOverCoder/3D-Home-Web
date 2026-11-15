import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import type { Board, BoardKind } from '../board'
import { BOARDS } from '../boards'
import { DEVICES } from '../devices'
import { AREAS, MAP, type Screen } from '../map'
import { StatusView } from '../status/Status'
import { AppWindow, ArrowUUpLeft, ChatCircle, Check, Cube, FilmSlate, House, PaperPlaneTilt, X } from './icons'
import { useReviews, type Note, type Review } from './reviews'

// The sandbox, the lab's one view: the game's screen, full screen, with the designs in it. A sidebar has two lists:
// the designs (each card coloured by what the user said — grey waiting, numbered 1 for the oldest; green approved; red
// turned down — with its kind's icon: a film, a piece of the interface, a 3D element) and "ready to send", the outbox
// for the designer: an answered card goes there with its send button and comes back with its return button. A card
// opens its design in the game's screen; "next" goes to the next one waiting. The bar under the thumb goes between
// today and the proposals (a tap on the one shown plays it again) and the states, and takes the answer: ✓ or ✗ on a
// proposal, a note on it, or a note pinned to one point of it; ℹ︎ shows what the design is, what is new in it and every
// answer given. The screens of the game with no design yet are in the sidebar too, to be asked for, and so is the lab's
// status. On a phone the screen is the phone's own; on a computer a phone at its size beside the sidebar. A board
// needs nothing to be here: its `kind` gives its icon, its `added` its place, its `spot` rings it on the game's
// screen, its `screen` gives it its picture.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyBoard = Board<any>

const letter = (id: string) => (id === 'today' ? 'היום' : id.toUpperCase())
const firstPick = (b: AnyBoard) => (b.variants.find((v) => v.id !== 'today') ?? b.variants[0]).id

const MAP_PICS = import.meta.glob('../map/*.{jpg,png,webp}', { eager: true, import: 'default' }) as Record<string, string>
const thumbOf = (id?: string) => (id ? (MAP_PICS[`../map/${id}-upright.jpg`] ?? MAP_PICS[`../map/${id}-sideways.jpg`]) : undefined)
const GRADE = { good: 'טוב כמו שהוא', fix: 'לשפר', redo: 'לעצב מחדש', missing: 'חסר' } as const

/** What the user said of a design: approved (a ✓), turned down (only ✗), only notes, or nothing yet. */
type Answer = 'yes' | 'no' | 'note' | 'none'
function answerOf(rv: Review): Answer {
  const v = Object.values(rv.verdicts)
  if (v.includes('yes')) return 'yes'
  if (v.includes('no')) return 'no'
  return rv.notes.length ? 'note' : 'none'
}
const SAID = { yes: { word: 'אושר', Icon: Check }, no: { word: 'נדחה', Icon: X }, note: { word: 'הערות', Icon: ChatCircle } } as const

/** A board's kind, as its icon and in words. */
const KIND: Record<BoardKind, { name: string; Icon: typeof Cube }> = {
  film: { name: 'סרטון', Icon: FilmSlate },
  ui: { name: 'עיצוב ממשק', Icon: AppWindow },
  '3d': { name: 'אלמנט תלת־ממד', Icon: Cube },
}
/** Every board, the oldest first (by when its round was put before the user). */
const BY_AGE = [...BOARDS].sort((a, b) => a.added.localeCompare(b.added))

/** a short tap felt under the finger for an answer given (phones that can) */
function buzz() {
  try {
    navigator.vibrate?.(12)
  } catch {
    // not allowed here: nothing
  }
}

// the viewer's own settings of the sandbox (a convenience: it works the same without them)
interface Prefs {
  device: 'upright' | 'sideways'
  slow: boolean
  reduced: boolean
  last: Record<string, string>
}
const PREFS = 'lab-play'
function readPrefs(): Prefs {
  const plain: Prefs = { device: 'upright', slow: false, reduced: false, last: {} }
  try {
    return { ...plain, ...(JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Partial<Prefs>) }
  } catch {
    return plain
  }
}
function keepPrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p))
  } catch {
    // private window
  }
}

type Sheet = null | { kind: 'states' } | { kind: 'note'; x?: number; y?: number } | { kind: 'pin'; note: Note } | { kind: 'info' } | { kind: 'status' }

/** The sidebar stays beside the screen where there is room for both (a computer); on a phone it slides over it. */
const roomy = () => innerWidth >= 900 && innerHeight >= 500

export function Play({ start }: { start?: string }) {
  const real = useRef(matchMedia('(pointer: coarse)').matches).current
  const [prefs, setPrefsState] = useState(readPrefs)
  const setPrefs = (p: Partial<Prefs>) =>
    setPrefsState((was) => {
      const now = { ...was, ...p }
      keepPrefs(now)
      return now
    })
  const startBoard = BOARDS.find((b) => b.id === start)
  const [openId, setOpenId] = useState<string | null>(startBoard?.id ?? null)
  const board = BOARDS.find((b) => b.id === openId) ?? null
  const [variant, setVariant] = useState(startBoard ? (prefs.last[startBoard.id] ?? firstPick(startBoard)) : '')
  const [stateId, setStateId] = useState(startBoard?.states[0].id ?? '')
  const [run, setRun] = useState(0)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [pinning, setPinning] = useState(false)
  // the note being written: kept while a point is picked for it on the screen
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [wide, setWide] = useState(() => innerWidth > innerHeight)
  const [beside, setBeside] = useState(roomy)
  // on a phone the sidebar is the first thing seen, so the designs and their colours are found at once
  const [sideOpen, setSideOpen] = useState(() => !roomy() && !startBoard)
  const r = useReviews()

  const frame = useRef<HTMLIFrameElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState({ w: 0, h: 0 })

  // the screen: the phone's own on a phone, else a phone at its size fitted to the stage
  const kind: 'upright' | 'sideways' = real ? (wide ? 'sideways' : 'upright') : prefs.device
  const d = DEVICES[kind]
  const k = real ? 1 : Math.min(1, Math.max(0.2, (room.w - 24) / d.w), Math.max(0.2, (room.h - 24) / d.h))
  const query = `play=1&device=${real ? 'real' : kind}&touches=0&speed=${prefs.slow ? 0.25 : 1}${prefs.reduced ? '&motion=reduce' : ''}`
  const hashOf = (id: string | null, v: string, s: string, n: number) => (id ? `${id}/${v}/${s}/${n}` : '')
  const [src] = useState(() => `frame.html?${query}#${hashOf(openId, variant, stateId, 0)}`)
  const [srcQuery, setSrcQuery] = useState(query)

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const fit = () => setRoom({ w: el.clientWidth, h: el.clientHeight })
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    const turn = () => {
      setWide(innerWidth > innerHeight)
      setBeside(roomy())
    }
    addEventListener('resize', turn)
    return () => {
      watch.disconnect()
      removeEventListener('resize', turn)
    }
  }, [])

  // the frame follows what is open: the address after # (no reload); its settings, a reload
  useEffect(() => {
    const w = frame.current?.contentWindow
    // until the frame has its own page (about:blank first), its first address already says what to show
    if (!w || !w.location.pathname.endsWith('frame.html')) return
    if (query !== srcQuery) {
      w.location.replace(`frame.html?${query}#${hashOf(openId, variant, stateId, run)}`)
      setSrcQuery(query)
      return
    }
    try {
      w.location.replace(`${w.location.pathname}${w.location.search}#${hashOf(openId, variant, stateId, run)}`)
    } catch {
      // the frame is still loading: its first address already says it
    }
  }, [openId, variant, stateId, run, query, srcQuery])

  const say = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2600)
  }
  /** a design opened: its name a moment over the screen (on a phone nothing else says which one it is) */
  const open = (id: string, before?: string) => {
    const b = BOARDS.find((x) => x.id === id)
    if (!b) return
    say(before ? `${before} · ${b.title}` : b.title)
    setSheet(null)
    setPinning(false)
    setSideOpen(false)
    setOpenId(b.id)
    setVariant(prefs.last[b.id] ?? firstPick(b))
    setStateId(b.states[0].id)
    setRun((n) => n + 1)
  }
  const close = () => {
    setPinning(false)
    setSheet(null)
    setOpenId(null)
  }
  const pick = (v: string) => {
    if (!board) return
    // the proposal shown, touched again, plays again from its opening
    if (v === variant) {
      setRun((n) => n + 1)
      return
    }
    setVariant(v)
    setPrefs({ last: { ...prefs.last, [board.id]: v } })
    const it = board.variants.find((x) => x.id === v)
    if (it) say(`${letter(v)} · ${it.name}`)
  }
  // waiting: not answered and not sent; "next" is the next of them after the one open, in the sidebar's order
  const isWaiting = (b: AnyBoard) => !r.sent(b.id) && answerOf(r.review(b.id)) === 'none'
  const nextId = () => {
    const at = board ? BY_AGE.indexOf(board) : -1
    const order = [...BY_AGE.slice(at + 1), ...BY_AGE.slice(0, at + 1)]
    return order.find((b) => b.id !== openId && isWaiting(b))?.id
  }
  const waiting = BY_AGE.filter(isWaiting).length

  // what the screen asks: open a board, it closed, a touch where nothing opens
  useEffect(() => {
    const heard = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data?.lab) return
      if (e.data.type === 'open') open(String(e.data.board))
      else if (e.data.type === 'closed') close()
      else if (e.data.type === 'hint' && !pinning) say('מה שעוצב מסומן בטבעת צהובה. כל העיצובים ברשימה ☰')
    }
    addEventListener('message', heard)
    return () => removeEventListener('message', heard)
  })

  // keys on a computer: Esc closes, ← → go between the proposals, N to the next design
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('textarea, input, select')) return
      if (e.key === 'Escape') {
        if (pinning) {
          setPinning(false)
          setSheet({ kind: 'note' })
        } else if (sheet) setSheet(null)
        else if (sideOpen) setSideOpen(false)
        else close()
      } else if (board && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const ids = board.variants.map((v) => v.id)
        const i = ids.indexOf(variant) + (e.key === 'ArrowLeft' ? 1 : -1)
        if (ids[i]) pick(ids[i])
      } else if (e.key === 'n' || e.key === 'N') {
        const id = nextId()
        if (id) open(id)
      }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })

  const review = board ? r.review(board.id) : null
  const here = (n: Note) => n.variant === variant && n.state === stateId && n.kind === kind
  const pins = review?.notes.filter((n) => here(n) && n.x != null) ?? []
  const notesOnVariant = review?.notes.filter((n) => n.variant === variant) ?? []
  const state = board?.states.find((s) => s.id === stateId)
  const stateNo = board ? board.states.findIndex((s) => s.id === stateId) + 1 : 0
  const box = real ? { w: room.w, h: room.h } : { w: d.w * k, h: d.h * k }

  // on the click, not the press: a sheet opened on the press would take the same tap's click and close at once
  const catchPin = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setPinning(false)
    setSheet({ kind: 'note', x, y })
  }
  // to the next design waiting; with none left, the list (what is answered waits there to be sent)
  const toNext = (before?: string) => {
    const id = nextId()
    if (id) open(id, before)
    else {
      setSideOpen(true)
      say(before ? `${before} · אין עוד עיצובים שמחכים` : 'אין עוד עיצובים שמחכים')
    }
  }
  // answered: one press sends it to the outbox and opens the next one waiting
  const sendNext = () => {
    if (!board) return
    r.send(board.id)
    buzz()
    toNext('✈ נשלח')
  }
  const judge = (v: 'yes' | 'no') => {
    if (!board) return
    r.verdict(board.id, variant, v)
    buzz()
  }

  return (
    <div className={`play${real ? ' real' : ''}${wide && real ? ' wide' : ''}${board ? ' opened' : ''}${beside ? ' beside' : ''}`} dir="rtl" lang="he">
      <Side
        r={r}
        openId={openId}
        open={beside || sideOpen}
        floating={!beside}
        onOpen={open}
        onHome={() => {
          close()
          setSideOpen(false)
        }}
        onStatus={() => setSheet({ kind: 'status' })}
        onClose={() => setSideOpen(false)}
        prefs={prefs}
        setPrefs={setPrefs}
        real={real}
        isWaiting={isWaiting}
      />

      <main className="main">
        <div className="play-stage" ref={stage}>
          <div className={`play-screen${real ? '' : ' glass'}`} style={real ? undefined : { width: box.w, height: box.h }}>
            <iframe ref={frame} src={src} title="המסך של המשחק" width={real ? undefined : d.w} height={real ? undefined : d.h} style={real ? undefined : { transform: `scale(${k})` }} />
            {board && (
              <div className="pins" aria-hidden={pins.length === 0}>
                {pins.map((n, i) => (
                  <button
                    key={n.id}
                    className="pin"
                    style={{ left: `${n.x! * 100}%`, top: `${n.y! * 100}%` }}
                    onClick={() => setSheet({ kind: 'pin', note: n })}
                    aria-label={`הערה ${i + 1}: ${n.text}`}
                  >
                    <span>{i + 1}</span>
                  </button>
                ))}
              </div>
            )}
            {pinning && (
              <div className="pin-catch" onClick={catchPin} role="button" aria-label="גע בנקודה בעיצוב">
                <span>
                  גע בנקודה שעליה ההערה
                  <button
                    className="pin-cancel"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPinning(false)
                      setSheet({ kind: 'note' })
                    }}
                  >
                    ביטול
                  </button>
                </span>
              </div>
            )}
          </div>
          {toast && (
            <p className="toast" role="status">
              {toast}
            </p>
          )}
        </div>

        {board && review ? (
          <div className="dock" role="toolbar" aria-label={`ההצעות ל${board.title}`}>
            <button className="d-btn d-menu" onClick={() => setSideOpen(true)} aria-label="כל העיצובים">
              ☰{waiting > 0 && <i className="count">{waiting}</i>}
            </button>
            <div className="d-seg" role="radiogroup" aria-label="הצעה">
              {board.variants.map((v) => {
                const said = review.verdicts[v.id]
                const notes = review.notes.filter((n) => n.variant === v.id).length
                return (
                  <button
                    key={v.id}
                    role="radio"
                    aria-checked={variant === v.id}
                    className={`d-var${variant === v.id ? ' on' : ''}${v.id === 'today' ? ' today' : ''}${said ? ` said-${said}` : notes ? ' said-note' : ''}`}
                    onClick={() => pick(v.id)}
                    aria-label={`${letter(v.id)}: ${v.name}${said === 'yes' ? ', אהבת' : said === 'no' ? ', דחית' : ''}`}
                  >
                    {letter(v.id)}
                  </button>
                )
              })}
            </div>
            <button className="d-btn d-state" onClick={() => setSheet({ kind: 'states' })} aria-label={`מצב: ${state?.name}`}>
              <span>{state?.name}</span>
              <b className="short">
                {stateNo}/{board.states.length}
              </b>{' '}
              ▾
            </button>
            <div className="judge">
              <button
                className={`d-btn d-yes${review.verdicts[variant] === 'yes' ? ' on' : ''}`}
                aria-pressed={review.verdicts[variant] === 'yes'}
                onClick={() => judge('yes')}
                aria-label={`אהבתי את ${letter(variant)}`}
              >
                ✓ <span>אהבתי</span>
              </button>
              <button
                className={`d-btn d-no${review.verdicts[variant] === 'no' ? ' on' : ''}`}
                aria-pressed={review.verdicts[variant] === 'no'}
                onClick={() => judge('no')}
                aria-label={`לא את ${letter(variant)}`}
              >
                ✗ <span>לא</span>
              </button>
              <button className="d-btn d-note" onClick={() => setSheet({ kind: 'note' })} aria-label={`הערה על ${letter(variant)}`}>
                💬 <span>הערה</span>
                {notesOnVariant.length > 0 && <i className="count">{notesOnVariant.length}</i>}
              </button>
              <button className="d-btn d-info" onClick={() => setSheet({ kind: 'info' })} aria-label="על העיצוב והתשובות שלך">
                ℹ︎
              </button>
              {answerOf(review) !== 'none' && !r.sent(board.id) ? (
                <button className="d-btn d-next d-send" onClick={sendNext} aria-label="לשלוח למוכן לשליחה ולעבור לעיצוב הבא">
                  <PaperPlaneTilt weight="bold" /> <span>שלח</span> <i className="arr">←</i>
                </button>
              ) : (
                <button className="d-btn d-next" onClick={() => toNext()} aria-label="לעיצוב הבא שמחכה">
                  <span>הבא</span> ←
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="dock idle">
            <button className="d-btn d-list" onClick={() => setSideOpen(true)}>
              ☰ <span>כל העיצובים</span>
            </button>
            <button className="d-btn d-next primary" onClick={() => toNext()}>
              {waiting ? `${waiting} מחכים לך · לפתוח ←` : 'אין עיצובים שמחכים · לרשימה'}
            </button>
          </div>
        )}
      </main>

      {sheet && (
        <div className="sheet-back" onClick={() => setSheet(null)}>
          <div className={`sheet sheet-${sheet.kind}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {sheet.kind === 'states' && board && (
              <Options
                title="באיזה מצב לראות"
                options={board.states.map((s) => ({ id: s.id, name: s.name }))}
                on={stateId}
                onPick={(id) => {
                  setStateId(id)
                  setRun((n) => n + 1)
                  setSheet(null)
                }}
                onClose={() => setSheet(null)}
              />
            )}
            {sheet.kind === 'note' && board && (
              <NoteSheet
                title={`הערה על ${letter(variant)}`}
                text={draft}
                setText={setDraft}
                point={sheet.x != null}
                onPoint={() => {
                  setSheet(null)
                  setPinning(true)
                }}
                onNoPoint={() => setSheet({ kind: 'note' })}
                notes={notesOnVariant}
                onRemove={(id) => r.removeNote(board.id, id)}
                onSave={(text) => {
                  r.addNote(board.id, { variant, state: stateId, kind, x: sheet.x, y: sheet.y, text })
                  setDraft('')
                  setSheet(null)
                  buzz()
                  say(sheet.x != null ? '📍 ההערה נשמרה על הנקודה' : 'ההערה נשמרה')
                }}
                onClose={() => setSheet(null)}
              />
            )}
            {sheet.kind === 'pin' && board && (
              <div className="pin-note">
                <h2>הערה על נקודה</h2>
                <p>{sheet.note.text}</p>
                <div className="sheet-actions">
                  <button
                    className="soft-btn"
                    onClick={() => {
                      r.removeNote(board.id, sheet.note.id)
                      setSheet(null)
                    }}
                  >
                    למחוק
                  </button>
                  <button className="primary-btn" onClick={() => setSheet(null)}>
                    סגירה
                  </button>
                </div>
              </div>
            )}
            {sheet.kind === 'info' && board && review && (
              <Info
                board={board}
                variant={variant}
                review={review}
                onRemove={(id) => r.removeNote(board.id, id)}
                onAgain={() => {
                  setRun((n) => n + 1)
                  setSheet(null)
                }}
                onClose={() => setSheet(null)}
              />
            )}
            {sheet.kind === 'status' && (
              <>
                <SheetHead title="מצב המערכת" onClose={() => setSheet(null)} />
                <StatusView onPage={open} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Two lists: the designs (waiting ones numbered, the oldest 1; answered ones coloured, with a send button) and the
 *  outbox ready to send to the designer (with a return button); then the screens with no design yet, the settings. */
function Side({
  r,
  openId,
  open,
  floating,
  onOpen,
  onHome,
  onStatus,
  onClose,
  prefs,
  setPrefs,
  real,
  isWaiting,
}: {
  r: ReturnType<typeof useReviews>
  openId: string | null
  open: boolean
  floating: boolean
  onOpen: (id: string) => void
  onHome: () => void
  onStatus: () => void
  onClose: () => void
  prefs: Prefs
  setPrefs: (p: Partial<Prefs>) => void
  real: boolean
  isWaiting: (b: AnyBoard) => boolean
}) {
  const [tab, setTab] = useState<'designs' | 'outbox'>('designs')
  const designed = new Set(BOARDS.map((b) => b.screen).filter(Boolean))
  const rest = MAP.screens.filter((s) => !designed.has(s.id))
  const designs = BY_AGE.filter((b) => !r.sent(b.id))
  const outbox = BY_AGE.filter((b) => r.sent(b.id))
  const waiting = designs.filter(isWaiting)
  const answered = designs.filter((b) => answerOf(r.review(b.id)) !== 'none')
  const shown = tab === 'designs' ? designs : outbox
  const send = (ids: string[]) => {
    for (const id of ids) r.send(id)
    buzz()
  }
  return (
    <>
      {floating && open && <div className="side-back" onClick={onClose} />}
      <aside className={`side${open ? ' open' : ''}${floating ? ' floating' : ''}`} aria-label="העיצובים" aria-hidden={!open}>
        <header className="side-head">
          <div className="side-tabs" role="tablist" aria-label="רשימות">
            <button role="tab" aria-selected={tab === 'designs'} className={tab === 'designs' ? 'on' : ''} onClick={() => setTab('designs')}>
              עיצובים {waiting.length > 0 && <i className="count">{waiting.length}</i>}
            </button>
            <button role="tab" aria-selected={tab === 'outbox'} className={tab === 'outbox' ? 'on' : ''} onClick={() => setTab('outbox')}>
              מוכן לשליחה {outbox.length > 0 && <i className="count">{outbox.length}</i>}
            </button>
          </div>
          {floating && (
            <button className="d-btn side-x" onClick={onClose} aria-label="סגור">
              <X weight="bold" />
            </button>
          )}
        </header>
        {tab === 'designs' && (
          <button className={`card home${openId ? '' : ' on'}`} onClick={onHome}>
            <span className="card-pic">
              <House weight="fill" />
            </span>
            <b className="card-title">המסך של המשחק</b>
          </button>
        )}
        {tab === 'outbox' && <p className="side-line">{outbox.length ? 'אלה יגיעו לסוכן בסבב הבא' : 'כאן יהיה מה ששלחת לסוכן. ענית על עיצוב? לחצו ✈ בכרטיס שלו'}</p>}
        <nav className="side-list" aria-label={tab === 'designs' ? 'עיצובים לבחירה' : 'מוכן לשליחה'}>
          {shown.map((b) => {
            const a = answerOf(r.review(b.id))
            const no = waiting.indexOf(b) + 1
            const said = a === 'none' ? null : SAID[a]
            const kind = KIND[b.kind]
            const thumb = thumbOf(b.screen)
            return (
              <div key={b.id} className={`card a-${a}${openId === b.id ? ' on' : ''}`}>
                <button
                  className="card-open"
                  onClick={() => onOpen(b.id)}
                  aria-current={openId === b.id ? 'true' : undefined}
                  aria-label={`${no ? `${no}. ` : ''}${b.title}, ${kind.name}${said ? `, ${said.word}` : ''}`}
                >
                  {no > 0 && <span className="card-no">{no}</span>}
                  <span className="card-pic">
                    {thumb ? <img src={thumb} alt="" /> : <kind.Icon weight="bold" />}
                    <span className="card-kind" title={kind.name}>
                      <kind.Icon weight="bold" />
                    </span>
                  </span>
                  <span className="card-text">
                    <b className="card-title">{b.title}</b>
                    {said && (
                      <span className="card-said">
                        <said.Icon weight="bold" /> {said.word}
                      </span>
                    )}
                  </span>
                </button>
                {tab === 'designs' && said && (
                  <button className="card-act send" onClick={() => send([b.id])} aria-label={`להעביר את ${b.title} למוכן לשליחה`} title="למוכן לשליחה">
                    <PaperPlaneTilt weight="bold" />
                  </button>
                )}
                {tab === 'outbox' && (
                  <button className="card-act back" onClick={() => r.unsend(b.id)} aria-label={`להחזיר את ${b.title} לעיצובים`} title="להחזיר לעיצובים">
                    <ArrowUUpLeft weight="bold" />
                  </button>
                )}
              </div>
            )
          })}
        </nav>
        {tab === 'designs' && answered.length > 1 && (
          <button className="side-send-all" onClick={() => send(answered.map((b) => b.id))}>
            <PaperPlaneTilt weight="bold" /> לשלוח את כל ה־{answered.length} שענית
          </button>
        )}
        {tab === 'designs' && waiting.length === 0 && <p className="side-line">✓ אין עיצובים שמחכים לך</p>}
        <details className="side-more">
          <summary>מסכים שעוד אין להם עיצוב ({rest.length})</summary>
          {AREAS.map((area) => {
            const screens = rest.filter((s) => s.area === area)
            if (!screens.length) return null
            return (
              <div key={area} className="side-area">
                <h3>{area}</h3>
                {screens.map((s: Screen) => (
                  <div key={s.id} className="side-ask">
                    <span className="side-text">
                      <b>{s.name}</b>
                      <small>{GRADE[s.grade]}</small>
                    </span>
                    <button className={`ask-btn${r.requests[s.id] ? ' on' : ''}`} aria-pressed={!!r.requests[s.id]} onClick={() => r.request(s.id)}>
                      {r.requests[s.id] ? '✓ ביקשת' : '🙋 לעצב'}
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </details>
        <footer className="side-foot">
          <p className={`keeping ${r.keeping}`}>{r.keeping === 'shared' ? '✓ נשמר בקישור' : r.keeping === 'local' ? 'נשמר רק בדפדפן הזה' : 'מתחבר…'}</p>
          <div className="prefs">
            {!real && (
              <div className="seg" role="radiogroup" aria-label="הטלפון">
                {(['upright', 'sideways'] as const).map((k) => (
                  <button key={k} role="radio" aria-checked={prefs.device === k} className={prefs.device === k ? 'on' : ''} onClick={() => setPrefs({ device: k })}>
                    {DEVICES[k].name}
                  </button>
                ))}
              </div>
            )}
            <button className={`pref${prefs.slow ? ' on' : ''}`} aria-pressed={prefs.slow} onClick={() => setPrefs({ slow: !prefs.slow })}>
              🐢 איטי
            </button>
            <button className={`pref${prefs.reduced ? ' on' : ''}`} aria-pressed={prefs.reduced} onClick={() => setPrefs({ reduced: !prefs.reduced })}>
              🧘 פחות תנועה
            </button>
            <button className="pref" onClick={onStatus}>
              📋 מצב המערכת
            </button>
          </div>
        </footer>
      </aside>
    </>
  )
}

/** The proposal shown and every answer given to the design first (what a phone needs while choosing); the request,
 *  what is new in this round and the research folded under them. */
function Info({ board, variant, review, onRemove, onAgain, onClose }: { board: AnyBoard; variant: string; review: Review; onRemove: (id: string) => void; onAgain: () => void; onClose: () => void }) {
  const v = board.variants.find((x) => x.id === variant)
  const kind = KIND[board.kind]
  return (
    <>
      <SheetHead title={board.title} onClose={onClose}>
        <span className="info-kind" title={kind.name} aria-label={kind.name}>
          <kind.Icon weight="bold" />
        </span>
      </SheetHead>
      {v && (
        <div className="info-variant">
          <b>
            {letter(v.id)} · {v.name}
          </b>
          <p>{v.note}</p>
          {v.motion && <p className="quiet">✦ {v.motion}</p>}
          <button className="soft-btn" onClick={onAgain}>
            ↻ לראות שוב
          </button>
        </div>
      )}
      <h3 className="list-title">התשובות שלך</h3>
      {Object.keys(review.verdicts).length === 0 && review.notes.length === 0 ? (
        <p className="quiet">עוד לא ענית על העיצוב הזה.</p>
      ) : (
        <ul className="notes">
          {board.variants
            .filter((x) => review.verdicts[x.id])
            .map((x) => (
              <li key={`v-${x.id}`} className={`said-${review.verdicts[x.id]}`}>
                <span>
                  {review.verdicts[x.id] === 'yes' ? '✓ אהבת' : '✗ דחית'} את {letter(x.id)} · {x.name}
                </span>
              </li>
            ))}
          {review.notes.map((n) => (
            <li key={n.id}>
              <span>
                <b>{letter(n.variant)}</b> {n.x != null && '📍 '}
                {n.text}
              </span>
              <button className="d-btn" onClick={() => onRemove(n.id)} aria-label={`למחוק: ${n.text}`}>
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
      <details className="info-more">
        <summary>{board.round ? 'הבקשה ומה חדש בסבב' : 'הבקשה'}</summary>
        <p className="info-line">
          <b>הבקשה:</b> {board.ask}
        </p>
        {board.round && (
          <p className="info-line">
            <b>מה חדש:</b> {board.round}
          </p>
        )}
      </details>
      {board.research && board.research.length > 0 && (
        <details className="info-more">
          <summary>מה המעצב בדק לפני שעיצב ({board.research.length})</summary>
          <ul>
            {board.research.map((x) => (
              <li key={x.pattern}>
                <b>{x.pattern}</b> — {x.from}
              </li>
            ))}
          </ul>
        </details>
      )}
      <button className="primary-btn info-close" onClick={onClose}>
        סגירה
      </button>
    </>
  )
}

function Options({ title, options, on, onPick, onClose }: { title: string; options: { id: string; name: string }[]; on: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <>
      <SheetHead title={title} onClose={onClose} />
      <div className="options" role="radiogroup" aria-label={title}>
        {options.map((o) => (
          <button key={o.id} role="radio" aria-checked={on === o.id} className={`option${on === o.id ? ' on' : ''}`} onClick={() => onPick(o.id)}>
            {o.name}
          </button>
        ))}
      </div>
    </>
  )
}

function SheetHead({ title, onClose, children }: { title: string; onClose: () => void; children?: ReactNode }) {
  return (
    <header className="sheet-head">
      <h2>{title}</h2>
      {children}
      <button className="d-btn" onClick={onClose} aria-label="סגור">
        ✕
      </button>
    </header>
  )
}

/** A note on the proposal shown, or on one point of it: 📍 hides the sheet until a point is touched, the words kept. */
function NoteSheet({
  title,
  text,
  setText,
  point,
  onPoint,
  onNoPoint,
  notes,
  onRemove,
  onSave,
  onClose,
}: {
  title: string
  text: string
  setText: (t: string) => void
  point: boolean
  onPoint: () => void
  onNoPoint: () => void
  notes: Note[]
  onRemove: (id: string) => void
  onSave: (text: string) => void
  onClose: () => void
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => area.current?.focus({ preventScroll: true }), [])
  return (
    <>
      <SheetHead title={title} onClose={onClose} />
      <textarea ref={area} value={text} onChange={(e) => setText(e.target.value)} placeholder="מה לשנות? למשל: הכפתור קטן מדי, הכוכב צריך להיות גדול יותר…" rows={3} />
      {point ? (
        <button className="note-point on" onClick={onNoPoint}>
          📍 על הנקודה שסימנת · <u>בלי נקודה</u>
        </button>
      ) : (
        <button className="note-point" onClick={onPoint}>
          📍 לסמן נקודה במסך
        </button>
      )}
      <div className="sheet-actions">
        <button className="soft-btn" onClick={onClose}>
          ביטול
        </button>
        <button className="primary-btn" disabled={!text.trim()} onClick={() => onSave(text.trim())}>
          שמירה
        </button>
      </div>
      {notes.length > 0 && (
        <ul className="notes">
          {notes.map((n) => (
            <li key={n.id}>
              <span>
                {n.x != null && '📍 '}
                {n.text}
              </span>
              <button className="d-btn" onClick={() => onRemove(n.id)} aria-label={`למחוק: ${n.text}`}>
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
