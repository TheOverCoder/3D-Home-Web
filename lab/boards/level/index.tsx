import { boxAt, boxXp, rollBox, settle, type Came, type Gifts, type Opened } from '../../../src/farm/gifts'
import { LevelCard } from '../../../src/farm/LevelCard'
import { levelView, type Ready } from '../../../src/farm/levelView'
import { xpAt } from '../../../src/farm/xp'
import { flyCoins } from '../../../src/fx/coins'
import { coinsToFly } from '../../../src/fx/fx'
import { art } from '../../../src/ui/art'
import type { Act, Board } from '../../board'
import { beds, goods } from './progress'
import './board.css'

// The level's card (src/farm/LevelCard.tsx): the level chip opens it. In the game since the user chose F; its states
// from the game's own pure code (levelView, and the gifts' record of src/farm/gifts.ts). What a box gave and what a
// level brought are examples of what the farm's dice give (rollBox, rollArrival); a box opened here rolls on dice of
// the lab's own.

/** A state of the card: the farm's XP, the levels paid, the gifts' record, and what LevelPanel adds. */
export interface LevelState {
  points: number
  paid: number
  gifts: Gifts
  /** XP gained since the card was last open */
  gain: number
  /** what waits on the farm now */
  ready?: Ready
}

/** The lab's dice for a box opened here (the same box, the same prize, every time). */
const dice = (seed: number) => () => {
  const x = Math.sin(seed++ * 12.9898) * 43758.5453
  return x - Math.floor(x)
}
/** The goods the sample farm has made (what a box may give a few of). */
const MADE = ['lettuce', 'egg', 'wheat', 'flour'] as const

/** What the game's LevelPanel does on a claim: the coins fly from the Claim button to the coin chip (src/fx/coins.ts),
 *  and the card is told the coins are paid. */
const claimed = (s: LevelState, act: Act<LevelState>) => (button: HTMLElement) => {
  const r = button.getBoundingClientRect()
  const v = levelView(s.points, s.paid)
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) flyCoins(r.left + r.width / 2, r.top + r.height / 2, coinsToFly(v.unpaid))
  act.set({ ...s, paid: v.level })
}

/** What the game's openGifts does (src/farm/state.ts), on the lab's dice: the boxes reached and not open, each rolled
 *  and marked open; what this level's gave stays on its bar. */
const opened = (s: LevelState, act: Act<LevelState>) => (boxes: number[]) => {
  const v = levelView(s.points, s.paid, s.gifts)
  const list = boxes.filter((k) => v.waiting.includes(k))
  const got: Opened[] = list.map((box) => ({ box, prize: rollBox(box, [...MADE], dice(box + 1)) }))
  const { open, also } = settle(s.gifts.open, [...s.gifts.also, ...list])
  const gave = [...s.gifts.gave, ...got.filter((o) => v.boxes.some((b) => b.box === o.box))].sort((a, b) => a.box - b.box)
  act.set({ ...s, gifts: { ...s.gifts, open, also, gave } })
  return got
}

/** The coin of the chip at the top of the still, where the game's coins land (the still is a picture: an unseen stand-in
 *  where the chip's coin is drawn, found by the game's flight as the chip itself would be). */
const ChipCoin = () => (
  <span className="farm-chip-item coins lab-chip-coin" aria-hidden="true">
    <img src={art('coin')} alt="" />
  </span>
)

/** A gifts' record: every box below `open` opened, `also` out of turn, what this level's gave, the level reached. */
const record = (open: number, also: number[] = [], gave: Opened[] = [], came: Came[] = [], seen = 1): Gifts => ({ open, also, gave, came, seen })

const level = (n: number, part: number) => xpAt(n) + Math.round((xpAt(n + 1) - xpAt(n)) * part)

