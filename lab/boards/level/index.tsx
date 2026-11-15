import { LevelCard } from '../../../src/farm/LevelCard'
import { levelView } from '../../../src/farm/levelView'
import { xpAt } from '../../../src/farm/xp'
import { flyCoins } from '../../../src/fx/coins'
import { coinsToFly } from '../../../src/fx/fx'
import { art } from '../../../src/ui/art'
import type { Act, Board } from '../../board'
import { LevelCardB } from './LevelCardB'
import { LevelCardC } from './LevelCardC'
import { beds, goods, type LevelState } from './progress'
import './board.css'

// The level's card (src/farm/LevelCard.tsx): the level chip opens it. Its states from the game's own numbers.

/** What the game's LevelPanel does on a claim: the coins fly from the Claim button to the coin chip (src/fx/coins.ts),
 *  and the card is told the coins are paid. */
const claimed = (v: LevelState, act: Act<LevelState>) => (button: HTMLElement) => {
  const r = button.getBoundingClientRect()
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) flyCoins(r.left + r.width / 2, r.top + r.height / 2, coinsToFly(v.unpaid))
  act.set({ ...v, unpaid: 0 })
}

/** The coin of the chip at the top of the still, where the game's coins land (the still is a picture: an unseen stand-in
 *  where the chip's coin is drawn, found by the game's flight as the chip itself would be). */
const ChipCoin = () => (
  <span className="farm-chip-item coins lab-chip-coin" aria-hidden="true">
    <img src={art('coin')} alt="" />
  </span>
)

type Card = (p: { v: LevelState; onClaim: (button: HTMLElement) => void; onClose: () => void }) => ReturnType<typeof LevelCard>
const card = (Look: Card) => (v: LevelState, act: Act<LevelState>) => (
  <>
    <ChipCoin />
    <Look v={v} onClaim={claimed(v, act)} onClose={act.close} />
  </>
)

/** A state: the game's card for these XP, with what was gained since it was last open and what is ready on the farm. */
const at = (points: number, paid: number, gain: number, ready?: LevelState['ready']): LevelState => ({ ...levelView(points, paid), gain, ready })

export const levelBoard: Board<LevelState> = {
  id: 'level',
  title: 'חלון הרמה',
  kind: 'ui',
  added: '2026-11-13T17:28',
  ask: 'הפופאפ של הרמה לא נראה מקצועי לעיצוב · ובסיבוב 2: "שירגיש משחק ממכר – שיהיה ברור כמה הסרגל מלא, סימונים חכמים על הסרגל, והרגשה של התקדמות שנותנת היי קטן"',
  status: 'choose',
  spot: 'level',
  screen: 'level',
  round:
    'סיבוב 3, תשובה להערה על B: הסרגל נבנה מחדש לפי מחקרי ההתקדמות (נוסף פרק "The feeling of progress" ל־CRAFT.md). ' +
    'מספר גדול אומר כמה מלא (67%). הסרגל מחולק לארבעה רבעים – כל רבע שעברת נדלק, מטרות קרובות במקום אחת רחוקה. ' +
    'מה שהרווחת מאז הפעם הקודמת שפתחת מתמלא אחרון ובוהק, ו"+9 XP" קופץ ממנו – זה ה"היי" הקטן. ' +
    'אחרי ראש הסרגל יש "רוח" מפוספסת: כמה ירחיק אותך מה שכבר מוכן בחווה ("6 חסות מוכנות: +12 XP"), ואם זה מספיק לרמה – זה נכתב. ' +
    'מתחת לחצי כתוב כמה עשית, מעל החצי כמה נשאר; קרוב לסוף הסרגל מתחמם לצהוב והפרס קופץ. ' +
    'ב־C הדרך עכשיו כל ה"פרק": מהבגד הקודם עד הבגד הבא, כל רמה תחנה עם ✓ זהוב, ומטבע מקפץ מעל רמות שעוד לא אספת – רואים מה כבר שלך ומה הבא. ' +
    'A (✗) ירדה. נוספו שני מצבים: "כמעט" (חסרים 10 XP) ו"רמה חדשה" (התחלה עם מה שכבר נצבר).',
  still: 'yard',
  states: [
    { id: 'gift', name: 'ברמה הבאה בגד, ויש מטבעות לאסוף', data: at(xpAt(4) + 40, 2, 9, beds('lettuce', 6)) },
    { id: 'almost', name: 'כמעט: חסרים 10 XP, ומה שמוכן בחווה מספיק', data: at(xpAt(9) + 125, 9, 14, beds('carrot', 8)) },
    { id: 'fresh', name: 'רמה חדשה: מתחילים עם מה שכבר נצבר', data: at(xpAt(7) + 6, 6, 6, goods('egg', 4)) },
    { id: 'later', name: 'ברמה הבאה אין בגד, ואין מה שמוכן', data: at(xpAt(6) + 30, 6, 5) },
    { id: 'top', name: 'הרמה העליונה', data: at(xpAt(500) + 1, 500, 0) },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'מה שיש במשחק עכשיו.',
      motion: 'הגיליון מחליק פנימה, והבגד קופץ. באיסוף המטבעות עפים לצ׳יפ. אין גרירה לסגירה, והוא נעלם ביציאה בלי תנועה.',
      render: card(LevelCard),
    },
    {
      id: 'b',
      name: 'חלון ראווה',
      note:
        'הפרס של הרמה הבאה גדול על במה, ומתחתיו סרגל עבה שאפשר להרגיש: מספר גדול של כמה מלא, ארבעה רבעים שנדלקים, מה שהרווחת מאז הפעם הקודמת בוהק, ' +
        '"רוח" של מה שמוכן בחווה, והרמה הבאה בסוף הסרגל. מתחת – מה הפעולה הבאה שווה.',
      motion:
        'הגיליון עולה, הבגד נופל על הבמה ונמעך, והאור נדלק. אז הסרגל: קודם מה שהיה לך, רגע, ואז מה שהרווחת מתמלא בוהק – כל רבע שהוא עובר מצלצל בטבעת, האחוז רץ, ו"+9 XP חדש" קופץ. ' +
        'ה"רוח" מופיעה ונושמת. קרוב לסוף – הסרגל מתחמם והעיגול של הרמה הבאה מתנדנד כל כמה שניות. באיסוף הכוכב קופץ וקונפטי.',
      render: card(LevelCardB),
    },
    {
      id: 'c',
      name: 'מסלול הפרק',
      note:
        'דרך שלמה מהבגד הקודם לבגד הבא: כל רמה תחנה. מה שעברת – חותמות זהב ✓, ומטבע מקפץ מעל רמות שעוד לא אספת. הקטע שאתה עליו הכי רחב, מחולק לרבעים, עם מה שהרווחת ו"רוח" של מה שמוכן. ' +
        'מהתחנה הבאה תלוי כרטיס עם מה שהיא נותנת.',
      motion:
        'החותמות נדלקות אחת אחרי השנייה עד הכוכב שלך, הכוכב נוחת, הקטע מתמלא (קודם מה שהיה, אז מה שהרווחת עם "+9"), התחנה הבאה מצלצלת והכרטיס נופל ומתנדנד. ' +
        'באיסוף המטבעות עפים מהחותמות למעלה, הכוכב קופץ וקונפטי. כשמה שמוכן מספיק – התחנה הבאה מתנדנדת.',
      render: card(LevelCardC),
    },
  ],
}
