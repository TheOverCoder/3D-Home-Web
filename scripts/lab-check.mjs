// The design lab used end to end, as the user uses it, on a phone upright and sideways and on a computer: the sandbox
// opens with every design in its sidebar, the oldest first, each with its kind's icon and those waiting numbered; each
// design opens from it, with every proposal and every state; ✓ / ✗, a note and a note pinned to a point are kept across
// a reload and turn its card green; an answered card goes to "ready to send" and comes back; "next" goes to the next
// design waiting; ℹ︎ shows the answers given; a screen can be asked for; the game's screen shows its rings; the lab's
// status opens; and a 3D board is marked as a board of the interface is, by a user whose clock is hours before its
// round's `added` (✓ / ✗ shown on its letters and buttons, its card green, kept across a reload). Writes
// lab/check.json (the lab's status shows it) and prints each step. With the lab served (`npm run lab`, port 5180, or
// the build on another port: --base):
//
//   node scripts/lab-check.mjs [--base http://localhost:5180/] [--screens upright,sideways,computer]
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { args, labOf, launch } from './lab-tools.mjs'

const a = args()
const base = a.base ?? 'http://localhost:5180/'
const out = join(dirname(fileURLToPath(import.meta.url)), '../lab/check.json')
const ALL_SCREENS = [
  { id: 'upright', name: 'טלפון לאורך', ctx: { viewport: { width: 390, height: 740 }, isMobile: true, hasTouch: true }, touch: true },
  { id: 'sideways', name: 'טלפון לרוחב', ctx: { viewport: { width: 800, height: 360 }, isMobile: true, hasTouch: true }, touch: true },
  { id: 'computer', name: 'מחשב', ctx: { viewport: { width: 1280, height: 860 } }, touch: false },
]
// --screens sideways,computer: those only (a step looked at again)
const SCREENS = a.screens ? ALL_SCREENS.filter((s) => String(a.screens).split(',').includes(s.id)) : ALL_SCREENS

// answering and sending need designs waiting: those flows run with every board as if nothing were done yet
const undone = new URL('?undone', base).href

const browser = await launch()
const report = { at: new Date().toISOString(), steps: [] }
const step = (screen, what, ok, detail = '') => {
  report.steps.push({ screen, what, ok, detail })
  console.log(`${ok ? '✓' : '✗'} [${screen}] ${what}${detail ? ` — ${detail}` : ''}`)
}

/**
 * A 3D board marked as the user marks one, at a moment before its round's `added` (round 6: the 3D boards' `added` was
 * hours ahead of the user's clock, and their ✓ / ✗ never showed): ✓ on one proposal and ✗ on another show on their
 * letters and on the buttons, the card turns green, and all of it is there again after a reload — exactly as on a board
 * of the interface.
 */