export const levelBoard: Board<LevelState> = {
  id: 'level',
  title: 'חלון הרמה',
  kind: 'ui',
  added: '2026-11-16T04:30',
  ask:
    'הפופאפ של הרמה לא נראה מקצועי לעיצוב · סיבוב 2: "שירגיש משחק ממכר – שיהיה ברור כמה הסרגל מלא, סימונים חכמים על הסרגל, והרגשה של התקדמות שנותנת היי קטן" · ' +
    'סיבוב 3: "לשלב בצורה חכמה את C ו־B: אהבתי את התאורה מאחורי החפצים, והסרגל צריך להיות כמו במשחקים פופולריים, עם העקרונות של משחק מתגמל; לשלב את כל האנימציות בצורה יעילה." · ' +
    'F נבחר: "מעולה אפשר ליישם"',
  status: 'live',
  chosen: 'f',
  spot: 'level',
  screen: 'level',
  round:
    'F במשחק, עם הלוגיקה שלו: ארבע קופסאות בכל רמה (ב־25%, 50%, 75% ו־100%) – נעולה, מוכנה (נגיעה פותחת), פתוחה עם מה שנתנה; קופסה שלא נפתחה מחכה, ו"Open N gifts" פותח את כולן, גם מרמות קודמות. ' +
    'מה שבקופסה נקבע בקובייה של החווה ברגע הפתיחה: מטבעות לפי הרמה, חומר בנייה, או כמה מסחורה שהחווה מייצרת; אף קופסה לא ניתנת פעמיים, ואין עליה XP. ' +
    'המתנה של עליית רמה נכנסת לבד: כמה חומרי בנייה, שקופצים מהמספר בזמן החגיגה ועפים למחסן; בכרטיס – "Level N reached!" עם מה שנכנס. ' +
    'המטבעות של הרמה והבגד של כל רמה חמישית – כמו קודם: המטבעות נאספים ב־Claim, עכשיו בפס "Level N reached!" למעלה. ' +
    'כמה קופסאות יחד: אותו פרס מתאחד (כל המטבעות בתמונה אחת, כל סחורה בתמונה אחת). ' +
    'מיקרו־אנימציות בכל הכפתורים, הכרטיסים, השבבים, התגים, המתג וכפתור הפעולה; ורטט קצר בכל פעולה שעושה משהו – טיק לאיסוף, כפול למכירה, חזק יותר לקנייה, גלגול למתנה והחזק ביותר לרמה (בטלפונים שיכולים, וכבה עם "Vibration" בהגדרות).',
  still: 'yard',
  research: [
    {
      pattern: 'דרך עם אבני דרך ופרס בכל אחת, שרואים בה גם מה עבר (זהב) וגם מה הבא – הפרס הבא תמיד בעין. מכאן הדרך של הפרק עם החותמות והבגד בסופה.',
      from: 'Clash Royale / Brawl Stars – Trophy Road',
      url: 'https://supercell.com/en/games/brawlstars/blog/news/rip-masteries',
    },
    {
      pattern: 'סרגל של משחק: עבה, מסילה כהה עם שוליים בהירים, מילוי מבריק, המספרים בתוך הסרגל עצמו, וראש זוהר שזז. נקרא במבט אחד גם על מסך קטן.',
      from: 'Clash of Clans / Hay Day – פסי ניסיון ובנייה',
      url: 'https://supercell.com/en/games/hayday/',
    },
    {
      pattern: 'הפרס עומד על במה עם קרני אור מאחוריו, ונוחת בקפיצה – רגע של "וואו" לפני שלוקחים אותו.',
      from: 'Candy Crush / Royal Match – חלונות פרס',
      url: 'https://www.dreamgames.com/royal-match/',
    },
    {
      pattern: 'מטרות קרובות בדרך למטרה רחוקה, ומה שכבר נעשה נספר; בסוף הדרך המאמץ גדל – לכן רבעים שנדלקים, והסרגל מתחמם ברבע האחרון.',
      from: 'Bandura & Schunk 1981; Kivetz, Urminsky & Zheng 2006',
      url: 'https://business.columbia.edu/faculty/research/goal-gradient-hypothesis-resurrected-purchase-acceleration-illusionary-goal',
    },
  ],
  states: [
    {
      id: 'gift',
      name: 'ברמה הבאה בגד; קופסה אחת נפתחה, אחת מחכה, ועוד אחת מרמה 3',
      data: { points: level(4, 0.6), paid: 4, gifts: record(boxAt(3, 3), [boxAt(4, 0)], [{ box: boxAt(4, 0), prize: { coins: 5 } }], [], 4), gain: 9, ready: beds('lettuce', 6) },
    },
    {
      id: 'almost',
      name: 'כמעט: חסרים 10 XP, שלוש הקופסאות נפתחו, ומה שמוכן בחווה מספיק',
      data: {
        points: xpAt(10) - 10,
        paid: 9,
        gifts: record(
          boxAt(9, 3),
          [],
          [
            { box: boxAt(9, 0), prize: { coins: 10 } },
            { box: boxAt(9, 1), prize: { item: 'plank', n: 1 } },
            { box: boxAt(9, 2), prize: { item: 'egg', n: 4 } },
          ],
          [],
          9,
        ),
        gain: 14,
        ready: beds('carrot', 8),
      },
    },
    {
      id: 'fresh',
      name: 'רמה חדשה (7): המתנה שלה נכנסה לבד והמטבעות מחכים ל־Claim; הקופסה האחרונה של רמה 6 מחכה',
      data: { points: xpAt(7) + 6, paid: 6, gifts: record(boxAt(6, 3), [], [], [{ level: 7, prize: { item: 'brick', n: 2 } }], 6), gain: 6, ready: goods('egg', 4) },
    },
    {
      id: 'later',
      name: 'שליש מהרמה: קופסה אחת מוכנה ועוד שתיים מרמה 5',
      data: { points: level(6, 0.34), paid: 6, gifts: record(boxAt(5, 2), [], [], [], 6), gain: 5 },
    },
    {
      id: 'many',
      name: 'חזרת אחרי זמן: הרבה קופסאות מחכות',
      data: { points: boxXp(boxAt(12, 2)) + 4, paid: 12, gifts: record(boxAt(10, 3), [], [], [], 12), gain: 20, ready: beds('tomato', 4) },
    },
    { id: 'top', name: 'הרמה העליונה', data: { points: xpAt(500) + 1, paid: 500, gifts: record(boxAt(500, 0), [], [], [], 500), gain: 0 } },
  ],
  variants: [
    {
      id: 'today',
      name: 'במשחק (F)',
      note:
        'הסרגל של הרמה הוא הגיבור: ארבעה רבעים, ועל סוף כל אחד קופסה – נעולה (עם כמה XP חסר לבאה), מוכנה (זוהרת וקופצת: נגיעה פותחת), או פתוחה (מה שנתנה עם ✓). ' +
        'מעליו האחוז הגדול וכמה עוד; בקצה – הכוכב של הרמה הבאה. מתחת: מה הרמה הבאה נותנת (מטבעות, בגד או מתי הבגד הבא, ומתנה שנכנסת לבד), וכפתור צהוב אחד כשמחכות קופסאות – "Open 3 gifts", כולל מרמות קודמות. ' +
        'רמה חדשה: "Level 7 reached!" למעלה, עם המתנה שנכנסה והמטבעות ל־Claim.',
      motion:
        'הגיליון עולה, הסרגל מתמלא ממה שהיה למה שיש (מה שהרווחת בוהק, "+9 new" קופץ), והקופסאות המוכנות קופצות ומתנדנדות מדי פעם. ' +
        'פתיחה: הקופסה עפה לאמצע הכרטיס וגדלה, רועדת, ומתפוצצת עם קרני אור וקונפטי – הפרס עולה גדול עם השם והמספר; Collect – המטבעות עפים לצ׳יפ והסחורה למחסן שלה. ' +
        'Claim שוקע על השפה שלו והופך ל־✓ עם המטבעות סופרים. גרירה למטה (לרוחב: ימינה) על הכותרת סוגרת, והגיליון יוצא כמו שנכנס.',
      render: (s, act) => (
        <>
          <ChipCoin />
          <LevelCard v={{ ...levelView(s.points, s.paid, s.gifts, { gain: s.gain, ready: s.ready }) }} onOpen={opened(s, act)} onClaim={claimed(s, act)} onClose={act.close} />
        </>
      ),
    },
  ],
}
