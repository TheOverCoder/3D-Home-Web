import type { Act } from '../../board'
import type { RemoteState } from './data'
import { Scenes } from './parts'
import './PremiumRemotesC.css'

// C · the look of ./PremiumRemotesC.css on every scene of the board (./parts.tsx): the bubble's open button, the
// moment it is pressed, the tag of a panel opened from afar and the shop's two remote cards. Every rule under
// .v-premium-remotes-c.

export function PremiumRemotesC({ s, act }: { s: RemoteState; act: Act<RemoteState> }) {
  return <Scenes s={s} act={act} look="c" />
}
