import { GoodPic } from '../../ui/GoodPic'
import { LockTag } from '../../ui/LockTag'
import { MACHINES, produceById, type ProduceId } from '../data'
import type { DeskView } from './ComputerDesk'
import type { PlanRow } from './planView'
import { coinsText, lengthText } from './words'

// The computer's Planner (./apps.ts): what the line at the gate and the open orders want now against what the farm
// has, the largest shortage first ("Asked"); every crop by the coins a bed brings a minute and a harvest ("Beds");
// every recipe by what a job adds to its ingredients and what a minute of the machine's work adds, at its level, and
// how many the store could start now ("Machines"). Draws the Planner's view (./planView.ts); what is not open yet
// shows the level it opens at.

const cap = (t: string) => t[0].toUpperCase() + t.slice(1)
const nameOf = (id: ProduceId) => cap(produceById(id).plural)

export function PlanApp({ v, tab }: { v: DeskView; tab: string }) {
  if (tab === 'beds') return <Ranked rows={v.plan.beds} />
  if (tab === 'machines') return <Ranked rows={v.plan.jobs} />
  return <Asked v={v} />
}

function Asked({ v }: { v: DeskView }) {
  const rows = v.plan.asked
  if (!rows.length) return <p className="mp-note calm">Nobody at the gate or on the order board wants anything right now.</p>
  return (
    <div className="pc-list">
      <p className="pc-say">What the line at the gate and the open orders want, against what you have.</p>
      {rows.map((r) => (
        <div key={r.good} className="pc-row" data-good={r.good}>
          <GoodPic good={r.good} count={r.want} className="pc-good" />
          <span className="pc-row-text">
            <span className="pc-row-name">{nameOf(r.good)}</span>
            <span className="pc-row-sub">
              {r.want} wanted, you have {r.have}
            </span>
          </span>
          {r.short > 0 ? <span className="tag short">{r.short} short</span> : <span className="tag ok">Enough</span>}
        </div>
      ))}
    </div>
  )
}

/** Beds or jobs, the most a minute first; those not open yet last, with the level they open at. */
function Ranked({ rows }: { rows: PlanRow[] }) {
  const sorted = [...rows.filter((r) => r.locked === null), ...rows.filter((r) => r.locked !== null).sort((a, b) => a.locked! - b.locked!)]
  return (
    <div className="pc-list">
      <p className="pc-say">{rows[0]?.kind === 'job' ? 'What a job adds to its ingredients, at today’s prices and the machine’s level.' : 'What a bed brings, its seeds paid, at today’s prices.'}</p>
      {sorted.map((r) => (
        <div key={r.id} className={`pc-row${r.locked !== null ? ' locked' : ''}`} data-plan={r.id}>
          <GoodPic good={r.makes} className="pc-good" />
          <span className="pc-row-text">
            <span className="pc-row-name">
              {nameOf(r.makes)}
              {r.machine && <span className="pc-row-at"> · {MACHINES[r.machine].name}</span>}
            </span>
            <span className="pc-row-sub">
              {coinsText(r.perPress)} a {r.kind === 'job' ? 'job' : 'harvest'} · {lengthText(r.seconds)}
              {r.locked === null && r.can !== undefined ? ` · you can make ${r.can}` : ''}
            </span>
          </span>
          {r.locked !== null ? (
            <LockTag level={r.locked} />
          ) : (
            <span className="pc-per-minute">
              <b>{coinsText(r.perMinute)}</b>
              <span>a minute</span>
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
