import { AnimatePresence, animate, m, useReducedMotion } from 'motion/react'
import { Popover } from 'radix-ui'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Crown } from '@phosphor-icons/react/dist/csr/Crown'
import { Broadcast } from '@phosphor-icons/react/dist/csr/Broadcast'
import { MACHINES, RECIPES, produceById, storeOf, type ProduceId } from '../../../src/farm/data'
import { iconUrl } from '../../../src/farm/icons'
import { MachinePanelView } from '../../../src/farm/machine/MachinePanelView'
import { SAMPLES, sampleActions, sampleView } from '../../../src/farm/machine/sample'
import { sourceOf } from '../../../src/farm/goods/sources'
import '../../../src/farm/orderBoard/OrdersBoard.css'
import { art } from '../../../src/ui/art'
import { ItemPic } from '../../../src/ui/ItemPic'
import { CaretLeft, Check, LockSimple, NavigationArrow } from '../../../src/ui/glyphs'
import { DID, PRESS, SPRING } from '../../../src/ui/motion'
import { Coins, Shell } from '../../../src/ui/Shell'
import type { Act } from '../../board'
import { AnimalToolsA } from '../animal-tools/AnimalToolsA'
import { Behind, LadderAsk, Price } from '../animal-tools/parts'
import { crownPic, nestPic, toolAt, type ToolState } from '../animal-tools/sample'
import { BARN, REMOTE_PRICE, REMOTES, TOOLS, goFor, openWords, type Go, type RemoteId, type RemoteState } from './data'
import './parts.css'

// What the premium board's variants share: the scenes where a good's picture opens its "where is it made" bubble (the
// barn, the line at the gate, the oven's recipe), the bubble itself (the order board's: its name, how many are kept,
// where it comes from — the game's sourceOf — and the button goFor picks), a panel opened from afar (the game's own
// machine panel, the mill; the animal-tools board's A for the coop) with the remote's tag over it and the way back, and
// the remotes in the shop with their card. The variants differ in the premium look (`look`): its class on everything
// premium, the moment as "Open" is pressed, and the tag of a panel opened from afar.

export type Look = 'a' | 'b' | 'c'
const cap = (t: string) => t[0].toUpperCase() + t.slice(1)
/** A phone on its side: the bubble keeps clear of its notch and rounded corners (the safe areas). */
const wide = () => matchMedia('(orientation: landscape) and (max-height: 560px)').matches

/** The premium look's crown, as each variant draws it: a crown on gold leaf (A), a gold crown on velvet (B), a seal (C). */
export function Mark({ look }: { look: Look }) {
  if (look === 'c')
    return (
      <span className="pr-seal" aria-hidden="true">
        <Crown weight="fill" />
      </span>
    )
  return <Crown weight="fill" className="pr-crown" aria-hidden="true" />
}

/** A slow light across a premium thing (Motion: still for whoever prefers less motion). */
export function Shine({ delay = 0.6 }: { delay?: number }) {
  return (
    <m.i
      className="pr-shine"
      aria-hidden="true"
      initial={{ x: '-140%' }}
      animate={{ x: ['-140%', '240%'] }}
      transition={{ duration: 1.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 3.2, delay }}
    />
  )
}

/** What a premium button does as it is pressed, before the panel comes: A a flash of light, B the remote's waves,
 *  C the seal stamped. Then `then` (nothing waits for it with less motion). */
function useMoment(look: Look) {
  const still = useReducedMotion()
  return (el: HTMLElement, then: () => void) => {
    if (still) return then()
    if (look === 'a') void animate(el, { scale: [1, 1.08, 1], filter: ['brightness(1)', 'brightness(1.25)', 'brightness(1)'] }, { duration: 0.32 })
    if (look === 'b') el.querySelectorAll<HTMLElement>('.pr-wave').forEach((w, i) => void animate(w, { scale: [0.6, 2.4], opacity: [0.9, 0] }, { duration: 0.55, delay: i * 0.12, ease: 'easeOut' }))
    if (look === 'c') {
      const seal = el.querySelector('.pr-seal')
      if (seal) void animate(seal, { scale: [1, 1.5, 0.9, 1], rotate: [0, -24, 8, 0] }, { duration: 0.42 })
    }
    window.setTimeout(then, look === 'b' ? 420 : 340)
  }
}

