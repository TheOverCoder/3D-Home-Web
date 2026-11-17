import type { ArtId } from '../ui/art'
import { TOOLS, type ToolKind } from './data'
import { SKINS, SKIN_STYLES, skinBuyProblem, type SkinStyle, type Skins } from './skins'

// What a tool's skins shop shows (./SkinShop.tsx draws it), from the skins' record, whether the tool is yours and the
// coins alone: pure, so a test or the design lab makes its states from numbers, as the game does from the farm's.

export interface SkinCard {
  style: SkinStyle
  name: string
  price: number
  /** worn now; the farm's, to put on; or for sale (its price opens the card that asks first) */
  state: 'worn' | 'owned' | 'sale'
  /** for sale and the coins are there */
  can: boolean
}

export interface SkinsView {
  kind: ToolKind
  /** the tool's name ("Coop") and its picture */
  tool: string
  art: ArtId
  /** the tool is the farm's (else nothing here can be bought or worn) */
  has: boolean
  coins: number
  /** how many of its skins the farm owns, of how many */
  owned: number
  of: number
  skins: SkinCard[]
}

export function skinsView(kind: ToolKind, skins: Skins, has: boolean, coins: number): SkinsView {
  const t = skins[kind]
  return {
    kind,
    tool: TOOLS[kind].name,
    art: TOOLS[kind].art,
    has,
    coins,
    owned: has ? t.owned.length : 0,
    of: SKIN_STYLES.length,
    skins: SKIN_STYLES.map((style) => {
      const def = SKINS[kind][style]
      const mine = has && t.owned.includes(style)
      return {
        style,
        name: def.name,
        price: def.price,
        state: mine ? (t.worn === style ? 'worn' : 'owned') : 'sale',
        can: skinBuyProblem(skins, kind, style, has, coins) === null,
      }
    }),
  }
}
