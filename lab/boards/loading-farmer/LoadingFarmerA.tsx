import { AnimatePresence, m } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { iconUrl } from '../../../src/farm/icons'
import { ItemPic } from '../../../src/ui/ItemPic'
import { art, type ArtId } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { Check, Clock } from '../../../src/ui/glyphs'
import { EASE } from '../../../src/ui/motion'
import { useLessMotion } from '../../../src/ui/still'
import type { Away } from '../loading/Chrome'
import { TIPS, loadView, useLive, useWide, type LoadingState, type LoadView } from '../loading/load'
import { STEPS, slowerThanUsual, stationOf, useStations, useStepAge, useTapOn } from '../loading/steps'
import './LoadingFarmerA.css'

// A · the farmer keeps you company. The loading screen is a short talk, not a bar: the farmer who walks a new farm
// through its first steps (his faces: src/assets/art/farmer-*.webp, the first steps' hint) leans on the farm's fence and
// says, in his own words, what is being done right now — the farm brought over, the house built, the lamps lit — and,
// when a step runs long, that it is slower on some phones and still going (an explained wait feels shorter than a
// silent one: Maister; seeing the work done makes it worth more: Buell & Norton). Under him, three stations of the way,
// each its own picture, word and fill: the one running fills fast and then slower (never full until its step ends,
// ../loading/steps.ts), the ones done are green with a tick. A tap on him: a wink and one tip about the farm, then back
// to what he is doing. A returning player (✦, sample data): he tells what waits on the farm, in pictures with counts.
// Ready: star eyes, a hop, the sun's rays opening behind him, the three ticks, one burst — a tap goes on to the menu.
//
// What keeps moving while the page is held (seconds, as the house is built and the graphics warm up): the clouds, his
// sway and breath, the dots after his words, the running station's fill and its picture's wiggle — every one a CSS or
// Web Animation of a transform or opacity, on the compositor. His words and a tap's answer wait for the page to be free.

type Mood = 'cheerful' | 'proud' | 'curious' | 'encouraging' | 'excited' | 'winking' | 'laughing'
const face = (mood: Mood) => art(`farmer-${mood}` as ArtId)

const STATION: Record<(typeof STEPS)[number], { pic: ArtId; word: string }> = {
  fetch: { pic: 'package', word: 'Farm' },
  build: { pic: 'building-construction', word: 'House' },
  light: { pic: 'light-bulb', word: 'Lamps' },
}

/** What he says now: his words, a smaller line under them, and his face. */
function talk(v: LoadView, s: LoadingState, slow: boolean): { say: string; more: string | null; mood: Mood } {
  if (v.ready) return { say: s.returning ? 'Welcome back! Your farm is waiting.' : 'Your farm is ready. Come on in!', more: null, mood: 'excited' }
  if (v.again) return { say: 'Starting again, a little lighter.', more: 'Lighter graphics suit this phone.', mood: 'encouraging' }
  if (slow)
    return {
      say: v.step === 'light' ? 'Still lighting the lamps…' : v.step === 'build' ? 'Still building the house…' : 'Still bringing the farm over…',
      more: 'This part is slower on some phones. It is going!',
      mood: 'encouraging',
    }
  if (v.step === 'fetch')
    return s.fromDevice >= s.total
      ? { say: 'Opening your farm…', more: null, mood: 'cheerful' }
      : { say: 'Bringing your farm over from town…', more: 'Only the first time: then it opens straight from your phone.', mood: 'cheerful' }
  if (v.step === 'build') return { say: 'Building your house, board by board…', more: null, mood: 'proud' }
  return { say: 'Lighting the lamps…', more: 'The last step.', mood: 'curious' }
}