async function markThreeD(s, boards) {
  const i = boards.findIndex((b) => b.kind === '3d')
  if (i < 0) return step(s.name, 'סימון של עיצוב תלת־ממד', true, 'אין עיצוב תלת־ממד')
  const b = boards[i]
  const ctx = await browser.newContext(s.ctx)
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  // the user's clock: hours before the round's own time
  await p.clock.setFixedTime(new Date(Date.parse(`${b.added}Z`) - 5 * 3600_000))
  const press = (loc) => (s.touch ? loc.tap() : loc.click())
  const side = async () => {
    if (!(await p.locator('.side.open').count())) await press(p.locator('.d-menu, .d-list').first())
    await p.waitForTimeout(350)
  }
  const shut = async () => {
    if (await p.locator('.side.floating.open').count()) await p.keyboard.press('Escape')
    await p.waitForTimeout(300)
  }
  const card = p.locator('.side-list .card').nth(i)
  const letters = b.variants.filter((v) => v !== 'today')
  const seen = async () => {
    const yes = await p
      .locator('.d-var')
      .nth(b.variants.indexOf(letters[0]))
      .evaluate((el) => el.classList.contains('said-yes'))
    const no = letters[1]
      ? await p
          .locator('.d-var')
          .nth(b.variants.indexOf(letters[1]))
          .evaluate((el) => el.classList.contains('said-no'))
      : true
    return { yes, no }
  }
  try {
    await p.goto(undone)
    await p.waitForTimeout(2500)
    await side()
    await press(card.locator('.card-open'))
    await p.waitForTimeout(1500)
    await press(p.locator('.d-var').nth(b.variants.indexOf(letters[0])))
    await p.waitForTimeout(300)
    await press(p.locator('.d-yes'))
    await p.waitForTimeout(200)
    const on = (await p.locator('.d-yes').getAttribute('aria-pressed')) === 'true'
    if (letters[1]) {
      await press(p.locator('.d-var').nth(b.variants.indexOf(letters[1])))
      await p.waitForTimeout(300)
      await press(p.locator('.d-no'))
      await p.waitForTimeout(200)
    }
    const now = await seen()
    await side()
    const green = (await card.evaluate((el) => el.classList.contains('a-yes'))) && (await card.locator('.card-said').innerText()).includes('אושר')
    await shut()
    await p.reload()
    await p.waitForTimeout(2500)
    await side()
    await press(card.locator('.card-open'))
    await p.waitForTimeout(1200)
    const again = await seen()
    step(
      s.name,
      `${b.title} (תלת־ממד): ✓ ו־✗ מופיעים על האותיות ועל הכפתורים, הכרטיס ירוק, וגם אחרי טעינה מחדש – כמו בעיצוב ממשק`,
      on && now.yes && now.no && green && again.yes && again.no,
      `שעון המשתמש לפני ${b.added}`,
    )
  } catch (e) {
    step(s.name, `${b.title} (תלת־ממד): הסימון נעצר`, false, String(e.message).split('\n')[0].slice(0, 160))
  }
  if (errors.length) step(s.name, `${b.title} (תלת־ממד): בלי שגיאות בדף`, false, errors.slice(0, 2).join(' | '))
  await ctx.close()
}
/**
 * What was done with what the user sent (a board's `done`, for the round it shows): in neither the designs nor "ready to
 * send", but in "done" with its line, the newest first, and it still opens from there.
 */
