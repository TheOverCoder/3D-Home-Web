// The design lab used end to end, as the user uses it, on a phone upright and sideways and on a computer: the sandbox
// opens on the game's screen; each board opens from its ring or from the list; every variant and every state shows;
// ✓ / ✗, a note and a note pinned to a point are kept across a reload; a screen can be asked for; the side by side of
// each board and the map show. Writes lab/check.json (the lab's status page shows it) and prints each step. With the
// lab served (`npm run lab`, port 5180, or the build on another port: --base):
//
//   node scripts/lab-check.mjs [--base http://localhost:5180/]
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { args, labOf, launch } from './lab-tools.mjs'

const a = args()
const base = a.base ?? 'http://localhost:5180/'
const out = join(dirname(fileURLToPath(import.meta.url)), '../lab/check.json')
const SCREENS = [
  { id: 'phone', name: 'טלפון לאורך', ctx: { viewport: { width: 390, height: 740 }, isMobile: true, hasTouch: true }, touch: true },
  { id: 'sideways', name: 'טלפון לרוחב', ctx: { viewport: { width: 800, height: 360 }, isMobile: true, hasTouch: true }, touch: true },
  { id: 'computer', name: 'מחשב', ctx: { viewport: { width: 1280, height: 860 } }, touch: false },
]

const browser = await launch()
const report = { at: new Date().toISOString(), steps: [] }
const step = (screen, what, ok, detail = '') => {
  report.steps.push({ screen, what, ok, detail })
  console.log(`${ok ? '✓' : '✗'} [${screen}] ${what}${detail ? ` — ${detail}` : ''}`)
}
try {
  const lab = await labOf(browser, base)
  for (const s of SCREENS) {
    const ctx = await browser.newContext(s.ctx)
    const p = await ctx.newPage()
    const errors = []
    p.on('pageerror', (e) => errors.push(e.message))
    const press = (loc) => (s.touch ? loc.tap() : loc.click())
    const frame = p.frameLocator('.play-screen iframe')
    // what the open board draws in the screen (not the still, the rings or the phone's notch)
    const drawn = () =>
      p
        .locator('.play-screen iframe')
        .evaluate((f) => [...(f.contentDocument?.querySelectorAll('#root *') ?? [])].filter((el) => !el.closest('.lab-still, .lab-marks, .lab-chrome, .lab-touches')).length)
    try {
      await p.goto(base)
      await p.waitForTimeout(2500)
      const coach = p.getByRole('button', { name: 'הבנתי' })
      step(s.name, 'ארגז החול נפתח על המסך של המשחק, עם הסבר קצר', await coach.isVisible())
      await press(coach)
      // the rings: one for each board with a spot, each name inside the screen
      const spotted = lab.boards.length && (await frame.locator('.lab-spot').count())
      const names = await frame.locator('.lab-spot-name').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).every((r) => r.left >= 0 && r.right <= innerWidth))
      step(s.name, 'טבעות צהובות על מה שאפשר לפתוח, והשמות שלהן בתוך המסך', spotted > 0 && names, `${spotted} טבעות`)
      for (const b of lab.boards) {
        // from the list (the rings open the same boards: one of them is pressed below)
        await press(p.locator('.d-list, .d-menu').first())
        await p.waitForTimeout(300)
        const rows = p.locator('.board-row .row-main')
        const titles = await p.locator('.board-row b').allInnerTexts()
        const i = lab.boards.indexOf(b)
        await press(rows.nth(i))
        await p.waitForTimeout(1500)
        const opened = (await drawn()) > 0
        let variantsOk = true
        for (const v of b.variants) {
          const seg = p.locator('.d-var').nth(b.variants.indexOf(v))
          await press(seg)
          await p.waitForTimeout(500)
          if ((await drawn()) === 0) variantsOk = false
        }
        await press(p.locator('.d-state'))
        await p.waitForTimeout(300)
        const options = await p.locator('.option').count()
        await press(p.locator('.option').last())
        await p.waitForTimeout(900)
        const stateOk = (await drawn()) > 0
        step(s.name, `${titles[i]}: נפתח, כל ההצעות וכל המצבים מוצגים`, opened && variantsOk && stateOk && options === b.states.length, `${b.variants.length} הצעות · ${options} מצבים`)
        await press(p.locator('.d-close'))
        await p.waitForTimeout(700)
      }
      // what the user says, kept: ✓ on the first board's first proposal, a note, a pinned note, then a reload
      const first = lab.boards[0]
      await press(p.locator('.d-list'))
      await p.waitForTimeout(300)
      await press(p.locator('.board-row .row-main').first())
      await p.waitForTimeout(1200)
      await press(p.locator('.d-yes'))
      await press(p.locator('.d-note'))
      await p.locator('.sheet textarea').fill('בדיקה')
      await press(p.getByRole('button', { name: 'שמירה' }))
      await p.waitForTimeout(300)
      await press(p.locator('.d-pin'))
      const box = await p.locator('.pin-catch').boundingBox()
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await p.locator('.sheet textarea').fill('נקודה')
      await press(p.getByRole('button', { name: 'שמירה' }))
      await p.waitForTimeout(300)
      const pins = await p.locator('.pin').count()
      await p.reload()
      await p.waitForTimeout(2500)
      const kept = await p.evaluate((id) => JSON.parse(localStorage.getItem('lab-reviews') ?? '{}').reviews?.[id], first.id)
      step(s.name, '✓ / ✗, הערה והערה על נקודה נשמרים גם אחרי רענון', pins === 1 && !!kept && Object.keys(kept.verdicts).length === 1 && kept.notes.length === 2)
      // a screen asked for
      await press(p.locator('.d-list'))
      await p.waitForTimeout(300)
      const ask = p.locator('.ask-btn').first()
      await press(ask)
      const asked = (await ask.getAttribute('aria-pressed')) === 'true'
      await press(ask)
      step(s.name, 'אפשר לבקש עיצוב למסך שעוד אין לו', asked)
      await p.keyboard.press('Escape').catch(() => {})
      // the side by side of each board, and the map
      let sides = true
      for (const b of lab.boards) {
        await p.goto(`${base}#${b.id}`)
        await p.waitForTimeout(800)
        if ((await p.locator('.variant').count()) !== b.variants.length) sides = false
      }
      step(s.name, 'דף "זה לצד זה" של כל לוח מציג את כל ההצעות', sides)
      await p.goto(`${base}#map`)
      await p.waitForTimeout(800)
      step(s.name, 'מפת הממשק מוצגת', (await p.locator('.spot').count()) > 0, `${await p.locator('.spot').count()} מסכים`)
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      step(s.name, 'שום דף לא גולש הצידה', wide <= 1)
      await p.goto(`${base}#status`)
      await p.waitForTimeout(600)
      step(s.name, 'דף מצב המערכת מוצג', (await p.locator('.status-page').count()) === 1)
    } catch (e) {
      step(s.name, 'הבדיקה נעצרה', false, String(e.message).split('\n')[0].slice(0, 160))
    }
    step(s.name, 'בלי שגיאות בדף', errors.length === 0, errors.slice(0, 2).join(' | '))
    await ctx.close()
  }
} finally {
  await browser.close()
}
await writeFile(out, JSON.stringify(report, null, 1) + '\n')
const bad = report.steps.filter((x) => !x.ok).length
console.log(`${report.steps.length - bad} of ${report.steps.length} steps passed · lab/check.json`)
