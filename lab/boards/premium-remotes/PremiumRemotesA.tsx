import type { Act } from '../../board'
import type { RemoteState } from './data'
import { Scenes } from './parts'
import './PremiumRemotesA.css'

// A · the look of ./PremiumRemotesA.css on every scene of the board (./parts.tsx): the bubble's open button, the
// moment it is pressed, the tag of a panel opened from afar and the shop's two remote cards. Every rule under
// .v-premium-remotes-a.

export function PremiumRemotesA({ s, act }: { s: RemoteState; act: Act<RemoteState> }) {
  return <Scenes s={s} act={act} look="a" />
}
