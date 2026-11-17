import { useState, type CSSProperties } from 'react'
import { PRODUCERS, count, storeCapacity } from '../../../src/farm/data'
import { iconUrl } from '../../../src/farm/icons'
import { ActionFace } from '../../../src/ui/ActionGlyph'
import { ArrowRight, Clock } from '../../../src/ui/glyphs'
import type { ActionIcon } from '../../../src/lib/interaction'
import { Behind, clock, useMode } from './parts'
import type { ToolState } from './sample'

// Today: no tool. Each animal is an offer of the action button of its own, where it stands (src/farm/Herd.tsx,
// useProducer): the hens' one shared nest (six eggs at most), each cow and each sheep (three bottles, two fleeces at
// most), so a herd is collected by walking from one to the next. Here the button and the line over it as the game
// draws them (src/ui/Hud.tsx, TouchControls.tsx), placed where the game puts them; a press takes what that one animal
// has, and the button turns to the next.

const WORD = { hens: 'Collect', cows: 'Milk', sheep: 'Shear' } as const

/** What waits today at each place: the hens' nest holds six; each cow three; each sheep two. */
function todayHas(s: ToolState): number[] {
  const most = PRODUCERS[s.kind].max
  if (s.kind === 'hens')
    return [
      Math.min(
        most,
        s.has.reduce((a, b) => a + b, 0),
      ),
    ]
  return s.has.map((h) => Math.min(most, h))
}

export function AnimalToolsToday({ s }: { s: ToolState }) {
  const mode = useMode()
  const [has, setHas] = useState(() => todayHas(s))
  const [ring, setRing] = useState(0)
  const p = PRODUCERS[s.kind]
  const full = s.stored >= storeCapacity(s.barn)
  const at = has.findIndex((n) => n > 0)
  const who = s.kind === 'hens' ? 'the nest' : p.herd!.names![Math.max(0, at)]
  const n = at >= 0 ? has[at] : 0
  const icon: ActionIcon = { verb: p.verb, item: p.good, count: n, word: WORD[s.kind] }
  const label = s.kind === 'hens' ? `Collect ${count(p.good, n)}` : `${WORD[s.kind]} ${who}: ${count(p.good, n)}`
  const status = at < 0 || full
  const size = 86
  const btn: CSSProperties = { right: 'calc(14px + env(safe-area-inset-right))', bottom: 'calc(14px + env(safe-area-inset-bottom))', width: size, height: size }
  const prompt: CSSProperties =
    mode === 'right' ? ({ '--prompt-left': '210px', '--prompt-right': '150px', '--prompt-bottom': '24px' } as CSSProperties) : ({ '--prompt-bottom': '190px' } as CSSProperties)
  const press = () => {
    setRing((r) => r + 1)
    if (status) return
    setHas((h) => h.map((x, i) => (i === at ? 0 : x)))
  }
  return (
    <div className="at-today">
      <Behind coins={s.coins} />
      <div className="hud-prompt" style={prompt}>
        {status ? (
          <div className="prompt status" data-verb="wait">
            {full ? (
              <span className="prompt-goods" aria-hidden="true">
                <span className="prompt-good">
                  <span className="prompt-pic">
                    <img src={iconUrl(p.good)} alt="" />
                  </span>
                  <b className="prompt-count">×{n}</b>
                </span>
                <ArrowRight weight="bold" className="prompt-arrow" />
                <span className="prompt-good prompt-full">
                  <span className="prompt-pic">
                    <img src={iconUrl('barn')} alt="" />
                  </span>
                  <b className="prompt-count">
                    {s.stored}
                    <span className="prompt-of">/{storeCapacity(s.barn)}</span>
                  </b>
                </span>
              </span>
            ) : (
              <span className="prompt-goods" aria-hidden="true">
                <span className="prompt-good">
                  <span className="prompt-pic">
                    <img src={iconUrl(p.good)} alt="" />
                  </span>
                </span>
                <span className="prompt-time">
                  <Clock weight="bold" />
                  {clock(Math.ceil((1 - Math.max(...s.next)) * p.every))}
                </span>
              </span>
            )}
            <span className="prompt-sr">{full ? 'The barn is full' : `Nothing to take yet`}</span>
          </div>
        ) : (
          <button className="prompt" data-verb={p.verb} onClick={press}>
            <span className="prompt-goods" aria-hidden="true">
              <span className="prompt-good">
                <span className="prompt-pic">
                  <img src={iconUrl(p.good)} alt="" />
                </span>
                <b className="prompt-count">×{n}</b>
              </span>
            </span>
            <span className="prompt-sr">{label}</span>
          </button>
        )}
      </div>
      <button
        className={`act-btn main${ring ? (ring % 2 ? ' ring-a' : ' ring-b') : ''}`}
        data-verb={status ? 'wait' : p.verb}
        style={btn}
        aria-label={status ? 'Nothing to take' : label}
        onClick={press}
      >
        <ActionFace icon={status ? { ...icon, verb: 'wait' } : icon} />
        <span className="act-word">{status ? 'Wait' : WORD[s.kind]}</span>
      </button>
    </div>
  )
}
