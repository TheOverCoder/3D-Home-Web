import type { Act } from '../../board'
import type { RemoteState } from './data'
import { Scenes } from './parts'
import './PremiumRemotesB.css'

// B · the look of ./PremiumRemotesB.css on every scene of the board (./parts.tsx): the bubble's open button, the
// moment it is pressed, the tag of a panel opened from afar and the shop's two remote cards. Every rule under
// .v-premium-remotes-b.

export function PremiumRemotesB({ s, act }: { s: RemoteState; act: Act<RemoteState> }) {
  return <Scenes s={s} act={act} look="b" />
}
