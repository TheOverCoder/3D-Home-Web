// The design lab used end to end, as the user uses it, on a phone upright and sideways and on a computer: the sandbox
// opens with every design in its sidebar, coloured by the answer; each design opens from it, with every proposal and
// every state; ✓ / ✗, a note and a note pinned to a point are kept across a reload and turn its row green; "next" goes
// to the next design waiting; ℹ︎ shows the answers given; a screen can be asked for; the game's screen shows its
// rings; the lab's status opens. Writes lab/check.json (the lab's status shows it) and prints each step. With the lab
// served (`npm run lab`, port 5180, or the build on another port: --base):
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
  { name: 'טלפון לאורך', ctx: { viewport: { width: 390, height: 740 }, isMobile: true, hasTouch: true }, touch: true },
  { name: 'טלפון לרוחב', ctx: { viewport: { width: 800, height: 360 }, isMobile: true, hasTouch: true }, touch: true },
  { name: 'מחשב', ctx: { viewport: { width: 1280, height: 860 } }, touch: false },
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
    // what the open design draws in the screen (not the still, the rings or the phone's notch)
    const drawn = () =>
      p
        .locator('.play-screen iframe')
        .evaluate((f) => [...(f.contentDocument?.querySelectorAll('#root *') ?? [])].filter((el) => !el.closest('.lab-still, .lab-marks, .lab-chrome, .lab-touches')).length)
    const side = async () => {
      if (!(await p.locator('.side.open').count())) await press(p.locator('.d-menu, .d-list').first())
      await p.waitForTimeout(350)
    }
    const shut = async () => {
      if (await p.locator('.side.floating.open').count()) await p.keyboard.press('Escape')
      await p.waitForTimeout(300)
    }
    try {
      await p.goto(base)
      await p.waitForTimeout(2500)
      await side()
      const rows = await p.locator('.side-list .side-row').count()
      const colours = await p.locator('.side-list .side-row .dot').count()
      step(s.name, 'ארגז החול נפתח עם רשימת כל העיצובים, כל אחד עם הצבע של התשובה', rows === lab.boards.length && colours === rows, `${rows} עיצובים`)
      for (const [i, b] of lab.boards.entries()) {
        await side()
        await press(p.locator('.side-list .side-row').nth(i))
        await p.waitForTimeout(1500)
        const opened = (await drawn()) > 0
        let all = true
        for (let v = 0; v < b.variants.length; v++) {
          await press(p.locator('.d-var').nth(v))
          await p.waitForTimeout(500)
          if ((await drawn()) === 0) all = false
        }
        await press(p.locator('.d-state'))
        await p.waitForTimeout(300)
        const options = await p.locator('.option').count()
        await press(p.locator('.option').last())
        await p.waitForTimeout(900)
        const title = (await p.locator('.side-list .side-row b').nth(i).innerText()).trim()
        step(s.name, `${title}: נפתח מהרשימה, כל ההצעות וכל המצבים מוצגים`, opened && all && (await drawn()) > 0 && options === b.states.length, `${b.variants.length} הצעות · ${options} מצבים`)
      }
      // the answer: ✓ on the first design, a note and a pinned note; its row turns green; kept across a reload
      await side()
      await press(p.locator('.side-list .side-row').first())
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
      await press(p.locator('.d-info'))
      await p.waitForTimeout(300)
      const shown = await p.locator('.sheet .notes li').count()
      await p.keyboard.press('Escape')
      await side()
      const green = await p
        .locator('.side-list .side-row')
        .first()
        .evaluate((el) => el.classList.contains('a-yes'))
      await shut()
      await p.reload()
      await p.waitForTimeout(2500)
      const kept = await p.evaluate((id) => JSON.parse(localStorage.getItem('lab-reviews') ?? '{}').reviews?.[id], lab.boards[0].id)
      step(s.name, '✓, הערה והערה על נקודה: נשמרים, מופיעים ב־ℹ︎, והשורה ברשימה נצבעת בירוק', pins === 1 && shown >= 3 && green && !!kept && kept.notes.length === 2)
      // "next": to the next design waiting
      await side()
      await press(p.locator('.side-list .side-row').first())
      await p.waitForTimeout(1000)
      await press(p.locator('.d-next'))
      await p.waitForTimeout(1000)
      await side()
      const moved = await p.locator('.side-list .side-row.on').evaluate((el) => !el.classList.contains('a-yes'))
      step(s.name, '"הבא" עובר לעיצוב הבא שמחכה לתשובה', moved)
      // a screen with no design yet, asked for
      await p.locator('.side-more summary').click()
      const ask = p.locator('.side-ask .ask-btn').first()
      await press(ask)
      const asked = (await ask.getAttribute('aria-pressed')) === 'true'
      await press(ask)
      step(s.name, 'אפשר לבקש עיצוב למסך שעוד אין לו', asked)
      // the game's screen and its rings, then the lab's status
      await press(p.locator('.side-row.home'))
      await p.waitForTimeout(900)
      const rings = await frame.locator('.lab-spot').count()
      step(s.name, 'המסך של המשחק עם טבעות על מה שעוצב', rings > 0, `${rings} טבעות`)
      await side()
      await press(p.locator('.side-foot .pref').filter({ hasText: 'מצב המערכת' }))
      await p.waitForTimeout(500)
      step(s.name, 'מצב המערכת נפתח בתוך ארגז החול', (await p.locator('.sheet .status-page').count()) === 1)
      await p.keyboard.press('Escape')
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      step(s.name, 'שום דבר לא גולש מהמסך', wide <= 1)
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
