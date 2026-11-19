import { uiClick } from '../../audio/sound'
import { useWalk, walkTo } from '../../lib/route/walking'
import { useHome, type Panel } from '../../store'
import { art, type ArtId } from '../../ui/art'
import type { GoodGo, GoodWays } from '../../ui/GoodPic'
import { MACHINES, STORES, TOOLS, TOOL_KINDS, storeOf, type MachineId, type ProduceId } from '../data'
import { farm, ladderMaxed, toolOwned } from '../state'
import { placeFor } from '../walkTargets'
import { goFor } from './go'

// "Where is it made" in the game (src/ui/GoodPic.tsx draws the bubble; ./go.ts picks its button): what the button does
// on this farm — a remote owned opens the machine or the tool from afar, coming back to the panel the good was tapped
// in; on the farm "Show me" closes the panel and walks you to where the good is made, as a compass mark tapped does.
// Given once round the farm's panels (src/farm/FarmUI.tsx), so every GoodPic in them has it.

/** Each machine's picture (its panel's, the bubble's "Open the mill"). */
export const MACHINE_PIC: Record<MachineId, ArtId> = { mill: 'sheaf-of-rice', loom: 'yarn', oven: 'shortcake', dairy: 'cheese-wedge' }

/** The same panel (a machine's, a tool's) as the one open. */
const samePanel = (a: Panel, b: Panel | null) =>
  !!b && a.kind === b.kind && (a.kind === 'machine' ? b.kind === 'machine' && a.id === b.id : a.kind === 'tool' && b.kind === 'tool' && a.tool === b.tool)

/** The walk there: the panel closes (a panel open would stop the walk at once) and you go, as from the compass; a walk
 *  there already (to that place, or to that good's mark) goes on. */
function walkThere(id: string, good: ProduceId) {
  useHome.getState().closePanel()
  const w = useWalk.getState()
  if (w.id && (w.id === id || w.item === good)) return
  walkTo(id, good)
}

export const GAME_WAYS: GoodWays = {
  go: (good): GoodGo => {
    const s = useHome.getState()
    const ask = (remotes: boolean) =>
      goFor(good, {
        machineRemote: remotes && ladderMaxed('machine-remote'),
        animalRemote: remotes && ladderMaxed('animal-remote'),
        tools: TOOL_KINDS.filter((k) => toolOwned(k) !== null),
        map: s.map,
        placeFor,
        from: s.panel ?? undefined,
      })
    // (a remote never opens the panel the good was tapped in: the coop's own eggs walk you to the coop)
    let go = ask(true)
    if (go.kind === 'open' && samePanel(go.panel, s.panel)) go = ask(false)
    if (go.kind === 'walk') return { kind: 'walk', run: () => walkThere(go.to, good) }
    if (go.kind === 'none') return go
    const p = go.panel
    const open = () => {
      uiClick()
      useHome.getState().openPanel(p)
    }
    if (p.kind === 'machine') return { kind: 'open', words: `Open the ${MACHINES[p.id].name.toLowerCase()}`, pic: art(MACHINE_PIC[p.id]), run: open }
    if (p.kind === 'tool') return { kind: 'open', words: `Open the ${TOOLS[p.tool].name.toLowerCase()}`, pic: art(TOOLS[p.tool].art), run: open }
    return { kind: 'none' }
  },
  kept: (good) => ({ n: farm.inv[good], store: STORES[storeOf(good)].name.toLowerCase() }),
}

/** The way back from a panel opened from afar, in a word: the panel it was opened from ("‹ Barn"). */
export function backWords(from: Panel): string {
  switch (from.kind) {
    case 'store':
      return STORES[from.store].name
    case 'machine':
      return MACHINES[from.id].name
    case 'tool':
      return TOOLS[from.tool].name
    case 'queue':
      return 'Buyers'
    case 'orders':
      return 'Orders'
    case 'away':
      return 'Away'
    default:
      return 'Back'
  }
}
