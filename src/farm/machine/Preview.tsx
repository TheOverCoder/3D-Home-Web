import { useEffect, useMemo, useRef, useState } from 'react'
import { art } from '../../ui/art'
import { iconUrl } from '../icons'
import type { MachineView } from '../machineView'
import { MachinePanelView } from './MachinePanelView'
import { SAMPLES, sampleActions, sampleTick, sampleView, type SampleMachine } from './sample'
import './Preview.css'

// The machine panel on its own, while developing (?debug&preview=machine): over a still of the yard, with the coin and
// barn chips at the top (where collected goods fly), fed with SAMPLE DATA (./sample.ts) that runs on in real time (or
// faster), so every press and drag does what the game will. &sample=baking|first|ready|twelve|short|levelup|top|mill|loom,
// &speed=10 (the machine works ten times as fast; its times read so), &bare (no toolbar: for pictures).
// window.__machine drives it from a script (tick, load a sample).

const params = new URLSearchParams(location.search)

/** The view with its times as the clock on the wall sees them at `speed` (a 30 s cake at ×10 reads 0:03). */
function atSpeed(v: MachineView, speed: number): MachineView {
  if (speed === 1) return v
  return {
    ...v,
    slots: v.slots.map((s) => ({ ...s, seconds: s.seconds / speed, left: s.left / speed })),
    recipes: v.recipes.map((r) => ({ ...r, seconds: r.seconds / speed })),
  }
}

export function MachinePreview() {
  const [name, setName] = useState(() => (params.get('sample') && SAMPLES[params.get('sample')!] ? params.get('sample')! : 'baking'))
  const [speed, setSpeed] = useState(() => Math.max(1, Number(params.get('speed')) || 1))
  const [open, setOpen] = useState(true)
  const [, setRev] = useState(0)
  const model = useRef<SampleMachine>(SAMPLES[name].make())
  const bump = () => setRev((r) => r + 1)
  // new actions for each sample loaded (the model is a new one)
  const sample = model.current
  const act = useMemo(() => sampleActions(sample, bump), [sample])
  const paused = useRef(params.has('still'))

  // the machine works on: a few times a second (the panel runs its clocks between)
  useEffect(() => {
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = ((now - last) / 1000) * speed
      last = now
      if (!paused.current && sampleTick(model.current, dt)) bump()
    }, 200)
    return () => window.clearInterval(id)
  }, [speed, name])

  const load = (n: string) => {
    model.current = SAMPLES[n].make()
    setName(n)
    setOpen(true)
    bump()
  }
  useEffect(() => {
    ;(window as unknown as { __machine: unknown }).__machine = {
      model: () => model.current,
      tick: (seconds: number) => {
        sampleTick(model.current, seconds)
        bump()
      },
      pause: (p: boolean) => (paused.current = p),
      load,
      open: () => setOpen(true),
    }
  })

  const s = model.current
  const v = atSpeed(sampleView(s), speed)
  const barnUsed = 50 - s.room
  return (
    <div className="mpv-stage">
      <div className="farm-chip" role="group" aria-label="Your coins and the barn">
        <span className="farm-chip-item coins" key={`c${s.coins}`}>
          <img src={art('coin')} alt="" />
          <b>{s.coins}</b>
        </span>
        <span className={`farm-chip-item store barn${s.room <= 0 ? ' full' : ''}`} key={`b${barnUsed}`}>
          <img src={iconUrl('barn')} alt="" />
          <b>{barnUsed}/50</b>
        </span>
      </div>
      {open ? (
        <MachinePanelView key={name} v={v} act={act} coins={s.coins} onClose={() => setOpen(false)} />
      ) : (
        <button className="btn mpv-open" onClick={() => setOpen(true)}>
          Open the {v.name.toLowerCase()}
        </button>
      )}
      {!params.has('bare') && (
        <div className="mpv-bar">
          <select value={name} onChange={(e) => load(e.target.value)} aria-label="Sample">
            {Object.entries(SAMPLES).map(([k, x]) => (
              <option key={k} value={k}>
                {x.label}
              </option>
            ))}
          </select>
          <button onClick={() => setSpeed(speed === 1 ? 10 : 1)} aria-label="Speed">
            ×{speed}
          </button>
          <button
            onClick={() => {
              s.worked += 3600
              bump()
            }}
          >
            +1 h
          </button>
          <button onClick={() => load(name)}>Reset</button>
        </div>
      )}
    </div>
  )
}
