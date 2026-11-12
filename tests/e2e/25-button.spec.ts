/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, type Game } from './helpers'

// The action button's contract (src/lib/interaction.ts; CLAUDE.md, "Farm actions"), held for everything that can be
// pressed (`__home.interactables()`), on farms of every kind: today's, one with plenty of everything, one with
// nothing, and farms put together at random. Whatever is offered as an action — enabled, and not a status
// (`verb: 'wait'`) — does something when pressed and never spends coins without its price on the prompt. A press that
// does a job (pick, water, plant, sell, make) and opens something instead opens something to press: a card its
// button, a panel a button besides Close and Cancel (a sale's panel a Sell). A shop or a board (`shop`, `watch`) may
// open with nothing you can afford or send yet: you look at what is there. Each is pressed where it stands (the
// player put at it), the same way the button presses it (`run`), and what it opened is closed again.

/** Panels that only show what there is, and may offer nothing to press. */
const SHOWS = ['store', 'away', 'goals']
/** Presses that open a shop or a board to look at. */
const LOOKS = ['shop', 'watch']

/** In the page: every thing offered as an action pressed in turn; what broke the contract, in words. */
const sweep = (page: Page, farmName: string) =>
  page.evaluate(
    async ({ farmName, shows, looks }) => {
      const h = (window as any).__home
      const out: string[] = []
      const home = () => {
        const s = h.useHome.getState()
        return JSON.stringify({
          doors: s.doors,
          lamps: s.lamps,
          items: s.items,
          carrying: s.carrying,
          panel: s.panel,
          confirm: !!s.confirm,
          screen: s.screen,
          decorating: s.decorating,
          editing: s.editing,
        })
      }
      const iconOf = (d: any) => (typeof d.icon === 'function' ? d.icon() : d.icon)
      const labelOf = (d: any) => (typeof d.label === 'function' ? d.label() : d.label)
      const close = () => {
        const s = h.useHome.getState()
        if (s.confirm) s.setConfirm(null)
        if (s.panel) s.closePanel()
        if (s.screen) s.closeScreen()
        if (s.decorating) s.setDecorating?.(false)
        if (s.editing) s.setEditing(false)
      }
      const pressable = (root: Element | null, sell: boolean) =>
        !!root &&
        Array.from(root.querySelectorAll('button')).some(
          (b) => !(b as HTMLButtonElement).disabled && !b.classList.contains('close') && !/^(cancel|close|back)$/i.test(b.textContent?.trim() ?? '') && (!sell || /sell/i.test(b.textContent ?? '')),
        )
      const p = h.playerState.position
      const at = { x: p.x, y: p.y, z: p.z }
      let pressed = 0
      for (const def of h.interactables()) {
        close()
        if (def.enabled && !def.enabled()) continue
        const icon = iconOf(def)
        if (icon?.verb === 'wait') continue
        // pressed from where it stands (what one press takes along — the beds round it — is measured from there)
        p.x = def.position.x
        p.z = def.position.z
        const what = `${farmName}: ${def.id} ("${labelOf(def)}", ${icon?.verb ?? 'no verb'})`
        const before = { farm: JSON.stringify(h.farm.state), home: home(), coins: h.farm.state.coins }
        try {
          def.run()
        } catch (e) {
          out.push(`${what} throws ${String(e)}`)
          continue
        }
        pressed++
        const after = { farm: JSON.stringify(h.farm.state), home: home(), coins: h.farm.state.coins }
        if (after.farm === before.farm && after.home === before.home) out.push(`${what} is offered and does nothing`)
        const spent = before.coins - after.coins
        if (spent > 0 && !(icon?.coins >= spent)) out.push(`${what} spends ${spent} coins without its price on the prompt`)
        // what it opened, once drawn (a panel's code may still be on its way the first time)
        const opened = () => {
          const st = h.useHome.getState()
          return (!st.confirm || document.querySelector('.confirm-card')) && (!st.panel || document.querySelector('.farm-panel'))
        }
        for (let i = 0; i < 150 && !opened(); i++) await new Promise((r) => setTimeout(r, 20))
        await new Promise((r) => setTimeout(r, 40))
        const s = h.useHome.getState()
        if (s.confirm && !pressable(document.querySelector('.confirm-card'), false)) out.push(`${what} opens a card with nothing to press`)
        if (s.panel && !shows.includes(s.panel.kind) && !looks.includes(icon?.verb)) {
          const sale = icon?.verb === 'sell' && after.coins <= before.coins
          if (!pressable(document.querySelector('.farm-panel'), sale)) out.push(`${what} opens the ${s.panel.kind} panel with nothing to press${sale ? ' (no Sell)' : ''}`)
        }
      }
      close()
      p.x = at.x
      p.z = at.z
      return { problems: out, pressed }
    },
    { farmName, shows: SHOWS, looks: LOOKS },
  )

