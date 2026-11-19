import { useEffect, useState } from 'react'
import { useHome } from '../store'
import { AlbumCard } from './AlbumCard'
import { albumView } from './album'
import { farm, sawAlbum, useFarm } from './state'

// The farm album as the game opens it (the corner menu's "Album", src/ui/HudMode.tsx): it reads the farm; how it looks
// is ./AlbumCard.tsx, what it shows ./album.ts. Opened, every tile earned so far counts as shown; those new since the
// last time stay marked new while it is open.

export function AlbumPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  // what it had shown as it opened: what is new stays marked new while it is open
  const [seenBefore] = useState(() => farm.album.seen)
  useEffect(() => sawAlbum(), [])
  return <AlbumCard v={albumView(farm, seenBefore)} onClose={close} />
}
