import { useEffect, useState } from 'react'
import { farmSound, placeSound, uiClick } from '../audio/sound'
import { useHome, type Panel } from '../store'
import { RemoteTag } from '../ui/GoodPic'
import { PRODUCERS, TOOLS, type LadderId, type ToolKind } from './data'
import { backWords } from './goods/ways'
import { toWorld } from './layout'
import { LadderCard } from './Ladder'
import { farm, toolTake, toolView, useFarm } from './state'
import { ToolPanelView } from './tool/ToolPanelView'
import type { ToolActions } from './toolView'

// An animal's tool, its panel in the game (E at its place by the fence opens it; the shop's card of an owned tool; a
// good's bubble with the animals' remote): the designed panel (./tool/ToolPanelView.tsx, which draws a ToolView and
// calls ToolActions) fed with the farm's. Each tap is the farm's (toolTake: the same goods, XP and surprises as
// collecting one by one), with the producer's own sound and its touch — from where the tool stands, or the
// interface's own when the panel was opened from afar. Its two upgrades open their card over the panel (it stays);
// Skins opens the tool's skins. Opened from another panel (`from`), its ✕ goes back there; opened by a remote, the
// remote's tag stands on it with the way back.

/** Draws again every second while open: the rings and times follow the farm. */
function useSeconds() {
  const [, setNow] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
}

/** Where the tool stands now (its pen moves with the edit mode): its sounds come from there. */
function standsAt(kind: ToolKind) {
  const pen = farm.layout.places[PRODUCERS[kind].place!]
  const [x, z] = toWorld(pen, TOOLS[kind].aim[0], TOOLS[kind].aim[2])
  return placeSound(x, z)
}

export function ToolPanel({ tool, from }: { tool: ToolKind; from?: Panel }) {
  useFarm((s) => s.rev)
  useSeconds()
  const openPanel = useHome((s) => s.openPanel)
  const close = useHome((s) => s.closePanel)
  const [asking, setAsking] = useState<LadderId | null>(null)
  // opened by a remote (from a good's bubble in another panel): not from the shop, whose card opens it as a link
  const remote = !!from && from.kind !== 'shop'
  const back = () => (from ? openPanel(from) : close())
  // Esc with its card open: the card goes, the panel stays (before the game's own Esc, which would close both)
  useEffect(() => {
    if (!asking) return
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setAsking(null)
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [asking])
  const act: ToolActions = {
    tap: (spot) => {
      const n = toolTake(tool, spot)
      if (n) {
        const { pan, near } = remote ? { pan: 0, near: 1 } : standsAt(tool)
        farmSound(PRODUCERS[tool].sound, pan, near, 'tick')
      } else uiClick(false)
      return n
    },
    upgrade: (id) => {
      uiClick()
      setAsking(id)
    },
    // its skins shop, whose ✕ comes back here (and from here where this panel came from)
    skins: () => openPanel({ kind: 'skins', tool, from: { kind: 'tool', tool, from } }),
  }
  return (
    <>
      <ToolPanelView v={toolView(tool)} act={act} coins={farm.coins} onClose={back} near={remote && from ? <RemoteTag back={backWords(from)} onBack={back} /> : undefined} />
      {asking && <LadderCard id={asking} onBack={() => setAsking(null)} />}
    </>
  )
}
