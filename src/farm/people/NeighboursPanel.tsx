import { useHome } from '../../store'
import { farm, metNeighbours, useFarm } from '../state'
import { NeighboursCard } from './NeighboursCard'
import { neighboursView } from './view'

// The neighbours' sheet (./NeighboursCard.tsx draws it) fed with the farm's: who is met, their friendships, the story,
// the letters read. A letter touched opens to be read again.

export function NeighboursPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const openPanel = useHome((s) => s.openPanel)
  return <NeighboursCard v={neighboursView(metNeighbours(), farm.friends, farm.story, farm.mail)} onRead={(id) => openPanel({ kind: 'letter', id, again: true })} onClose={close} />
}