/** The button under a bubble's words, as goFor picks it: open (premium), Show me (walk), or nothing. */
export function GoButton({ go, look, onGo }: { go: Go; look: Look; onGo: (go: Go) => void }) {
  const moment = useMoment(look)
  if (go.kind === 'none') return <span className="pr-far">On the farm</span>
  if (go.kind === 'show')
    return (
      <Popover.Close asChild>
        <button className="btn soft small ob-show" onClick={() => onGo(go)}>
          <NavigationArrow weight="fill" /> Show me
        </button>
      </Popover.Close>
    )
  const pic = go.kind === 'machine' ? art(go.id === 'mill' ? 'sheaf-of-rice' : go.id === 'loom' ? 'yarn' : 'shortcake') : TOOLS[go.tool].pic
  return (
    <m.button className="btn small pr-go pr-premium" {...PRESS} onClick={(e) => moment(e.currentTarget, () => onGo(go))} aria-label={`${openWords(go)} (remote)`}>
      {look === 'b' && (
        <span className="pr-waves" aria-hidden="true">
          <i className="pr-wave" />
          <i className="pr-wave" />
          <i className="pr-wave" />
        </span>
      )}
      <Mark look={look} />
      <img className="pr-go-pic" src={pic} alt="" />
      {openWords(go)}
      {look !== 'c' && <Shine />}
    </m.button>
  )
}

/** A good's picture in a panel (the plan's GoodPic): a tap opens its bubble — its name, how many are kept, where it
 *  comes from, and the button goFor picks. */