/** A farm with plenty of everything: coins, every good, ripe beds, full animals, finished machines, the shop yours
 *  and stocked with coins in its till, the contractor in with his pieces, a line at the gate. */
async function plenty(page: Page) {
  await page.evaluate(() => {
    const h = (window as any).__home
    const f = h.farm
    f.setHour(12)
    f.freezeDay(true)
    f.state.coins = 100_000
    f.state.storage.silo = 30
    f.state.storage.barn = 30
    for (const id of Object.keys(f.state.inv)) f.state.inv[id] = 25
    f.state.beds.forEach((b: any, i: number) => {
      if (b.built && !b.crop) f.plant(i, 'lettuce')
    })
    f.tick(3600)
    f.marketFill('lettuce', { quiet: true })
    f.state.market.till.coins = 40
    for (let k = 0; k < 4; k++) f.spawnVisitor({ queued: true })
    f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
  })
}

/** A farm with nothing: no coins, no goods, and the contractor away for the night. */
async function nothing(page: Page) {
  await page.evaluate(() => {
    const f = (window as any).__home.farm
    f.reset()
    f.setHour(23)
    f.freezeDay(true)
    f.state.coins = 0
    for (const id of Object.keys(f.state.inv)) f.state.inv[id] = 0
    f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
  })
}

/** A farm put together at random from plenty: some goods gone, some coins, any hour (the dice from `seed`). */
async function random(page: Page, seed: number) {
  await plenty(page)
  await page.evaluate((seed) => {
    let s = seed
    const r = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
    const f = (window as any).__home.farm
    for (const id of Object.keys(f.state.inv)) if (r() < 0.5) f.state.inv[id] = 0
    f.state.coins = [0, 7, 60, 5000][Math.floor(r() * 4)]
    f.setHour(Math.floor(r() * 24))
    f.useFarm.setState((st: any) => ({ rev: st.rev + 1 }))
  }, seed)
}

async function check(game: Game, name: string) {
  const r = await sweep(game.page, name)
  console.log(`${name}: ${r.pressed} things pressed`)
  return r
}

test.describe('the action button', () => {
  test('everything offered does something, spends nothing unpriced, and opens something to press — on every kind of farm', async ({ game }) => {
    test.setTimeout(600_000)
    await game.ready()
    const problems: string[] = []
    let pressed = 0
    const add = (r: { problems: string[]; pressed: number }) => {
      problems.push(...r.problems)
      pressed += r.pressed
    }
    add(await check(game, "today's farm"))
    await plenty(game.page)
    add(await check(game, 'plenty'))
    await nothing(game.page)
    add(await check(game, 'nothing'))
    for (const seed of [1, 2, 3]) {
      await random(game.page, seed)
      add(await check(game, `random ${seed}`))
    }
    // enough was pressed to mean something
    expect(pressed).toBeGreaterThan(40)
    expect(problems, problems.join('\n')).toEqual([])
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test("afterwards: today's farm again", async ({ game }) => {
    await game.ready()
    await game.page.evaluate(() => (window as any).__home.farm.reset())
    await game.ready()
  })
})
