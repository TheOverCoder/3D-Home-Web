import type { ToolStyle } from '../models/tools'
import { TOOL_KINDS, type ToolKind } from './data'
import { toolOf, type Steps } from './tools'

// The animals' tools' skins (the user's request on the tools' board, lab/feedback/tools-3d.json: all three of the 3D
// designer's families exist, and each player picks the one each tool wears): the coop, the milk bucket and the shears
// each in style a, b and c (src/models/tools.ts), one row each. Style a comes with the tool; b and c are bought in the
// tool's own skins shop (src/farm/SkinShop.tsx). What a farm owns and what each tool wears is `farm.skins` in the save
// (`sanitizeSkins`: a farm from before them, or a tool not yours, owns a and wears it). A skin changes only how the
// tool looks: never what it holds, takes or gives.

export type SkinStyle = ToolStyle
export const SKIN_STYLES: readonly SkinStyle[] = ['a', 'b', 'c']
/** The skin every tool comes with. */
export const FREE_SKIN: SkinStyle = 'a'

export interface SkinDef {
  /** a few words, on its card in the shop */
  name: string
  /** what it costs in the shop (the free one: 0) */
  price: number
}

/** Each tool's three skins. The prices are set against the pace a new farm is held to (`npm run sim`, PACE in
 *  src/sim/targets.ts): the good player, who buys whatever is cheapest the moment the coins run to it, buys the b skins
 *  at 90–98 minutes and the c skins at 133–149 (seeds 1–3), long after level 15 (58–65 minutes), which comes at the
 *  same second as without them (plans/animal-tools.md, "The skins"). */
export const SKINS: Record<ToolKind, Record<SkinStyle, SkinDef>> = {
  hens: {
    a: { name: 'Red hen house', price: 0 },
    b: { name: 'Tin nest bank', price: 300 },
    c: { name: 'Wicker nests', price: 450 },
  },
  cows: {
    a: { name: 'Milk stand', price: 0 },
    b: { name: 'Tin pail and churn', price: 300 },
    c: { name: 'Wooden pail', price: 450 },
  },
  sheep: {
    a: { name: 'Shearing rack', price: 0 },
    b: { name: 'Tin tub of wool', price: 300 },
    c: { name: 'Wicker basket', price: 450 },
  },
}

/** A tool's skins: the ones the farm owns (in the order of SKIN_STYLES, the free one always), and the one it wears. */
export interface ToolSkins {
  owned: SkinStyle[]
  worn: SkinStyle
}
export type Skins = Record<ToolKind, ToolSkins>

/** A new farm's: every tool with its own skin only, worn. */
export const freshSkins = (): Skins => Object.fromEntries(TOOL_KINDS.map((k) => [k, { owned: [FREE_SKIN], worn: FREE_SKIN }])) as Skins

export const isSkinStyle = (v: unknown): v is SkinStyle => (SKIN_STYLES as readonly unknown[]).includes(v)

const field = (v: unknown, k: string) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined)

/** The skins as saved, made safe on a farm with these ladders: each owned skin once, in order, the free one always; the
 *  one worn an owned one (else the free one). A tool that is not the farm's owns its own skin only, and wears it. */
export function sanitizeSkins(raw: unknown, ladders: Steps): Skins {
  const out = freshSkins()
  for (const kind of TOOL_KINDS) {
    if (!toolOf(kind, ladders)) continue
    const saved = field(raw, kind)
    const list = field(saved, 'owned')
    const owned = SKIN_STYLES.filter((s) => s === FREE_SKIN || (Array.isArray(list) && list.includes(s)))
    const worn = field(saved, 'worn')
    out[kind] = { owned, worn: isSkinStyle(worn) && owned.includes(worn) ? worn : FREE_SKIN }
  }
  return out
}

/** What a skin costs. */
export const skinPrice = (kind: ToolKind, style: SkinStyle) => SKINS[kind][style].price

/** Why a skin cannot be bought now, or null when it can: the tool is not yours, the skin is, or the coins are short. */
export function skinBuyProblem(skins: Skins, kind: ToolKind, style: SkinStyle, hasTool: boolean, coins: number): 'no tool' | 'owned' | 'coins' | null {
  if (!hasTool) return 'no tool'
  if (skins[kind].owned.includes(style)) return 'owned'
  if (!(coins >= skinPrice(kind, style))) return 'coins'
  return null
}

/** The skins with one more owned (in its place in the order) and worn at once. */
export function withSkin(skins: Skins, kind: ToolKind, style: SkinStyle): Skins {
  const owned = SKIN_STYLES.filter((s) => s === style || skins[kind].owned.includes(s))
  return { ...skins, [kind]: { owned, worn: style } }
}

/** The skins with a tool wearing another it owns (the same skins when it does not own it, or wears it already). */
export function wearing(skins: Skins, kind: ToolKind, style: SkinStyle): Skins {
  const t = skins[kind]
  if (!t.owned.includes(style) || t.worn === style) return skins
  return { ...skins, [kind]: { ...t, worn: style } }
}
