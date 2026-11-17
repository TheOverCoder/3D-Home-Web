import { useEffect, useState } from 'react'
import { farmSound, placeSound, uiClick } from '../audio/sound'
import { playGesture } from '../lib/gestures'
import { useHome, type Panel } from '../store'
import { RemoteTag } from '../ui/GoodPic'
import { MACHINES, type MachineId } from './data'
import { backWords } from './goods/ways'
import { MachinePanelView } from './machine/MachinePanelView'
import type { MachineActions } from './machineView'
import { farm, machineActions, machineView, useFarm } from './state'

// A machine's panel in the game (the action button opens it when nothing is done, and the gear on each machine): the
// designed panel (./machine/MachinePanelView.tsx, which draws a MachineView and calls MachineActions) fed with the
// farm's, with the game's sounds on what it does. `machine-slot` (the next place, asked for) is the same panel with
// its card that asks already open. Opened from afar by the machines' remote (a good's bubble in another panel: `from`),
// the remote's tag stands on it with the way back, and its ✕ goes back there too.

/** Draws again every second while open: the view's times follow the farm (the panel runs its clocks in between). */
function useSeconds() {
  const [, setNow] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
}

export function MachinePanel({ id, buying, from }: { id: MachineId; buying?: boolean; from?: Panel }) {
  useFarm((s) => s.rev)
  useSeconds()
  const close = useHome((s) => s.closePanel)
  const openPanel = useHome((s) => s.openPanel)
  const back = () => (from ? openPanel(from) : close())
  const def = MACHINES[id]
  const act = machineActions(id)
  // its sounds from where it stands; opened from afar (a remote), the interface's own
  const at = () => (from ? { pan: 0, near: 1 } : placeSound(def.x, def.z))
  // the farm's actions, each with its sound when it did something
  const sounded: MachineActions = {
    add: (recipe, i) => {
      const ok = act.add(recipe, i)
      if (ok) {
        const { pan, near } = at()
        farmSound(def.sounds.load, pan, near, 'tick')
        playGesture('interact')
      }
      return ok
    },
    remove: (i) => {
      const ok = act.remove(i)
      if (ok) uiClick()
      return ok
    },
    move: (from, to) => {
      const ok = act.move(from, to)
      if (ok) uiClick()
      return ok
    },
    collect: () => {
      const n = act.collect()
      if (n) {
        const { pan, near } = at()
        farmSound('harvest', pan, near)
        playGesture('interact')
      }
      return n
    },
    buySlot: () => {
      const ok = act.buySlot()
      if (ok) {
        farmSound('build')
        playGesture('interact')
      }
      return ok
    },
  }
  return (
    <>
      <MachinePanelView v={machineView(id)} act={sounded} coins={farm.coins} onClose={back} buying={buying} />
      {from && <RemoteTag back={backWords(from)} onBack={back} />}
    </>
  )
}

/** The next place of a machine's queue, asked for: its panel, with the card that asks open. */
export const MachineSlotCard = ({ id }: { id: MachineId }) => <MachinePanel id={id} buying />