export function LoadingFarmerA({ s, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const live = useLive(s)
  const v = loadView(live)
  const wide = useWide()
  const still = useLessMotion()
  const age = useStepAge(v.step)
  const slow = slowerThanUsual(v.step, age)
  const cur = stationOf(v.step)
  const fill = useStations(v.step, { prop: 'translate', val: (p) => `${(Math.max(0.04, p) - 1) * 100}% 0` }, live.total ? live.loaded / live.total : 0, v.again)
  // a tap on him: a tip in his words for a while, his face winking or laughing
  const [tip, setTip] = useState<number | null>(null)
  const tips = useRef(0)
  useEffect(() => {
    if (tip === null) return
    const t = setTimeout(() => setTip(null), 5200)
    return () => clearTimeout(t)
  }, [tip])
  const poke = () => {
    if (v.ready) return
    setTip(tips.current++ % TIPS.length)
  }
  // ready: one burst from him, once
  const him = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!v.ready || still) return
    const t = setTimeout(() => him.current && burst(him.current, { count: 70, spread: 90, power: 30 }), 380)
    return () => clearTimeout(t)
  }, [v.ready, still])
  useTapOn(v.ready, onPlay)
  const away: Away | undefined = live.away
  const said = talk(v, live, slow)
  const mood: Mood = tip !== null && !v.ready ? (tip % 2 ? 'laughing' : 'winking') : said.mood
  const key = v.ready ? 'ready' : tip !== null ? `tip${tip}` : away && v.step !== 'ready' ? 'away' : said.say
  return (
    <m.div
      className={`v-loading-farmer-a${wide ? ' wide' : ''}${v.ready ? ' ready' : ''}`}
      data-step={v.step}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.22 }}
    >
      <span className="lf-sky" aria-hidden="true">
        <i className="lf-glow" />
        <i className="lf-cloud c1" />
        <i className="lf-cloud c2" />
        <i className="lf-cloud c3" />
      </span>
      <svg className="lf-hills" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
        <path className="far" d="M0 70 C 60 30 120 40 170 62 S 290 20 400 52 V120 H0 Z" />
        <path className="near" d="M0 92 C 80 66 150 70 220 88 S 340 74 400 84 V120 H0 Z" />
      </svg>
      <span className="lf-ground" aria-hidden="true" />
      <span className="lf-farm" aria-hidden="true">
        <img className="art" src={iconUrl('barn')} alt="" />
        <img className="art" src={iconUrl('silo')} alt="" />
      </span>

      <m.header className="lf-name" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE.out }}>
        <h1 aria-label="3D Home">3D Home</h1>
        <p>A cosy house and farm</p>
      </m.header>

      <div className="lf-host">
        <m.div className="lf-bubble" initial={{ opacity: 0, scale: 0.7, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 26, delay: 0.25 }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <m.div key={key} className="lf-words" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: EASE.out }}>
              {tip !== null && !v.ready ? (
                <p className="lf-say lf-tip">
                  <img className="art" src={TIPS[tip].pic} alt="" />
                  <span>{TIPS[tip].text}</span>
                </p>
              ) : away && !v.ready ? (
                <>
                  <p className="lf-say">Welcome back! While you were away:</p>
                  <div className="lf-away">
                    {away.goods.map((g) => (
                      <ItemPic key={g.item} id={g.item} count={g.count} />
                    ))}
                    <span className="lf-buyers">
                      <img className="art" src={art('people-queue')} alt="" />
                      <b>{away.buyers}</b>
                    </span>
                  </div>
                  <p className="lf-more">All ready to collect, and {away.buyers} buyers at the gate.</p>
                </>
              ) : (
                <>
                  <p className="lf-say">
                    {v.ready && <Check weight="bold" aria-hidden="true" />}
                    {said.say}
                    {!v.ready && (
                      <span className="lf-dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </p>
                  {v.left && v.step === 'fetch' ? (
                    <p className="lf-more">
                      <Clock weight="bold" aria-hidden="true" /> {v.left} on this connection
                    </p>
                  ) : (
                    said.more && <p className="lf-more">{said.more}</p>
                  )}
                </>
              )}
            </m.div>
          </AnimatePresence>
        </m.div>
        <button ref={him} className="lf-farmer" aria-label="The farmer" onClick={poke}>
          <span className="lf-rays" aria-hidden="true" />
          <span className="lf-sway">
            <AnimatePresence mode="popLayout" initial={false}>
              <m.img
                key={mood}
                className="art"
                src={face(mood)}
                alt=""
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </AnimatePresence>
          </span>
        </button>
        <span className="lf-fence" aria-hidden="true">
          <i />
        </span>
      </div>

      <m.div
        className="lf-way"
        role="progressbar"
        aria-label={v.line}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={Math.min(3, cur)}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32, delay: 0.15 }}
      >
        {STEPS.map((st, i) => (
          <div key={st} className={`lf-station ${i < cur ? 'done' : i === cur ? 'now' : 'later'}`} style={{ '--i': i } as CSSProperties}>
            <span className="lf-pic">
              <img className="art" src={art(STATION[st].pic)} alt="" />
              {i < cur && (
                <b className="lf-tick" aria-hidden="true">
                  <Check weight="bold" />
                </b>
              )}
            </span>
            <span className="lf-word">{STATION[st].word}</span>
            <span className="lf-track" aria-hidden="true">
              <i ref={fill(i)} />
            </span>
          </div>
        ))}
      </m.div>
    </m.div>
  )
}
