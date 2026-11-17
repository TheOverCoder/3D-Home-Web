import { AnimatePresence, m } from 'motion/react'
import { Tabs } from 'radix-ui'
import { useState } from 'react'
import { Crown } from '@phosphor-icons/react/dist/csr/Crown'
import { art } from '../../../src/ui/art'
import { SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { Behind } from '../animal-tools/parts'
import { ANIMAL_ART, KIND_NAME, TOOL_KINDS, farmRows, herdRow, ladderRows, ownedLast, remoteRows, toolRow, type Row, type ShopState, type ToolKind } from './data'
import { RowView, ShopSheet, useShop } from './parts'
import './ShopAnimalsA.css'

// A · tabs: the shop is three pages under one row of tabs — Farm (today's rows, what is yours at the end), Animals
// (a group per kind: its herd row, its tool, and once the tool is yours its two ladders) and ★ (the two remotes). A
// tab with something to buy now carries a dot. It opens on Animals here (in the game: on the last tab used, or on
// the one with a dot). Every rule under .v-shop-animals-a.

type Tab = 'farm' | 'animals' | 'premium'

const canBuy = (rows: Row[], coins: number) => rows.some((r) => (r.state === 'buy' || r.state === 'card') && coins >= r.price)

export function ShopAnimalsA({ s, act }: { s: ShopState; act: Act<ShopState> }) {
  const shop = useShop(s, act)
  const [tab, setTab] = useState<Tab>('animals')
  const animals = TOOL_KINDS.flatMap((k) => [herdRow(s, k), toolRow(s, k), ...(s.tools[k] ? ladderRows(s, k) : [])])
  const farm = ownedLast(farmRows(s))
  const premium = remoteRows(s)
  const dots: Record<Tab, boolean> = { farm: canBuy(farm, s.coins), animals: canBuy(animals, s.coins), premium: canBuy(premium, s.coins) }
  return (
    <>
      <Behind coins={s.coins} level={s.level} />
      <ShopSheet coins={s.coins} onClose={act.close}>
        <Tabs.Root className="v-shop-animals-a" value={tab} onValueChange={(t) => setTab(t as Tab)}>
          <Tabs.List className="saa-tabs" aria-label="The shop's pages">
            {(
              [
                ['farm', 'Farm', <img key="i" src={art('seedling')} alt="" />],
                ['animals', 'Animals', <img key="i" src={art('chicken')} alt="" />],
                ['premium', 'Premium', <Crown key="i" weight="fill" className="saa-crown" />],
              ] as const
            ).map(([id, word, icon]) => (
              <Tabs.Trigger key={id} value={id} className="saa-tab">
                {tab === id && <m.i layoutId="saa-on" className="saa-on" transition={SPRING.pop} />}
                <span className="saa-tab-in">
                  {icon}
                  {word}
                </span>
                {dots[id] && <i className="saa-dot" aria-label="something to buy" />}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <AnimatePresence mode="popLayout" initial={false}>
            <m.div
              key={tab}
              className="saa-page"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18, transition: { duration: 0.12 } }}
              transition={SPRING.sheet}
            >
              {tab === 'farm' && (
                <div className="farm-shop">
                  {farm.map((r) => (
                    <RowView key={r.key} r={r} press={shop.press} fresh={shop.last?.key === r.key} />
                  ))}
                </div>
              )}
              {tab === 'animals' && (
                <div className="saa-kinds">
                  {TOOL_KINDS.map((k) => (
                    <Kind key={k} k={k} s={s} press={shop.press} last={shop.last?.key} />
                  ))}
                </div>
              )}
              {tab === 'premium' && (
                <div className="farm-shop">
                  {premium.map((r) => (
                    <RowView key={r.key} r={r} press={shop.press} />
                  ))}
                </div>
              )}
            </m.div>
          </AnimatePresence>
        </Tabs.Root>
      </ShopSheet>
      {shop.card}
    </>
  )
}

/** A kind's group: its name and herd as dots, then its herd row, its tool, and once the tool is yours its ladders. */
function Kind({ k, s, press, last }: { k: ToolKind; s: ShopState; press: (r: Row, el: Element | null) => void; last?: string }) {
  const herd = herdRow(s, k)
  const tool = toolRow(s, k)
  const [n, most] = herd.steps!
  return (
    <section className="saa-kind" aria-label={KIND_NAME[k]}>
      <header className="saa-kind-head">
        <img src={art(ANIMAL_ART[k])} alt="" />
        <b>{KIND_NAME[k]}</b>
        <span className="saa-herd" aria-label={`${n} of ${most}`}>
          {Array.from({ length: most }, (_, i) => (
            <i key={i} className={i < n ? 'on' : ''} />
          ))}
        </span>
      </header>
      {herd.state !== 'owned' && <RowView r={herd} press={press} fresh={last === herd.key} />}
      <RowView r={tool} press={press} fresh={last === herd.key && tool.state === 'card'} className={tool.state === 'card' ? 'saa-ready' : ''} />
      <AnimatePresence initial={false}>
        {s.tools[k] &&
          ladderRows(s, k).map((r, i) => (
            <m.div key={r.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { ...SPRING.pop, delay: 0.08 * i } }}>
              <RowView r={r} press={press} fresh={last === r.key} />
            </m.div>
          ))}
      </AnimatePresence>
    </section>
  )
}
