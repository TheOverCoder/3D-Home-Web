// The house's computer's apps, as rows: each with its name under its icon and on its window's title bar, its picture
// (a Fluent 3D picture, src/assets/art), the view it draws (./marketView.ts, ./planView.ts, ./bookView.ts) and its
// window's tabs, the first open as it opens. The desktop draws a row each, in this order: a new app is a row.

import type { ArtId } from '../../ui/art'

/** The view an app draws: the market's prices, the plan of what to grow and make, the sales book. */
export type AppView = 'market' | 'plan' | 'book'

export interface AppRow {
  id: string
  /** its name, under its icon and on its window's title bar */
  name: string
  /** its picture: a Fluent 3D emoji's name (src/assets/art/<pic>.webp, src/ui/art.ts) */
  pic: ArtId
  view: AppView
  /** its window's tabs, the first open as it opens */
  tabs: readonly { id: string; name: string }[]
}

export const APPS = [
  {
    id: 'market',
    name: 'Market',
    pic: 'chart-increasing',
    view: 'market',
    tabs: [
      { id: 'prices', name: 'Prices' },
      { id: 'index', name: 'Index' },
    ],
  },
  {
    id: 'planner',
    name: 'Planner',
    pic: 'light-bulb',
    view: 'plan',
    tabs: [
      { id: 'asked', name: 'Asked' },
      { id: 'beds', name: 'Beds' },
      { id: 'machines', name: 'Machines' },
    ],
  },
  {
    id: 'book',
    name: 'Sales book',
    pic: 'ledger',
    view: 'book',
    tabs: [
      { id: 'days', name: 'Days' },
      { id: 'goods', name: 'Goods' },
    ],
  },
] as const satisfies readonly AppRow[]

export type AppId = (typeof APPS)[number]['id']

/** An app's row by its id (undefined: none). */
export const appById = (id: string): AppRow | undefined => APPS.find((a) => a.id === id)