async function doneList(s, boards) {
  const done = boards.filter((b) => b.done)
  const ctx = await browser.newContext(s.ctx)
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  const press = (loc) => (s.touch ? loc.tap() : loc.click())
  const cards = p.locator('.side-list .card')
  try {
    await p.goto(base)
    await p.waitForTimeout(2500)
    if (!(await p.locator('.side.open').count())) await press(p.locator('.d-menu, .d-list').first())
    await p.waitForTimeout(350)
    const designs = await cards.count()
    await press(p.locator('.side-tabs [role=tab]').nth(2))
    await p.waitForTimeout(300)
    const titles = (await p.locator('.side-list .card-title').allInnerTexts()).map((x) => x.trim())
    const lines = await p.locator('.side-list .card-done').count()
    const order =
      titles.join('|') ===
      [...done]
        .reverse()
        .map((b) => b.title)
        .join('|')
    let opens = true
    if (done.length) {
      await press(cards.first().locator('.card-open'))
      await p.waitForTimeout(1500)
      const drawn = await p
        .locator('.play-screen iframe')
        .evaluate((f) => [...(f.contentDocument?.querySelectorAll('#root *') ?? [])].filter((el) => !el.closest('.lab-still, .lab-marks, .lab-chrome, .lab-touches')).length)
      opens = drawn > 0
    }
    step(
      s.name,
      'מה שבוצע יוצא מהעיצובים וממוכן לשליחה, ונמצא ב"בוצע" עם השורה שלו, החדש ראשון, ונפתח משם',
      designs === boards.length - done.length && lines === done.length && order && opens,
      `${done.length} בוצעו · ${designs} בעיצובים`,
    )
  } catch (e) {
    step(s.name, 'רשימת "בוצע": הבדיקה נעצרה', false, String(e.message).split('\n')[0].slice(0, 160))
  }
  if (errors.length) step(s.name, 'רשימת "בוצע": בלי שגיאות בדף', false, errors.slice(0, 2).join(' | '))
  await ctx.close()
}
try {
  const lab = await labOf(browser, base)
  // the sidebar's order: the oldest first
  const boards = [...lab.boards].sort((x, y) => x.added.localeCompare(y.added))
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
    const cards = p.locator('.side-list .card')
    const tab = (n) => press(p.locator('.side-tabs [role=tab]').nth(n))
    try {
      await p.goto(undone)
      await p.waitForTimeout(2500)
      await side()
      const n = await cards.count()
      const kinds = await p.locator('.side-list .card .card-kind').count()
      const numbers = (await p.locator('.side-list .card-no').allInnerTexts()).map((x) => x.trim()).join(',')
      const titles = (await p.locator('.side-list .card-title').allInnerTexts()).map((x) => x.trim())
      step(
        s.name,
        'ארגז החול נפתח עם כל העיצובים, מהישן לחדש, כל אחד עם אייקון של הסוג שלו, והממתינים ממוספרים',
        n === boards.length && kinds === n && numbers === boards.map((_, i) => i + 1).join(',') && titles.join('|') === boards.map((b) => b.title).join('|'),
        `${n} עיצובים`,
      )
      for (const [i, b] of boards.entries()) {
        await side()
        await press(cards.nth(i).locator('.card-open'))
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
        step(s.name, `${b.title}: נפתח מהרשימה, כל ההצעות וכל המצבים מוצגים`, opened && all && (await drawn()) > 0 && options === b.states.length, `${b.variants.length} הצעות · ${options} מצבים`)
      }
      // the answer: ✓ on the oldest design, a note and a pinned note; its card turns green, loses its number and gets a
      // send button; kept across a reload
      await side()
      await press(cards.first().locator('.card-open'))
      await p.waitForTimeout(1200)
      await press(p.locator('.d-yes'))
      await press(p.locator('.d-note'))
      await p.locator('.sheet textarea').fill('בדיקה')
      await press(p.getByRole('button', { name: 'שמירה' }))
      await p.waitForTimeout(300)
      // a note on a point: 📍 inside the note, a touch on the screen, the words kept
      await press(p.locator('.d-note'))
      await p.locator('.sheet textarea').fill('נקודה')
      await press(p.locator('.note-point'))
      const box = await p.locator('.pin-catch').boundingBox()
      await p.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6)
      await p.waitForTimeout(300)
      const pointKept = (await p.locator('.sheet textarea').inputValue()) === 'נקודה' && (await p.locator('.note-point.on').count()) === 1
      await press(p.getByRole('button', { name: 'שמירה' }))
      await p.waitForTimeout(300)
      const pins = await p.locator('.pin').count()
      await press(p.locator('.d-info'))
      await p.waitForTimeout(300)
      const shown = await p.locator('.sheet .notes li').count()
      await p.keyboard.press('Escape')
      await side()
      const first = cards.first()
      const green = (await first.evaluate((el) => el.classList.contains('a-yes'))) && (await first.locator('.card-said').innerText()).includes('אושר')
      const unnumbered = (await first.locator('.card-no').count()) === 0 && (await first.locator('.card-act.send').count()) === 1
      await shut()
      await p.reload()
      await p.waitForTimeout(2500)
      const kept = await p.evaluate((id) => JSON.parse(localStorage.getItem('lab-reviews') ?? '{}').reviews?.[id], boards[0].id)
      step(
        s.name,
        '✓, הערה והערה על נקודה (מתוך כפתור ההערה): נשמרים, מופיעים ב־ℹ︎, והכרטיס נצבע בירוק עם "אושר" וכפתור שליחה',
        pointKept && pins === 1 && shown >= 3 && green && unnumbered && !!kept && kept.notes.length === 2,
      )
      // to "ready to send" and back
      await side()
      await press(cards.first().locator('.card-act.send'))
      await p.waitForTimeout(300)
      const left = await cards.count()
      await tab(1)
      await p.waitForTimeout(300)
      const inbox = (await cards.count()) === 1 && (await cards.first().locator('.card-title').innerText()).trim() === boards[0].title
      const sentKept = await p.evaluate((id) => JSON.parse(localStorage.getItem('lab-reviews') ?? '{}').outbox?.[id]?.sent === true, boards[0].id)
      await press(cards.first().locator('.card-act.back'))
      await p.waitForTimeout(300)
      const emptied = (await cards.count()) === 0
      await tab(0)
      await p.waitForTimeout(300)
      const back = (await cards.count()) === boards.length
      step(s.name, 'כרטיס שנענה עובר ל"מוכן לשליחה" בכפתור השליחה, וחוזר בכפתור החזרה', left === boards.length - 1 && inbox && sentKept && emptied && back)
      // in the bar: an answered design is sent and the next one waiting opens, in one press
      const outboxCount = async () =>
        Number(
          (await p
            .locator('.side-tabs [role=tab]')
            .nth(1)
            .locator('.count')
            .innerText()
            .catch(() => '0')) || 0,
        )
      await press(cards.first().locator('.card-open'))
      await p.waitForTimeout(1000)
      await press(p.locator('.d-send'))
      await p.waitForTimeout(1000)
      await side()
      const sentNext = (await p.locator('.side-list .card.on').evaluate((el) => el.classList.contains('a-none'))) && (await outboxCount()) === 1
      step(s.name, '"שלח" בסרגל: העיצוב שנענה עובר למוכן לשליחה, והבא שמחכה נפתח', sentNext)
      // "next" on a design waiting: to another one waiting
      const before = (await p.locator('.side-list .card.on .card-title').innerText()).trim()
      await shut()
      await press(p.locator('.d-next'))
      await p.waitForTimeout(1000)
      await side()
      const on = p.locator('.side-list .card.on')
      const moved = (await on.evaluate((el) => el.classList.contains('a-none'))) && (await on.locator('.card-title').innerText()).trim() !== before
      step(s.name, '"הבא" עובר לעיצוב הבא שמחכה לתשובה', moved)
      // two answered: one button sends both
      await shut()
      await press(p.locator('.d-yes'))
      await side()
      await press(p.locator('.side-list .card.a-none .card-open').first())
      await p.waitForTimeout(1000)
      await press(p.locator('.d-yes'))
      await side()
      const all = p.locator('.side-send-all')
      const offered = (await all.count()) === 1 && (await all.innerText()).includes('2')
      await press(all)
      await p.waitForTimeout(300)
      step(s.name, 'כפתור אחד שולח את כל מה שענית', offered && (await outboxCount()) === 3 && (await p.locator('.side-list .card.a-yes').count()) === 0)
      // a screen with no design yet, asked for
      await p.locator('.side-more summary').click()
      const ask = p.locator('.side-ask .ask-btn').first()
      await press(ask)
      const asked = (await ask.getAttribute('aria-pressed')) === 'true'
      await press(ask)
      step(s.name, 'אפשר לבקש עיצוב למסך שעוד אין לו', asked)
      // the game's screen and its rings, then the lab's status
      await press(p.locator('.card.home'))
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
    await markThreeD(s, boards)
    await doneList(s, boards)
  }
} finally {
  await browser.close()
}
await writeFile(out, JSON.stringify(report, null, 1) + '\n')
const bad = report.steps.filter((x) => !x.ok).length
console.log(`${report.steps.length - bad} of ${report.steps.length} steps passed · lab/check.json`)
