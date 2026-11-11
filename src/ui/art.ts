// Full-colour art for the interface: Microsoft's Fluent Emoji 3D (MIT — see CREDITS), 128 px WebP, a few KB
// each. It pictures what is not one of the farm's own goods — the coin, the basket, the start screen's buttons,
// the shop's animals and upgrades, the headers of the panels. The farm's produce keeps its own pictures
// (src/farm/icons.ts), so the things you grow look like the things in the world.

const files = import.meta.glob('../assets/art/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export type ArtId =
  | 'basket'
  | 'building-construction'
  | 'check-mark-button'
  | 'clipboard'
  | 'chicken'
  | 'coin'
  | 'construction-worker'
  | 'convenience-store'
  | 'cow'
  | 'crescent-moon'
  | 'desktop-computer'
  | 'droplet'
  | 'ewe'
  | 'fallen-leaf'
  | 'floppy-disk'
  | 'gear'
  | 'gem-stone'
  | 'glowing-star'
  | 'hammer'
  | 'hourglass-done'
  | 'house-with-garden'
  | 'musical-notes'
  | 'office-worker'
  | 'package'
  | 'people-queue'
  | 'person-running'
  | 'running-shoe'
  | 'seedling'
  | 'sheaf-of-rice'
  | 'shopping-bags'
  | 'shopping-cart'
  | 'shortcake'
  | 'sparkles'
  | 'sun'
  | 'sunrise'
  | 'sunset'
  | 'ticket'
  | 'tractor'
  | 'trophy'
  | 'warning'
  | 'wrapped-gift'
  | 'yarn'

/** The URL of a piece of interface art. */
export const art = (id: ArtId): string => files[`../assets/art/${id}.webp`]