export function GoodPic({
  good,
  count,
  s,
  look,
  pop,
  setPop,
  onGo,
  label,
  className = '',
}: {
  good: ProduceId
  count?: number
  s: RemoteState
  look: Look
  pop: ProduceId | null
  setPop: (g: ProduceId | null) => void
  onGo: (go: Go) => void
  label?: ReactNode
  className?: string
}) {
  const src = sourceOf(good)
  const go = goFor(good, s)
  const kept = BARN.find(([g]) => g === good)?.[1] ?? 0
  return (
    <Popover.Root open={pop === good} onOpenChange={(o) => setPop(o ? good : null)}>
      <Popover.Trigger asChild>
        <m.button className={`pr-good ${className}`} data-good={good} whileTap={{ scale: 0.9, rotate: -6 }} transition={SPRING.pop} aria-label={`${cap(produceById(good).plural)}: where is it made`}>
          <ItemPic id={good} count={count} />
          {label}
        </m.button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={`ob-pop pr-pop v-premium-remotes-${look}`} side="top" sideOffset={6} collisionPadding={wide() ? { top: 10, bottom: 26, left: 54, right: 54 } : 12}>
          <m.div initial={{ opacity: 0, scale: 0.85, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={SPRING.pop}>
            <b className="ob-pop-name">{produceById(good).name}</b>
            <span className="ob-pop-store">{kept > 0 ? `${kept} in the ${storeOf(good)}` : `None in the ${storeOf(good)}`}</span>
            <span className="ob-src">
              <img className="art" src={src.pic} alt="" />
              <span>
                {src.words}
                {src.from && (
                  <>
                    {' from '}
                    <span className="ob-from">
                      {src.from.map((f) => (
                        <ItemPic key={f} id={f} />
                      ))}
                    </span>
                  </>
                )}
              </span>
            </span>
            <GoButton go={go} look={look} onGo={onGo} />
          </m.div>
          <Popover.Arrow className="ob-pop-arrow" width={14} height={7} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Where the bubble's button leads in the board: a panel from afar (the scene changes), or "Show me" (the panel
 *  closes: in the game you walk there). */
export function useGo(s: RemoteState, act: Act<RemoteState>) {
  return (go: Go) => {
    if (go.kind === 'machine') act.set({ ...s, scene: 'afar-mill', from: s.scene === 'shop' || s.scene.startsWith('afar') ? 'barn' : (s.scene as 'barn' | 'line' | 'oven'), open: undefined })
    else if (go.kind === 'tool') act.set({ ...s, scene: 'afar-coop', from: s.scene === 'shop' || s.scene.startsWith('afar') ? 'barn' : (s.scene as 'barn' | 'line' | 'oven'), open: undefined })
    else if (go.kind === 'show') act.close()
  }
}

/** The bubble that is open: the scene's own at first (after the panel's way in), then whichever is tapped. */
function usePop(s: RemoteState) {
  const [pop, setPop] = useState<ProduceId | null>(null)
  useEffect(() => {
    if (!s.open) return
    const t = window.setTimeout(() => setPop(s.open!), 420)
    return () => window.clearTimeout(t)
  }, [s.open])
  return [pop, setPop] as const
}

// ── the scenes ──

/** The barn's panel (src/farm/StorePanel.tsx): what is inside, each good a picture that opens its bubble. */
export function BarnScene({ s, act, look }: { s: RemoteState; act: Act<RemoteState>; look: Look }) {
  const [pop, setPop] = usePop(s)
  const go = useGo(s, act)
  return (
    <Shell
      title="Barn"
      art={iconUrl('barn')}
      sub={
        <>
          <span className="tag fill">
            <img src={iconUrl('barn')} alt="" />
            {BARN.reduce((a, [, n]) => a + n, 0)}/150
          </span>
          <span className="tag level">Level 3</span>
          {s.map === 'home' && (
            <span className="tag">
              <img src={art('house')} alt="" />
              In the house
            </span>
          )}
        </>
      }
      onClose={act.close}
    >
      <div className="farm-basket">
        {BARN.map(([g, n]) => (
          <div key={g} className="farm-basket-item">
            <GoodPic good={g} count={n} s={s} look={look} pop={pop} setPop={setPop} onGo={go} />
            <span>{cap(produceById(g).plural)}</span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

/** The line at the gate (src/farm/FarmUI.tsx QueuePanel): a buyer who wants flour and eggs, and what they pay. */
export function LineScene({ s, act, look }: { s: RemoteState; act: Act<RemoteState>; look: Look }) {
  const [pop, setPop] = usePop(s)
  const go = useGo(s, act)
  const buyers: { pic: 'office-worker' | 'man-office-worker'; wants: [ProduceId, number][]; pays: number }[] = [
    {
      pic: 'office-worker',
      wants: [
        ['flour', 2],
        ['egg', 4],
      ],
      pays: 28,
    },
    { pic: 'man-office-worker', wants: [['milk', 2]], pays: 12 },
  ]
  return (
    <Shell title="Line at the gate" art={art('people-queue')} sub={<span className="tag">2 waiting</span>} onClose={act.close}>
      <div className="pr-line">
        {buyers.map((b, i) => (
          <div key={i} className="farm-shop-item pr-buyer">
            <img className="art" src={art(b.pic)} alt="" />
            <div className="pr-wants">
              {b.wants.map(([g, n]) => (
                <GoodPic key={g} good={g} count={n} s={s} look={look} pop={pop} setPop={setPop} onGo={go} />
              ))}
            </div>
            <button className="btn small" disabled={i === 0} onClick={act.close}>
              Sell · <Coins n={b.pays} />
            </button>
          </div>
        ))}
      </div>
    </Shell>
  )
}

/** The oven's recipe (the machine panel's card, src/farm/machine/RecipeCard.tsx): the lemon cake, its flour missing. */
export function OvenScene({ s, act, look }: { s: RemoteState; act: Act<RemoteState>; look: Look }) {
  const [pop, setPop] = usePop(s)
  const go = useGo(s, act)
  const cake = RECIPES.find((r) => r.id === 'lemon_cake')!
  const have: Partial<Record<ProduceId, number>> = { flour: 0, sugar: 4, egg: 12, milk: 5, lemon: 6 }
  return (
    <Shell title="Oven" art={art('shortcake')} sub={<span className="tag level">Level 3</span>} onClose={act.close}>
      <div className="pr-recipe">
        <img className="art pr-recipe-pic" src={iconUrl(cake.makes)} alt="" />
        <div className="pr-recipe-text">
          <strong>{cap(produceById(cake.makes).name)}</strong>
          <div className="pr-needs">
            {(Object.entries(cake.needs) as [ProduceId, number][]).map(([g, n]) => (
              <span key={g} className={`pr-need${(have[g] ?? 0) < n ? ' short' : ''}`}>
                <GoodPic good={g} count={n} s={s} look={look} pop={pop} setPop={setPop} onGo={go} />
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="pr-missing">
        <img className="art" src={iconUrl('flour')} alt="" /> Not enough flour for a lemon cake
      </p>
    </Shell>
  )
}

/** Where the sheet of a panel opened from afar is (the tag stands on its edge). */
function useSheetRect() {
  const [r, setR] = useState<DOMRect | null>(null)
  useEffect(() => {
    let raf = 0
    let n = 0
    const read = () => {
      const el = document.querySelector('.mp-sheet')
      if (el) setR(el.getBoundingClientRect())
      if (++n < 90) raf = requestAnimationFrame(read)
    }
    read()
    const again = () => {
      n = 0
      read()
    }
    addEventListener('resize', again)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', again)
    }
  }, [])
  return r
}

const FROM_WORD = { barn: 'Barn', line: 'Line', oven: 'Oven' } as const

/** The tag of a panel opened from afar: "Remote" and the way back to where it was opened (the panel's own way out,
 *  then that panel again). A: a gold tab on the sheet's corner; B: a dark pill on the grabber with the waves; C: a
 *  ribbon "Barn › Mill" over the sheet. */
export function RemoteTag({ look, from, here, onBack }: { look: Look; from: 'barn' | 'line' | 'oven'; here: string; onBack: () => void }) {
  const r = useSheetRect()
  if (!r) return null
  const aside = wide()
  // upright, over the sheet's top edge (B in its middle, on the grabber); sideways, beside its head, in the scene
  const style = aside ? { right: innerWidth - r.left + 10, top: r.top + 66 } : look === 'b' ? { left: r.left + r.width / 2, top: r.top - 26 } : { left: r.left + 14, top: r.top - 30 }
  const back = (
    <m.button className="pr-back" onClick={onBack} {...PRESS} aria-label={`Back to the ${FROM_WORD[from].toLowerCase()}`}>
      <CaretLeft weight="bold" />
      {FROM_WORD[from]}
    </m.button>
  )
  return (
    <m.div
      className={`pr-tag pr-tag-${look}${aside ? ' wide' : ''}`}
      style={style}
      initial={look === 'c' ? { scaleX: 0, opacity: 0 } : { scale: 0.5, opacity: 0 }}
      animate={look === 'c' ? { scaleX: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
      transition={{ ...SPRING.pop, delay: 0.32 }}
    >
      {look === 'a' && (
        <>
          {back}
          <span className="pr-tag-word pr-premium">
            <Crown weight="fill" className="pr-crown" />
            Remote
            <Shine delay={0.9} />
          </span>
        </>
      )}
      {look === 'b' && (
        <>
          {back}
          <span className="pr-tag-word pr-premium">
            <Broadcast weight="bold" className="pr-cast" />
            Remote
          </span>
        </>
      )}
      {look === 'c' && (
        <>
          <span className="pr-seal" aria-hidden="true">
            <Crown weight="fill" />
          </span>
          {back}
          <span className="pr-crumb">›</span>
          <b className="pr-here">{here}</b>
        </>
      )}
    </m.div>
  )
}

/** Back to where a panel from afar was opened: the panel's own way out (Esc), then that panel again. */
const backFrom = (s: RemoteState, act: Act<RemoteState>) => () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  window.setTimeout(() => act.set({ ...s, scene: s.from ?? 'barn', open: undefined }), 260)
}

/** The mill opened from afar: the game's own machine panel (sample data), the remote's tag over it. */
export function AfarMill({ s, act, look }: { s: RemoteState; act: Act<RemoteState>; look: Look }) {
  const model = useMemo(() => SAMPLES.mill.make(), [])
  const [, bump] = useState(0)
  const actions = useMemo(() => sampleActions(model, () => bump((n) => n + 1)), [model])
  return (
    <>
      <MachinePanelView v={sampleView(model)} act={actions} coins={s.coins} onClose={() => act.set({ ...s, scene: s.from ?? 'barn', open: undefined })} />
      <RemoteTag look={look} from={s.from ?? 'barn'} here={MACHINES.mill.name} onBack={backFrom(s, act)} />
    </>
  )
}

/** The coop opened from afar: the animal-tools board's A (whichever is chosen there), the remote's tag over it. */
export function AfarCoop({ s, act, look }: { s: RemoteState; act: Act<RemoteState>; look: Look }) {
  const [t, setT] = useState<ToolState>(() => toolAt('hens', { has: [3, 2, 3, 1, 0, 2], coins: s.coins }))
  return (
    <>
      <AnimalToolsA s={t} act={{ set: setT, close: () => act.set({ ...s, scene: s.from ?? 'barn', open: undefined }) }} />
      <RemoteTag look={look} from={s.from ?? 'barn'} here={TOOLS.hens.name} onBack={backFrom(s, act)} />
    </>
  )
}

/** The shop's premium part: the two remotes as cards in the variant's look; a tap opens the ladder card. */
export function ShopScene({ s, act, look }: { s: RemoteState; act: Act<RemoteState>; look: Look }) {
  const [asking, setAsking] = useState<RemoteId | null>(null)
  const anyTool = Object.values(s.tools).some(Boolean)
  const ref = useRef<HTMLDivElement>(null)
  return (
    <>
      <Shell
        title="Shop"
        art={art('shopping-bags')}
        sub={
          <span className="tag">
            <img src={art('coin')} alt="" />
            {s.coins.toLocaleString('en-US')}
          </span>
        }
        onClose={act.close}
      >
        <div className="pr-shop" ref={ref}>
          <h3 className="pr-heading">
            <Mark look={look} />
            Premium
          </h3>
          {(['machine-remote', 'animal-remote'] as RemoteId[]).map((id, i) => {
            const owned = s.remotes[id]
            const locked = id === 'animal-remote' && !anyTool
            return (
              <m.div
                key={id}
                className={`pr-card pr-premium-card${owned ? ' owned' : ''}${locked ? ' locked' : ''}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0, transition: { ...SPRING.pop, delay: 0.1 + i * 0.06 } }}
              >
                <span className="pr-card-pic">
                  <img className="art" src={id === 'machine-remote' ? art('gear') : nestPic} alt="" />
                  <img className="pr-card-crown" src={crownPic} alt="" />
                </span>
                <div className="pr-card-text">
                  <strong>{REMOTES[id].name}</strong>
                  <small>{REMOTES[id].short}</small>
                </div>
                {owned ? (
                  <span className="tag ok">
                    <Check weight="bold" />
                    Yours
                  </span>
                ) : locked ? (
                  <span className="tag pr-need-tool">
                    <LockSimple weight="fill" />
                    Needs a tool
                  </span>
                ) : (
                  <m.button className="btn small pr-buy pr-premium" {...PRESS} onClick={() => setAsking(id)} aria-label={`${REMOTES[id].name}, for ${REMOTE_PRICE} coins`}>
                    <Mark look={look} />
                    <Price n={REMOTE_PRICE} />
                    {look !== 'c' && <Shine delay={0.4 + i * 0.5} />}
                  </m.button>
                )}
                {look !== 'b' && <Shine delay={1.2 + i * 0.7} />}
              </m.div>
            )
          })}
        </div>
      </Shell>
      <AnimatePresence>
        {asking && (
          <LadderAsk
            l={{ name: REMOTES[asking].name, now: REMOTES[asking].short, price: REMOTE_PRICE }}
            pic={asking === 'machine-remote' ? art('gear') : nestPic}
            coins={s.coins}
            line={REMOTES[asking].blurb}
            className={`pr-ask v-premium-remotes-${look}`}
            badge={<img className="pr-card-crown" src={crownPic} alt="" />}
            onClose={() => setAsking(null)}
            onBuy={() => {
              act.set({ ...s, coins: s.coins - REMOTE_PRICE, remotes: { ...s.remotes, [asking]: true } })
              setAsking(null)
              const card = ref.current?.querySelectorAll('.pr-card')[asking === 'machine-remote' ? 0 : 1]
              if (card) void animate(card, DID.keyframes, DID.options)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

/** A variant: its look's class round the scene of the state (and the game's top behind it). */
export function Scenes({ s, act, look }: { s: RemoteState; act: Act<RemoteState>; look: Look }) {
  // one panel gives way to another (the barn to the mill, and back): the shade stays while the new one's comes in
  const first = useRef(s.scene)
  return (
    <div className={`v-premium-remotes-${look} pr-root`}>
      {s.scene !== 'afar-coop' && <Behind coins={s.coins} level={14} />}
      {s.scene !== first.current && <m.i key={s.scene} className="pr-bridge" aria-hidden="true" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.34, delay: 0.06 }} />}
      {s.scene === 'barn' && <BarnScene s={s} act={act} look={look} />}
      {s.scene === 'line' && <LineScene s={s} act={act} look={look} />}
      {s.scene === 'oven' && <OvenScene s={s} act={act} look={look} />}
      {s.scene === 'afar-mill' && <AfarMill s={s} act={act} look={look} />}
      {s.scene === 'afar-coop' && <AfarCoop s={s} act={act} look={look} />}
      {s.scene === 'shop' && <ShopScene s={s} act={act} look={look} />}
    </div>
  )
}
