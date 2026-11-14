import { LevelCard } from '../../../src/farm/LevelCard'
import { levelView, type LevelView } from '../../../src/farm/levelView'
import { xpAt } from '../../../src/farm/xp'
import { flyCoins } from '../../../src/fx/coins'
import { coinsToFly } from '../../../src/fx/fx'
import { art } from '../../../src/ui/art'
import type { Act, Board } from '../../board'
import { LevelCardA } from './LevelCardA'
import { LevelCardB } from './LevelCardB'
import { LevelCardC } from './LevelCardC'
import './board.css'

// The level's card (src/farm/LevelCard.tsx): the level chip opens it. Its states from the game's own numbers.

/** What the game's LevelPanel does on a claim: the coins fly from the Claim button to the coin chip (src/fx/coins.ts),
 *  and the card is told the coins are paid. */
const claimed = (v: LevelView, act: Act<LevelView>) => (button: HTMLElement) => {
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

type Card = typeof LevelCard
const card = (Look: Card) => (v: LevelView, act: Act<LevelView>) => (
  <>
    <ChipCoin />
    <Look v={v} onClaim={claimed(v, act)} onClose={act.close} />
  </>
)

export const levelBoard: Board<LevelView> = {
  id: 'level',
  title: 'חלון הרמה',
  ask: 'הפופאפ של הרמה לא נראה מקצועי לעיצוב',
  status: 'choose',
  spot: 'level',
  screen: 'level',
  round:
    'סיבוב 2: כל גרסה זזה ועונה לאצבע – הגיליון נכנס והתוכן אחריו, ההתקדמות מתמלאת והמספר רץ, הפרס נחשף, לחיצה על "Claim" שוקעת ומעיפה את המטבעות לצ׳יפ, וגרירה למטה (לרוחב: ימינה) סוגרת. ' +
    'ברמה העליונה הגיליון לרוחב כבר לא ריק, והתוכן לרוחב מתרחק מהפינה המעוגלת.',
  still: 'yard',
  states: [
    { id: 'gift', name: 'ברמה הבאה בגד, ויש מטבעות לאסוף', data: levelView(xpAt(4) + 40, 2) },
    { id: 'later', name: 'ברמה הבאה אין בגד', data: levelView(xpAt(6) + 30, 6) },
    { id: 'top', name: 'הרמה העליונה', data: levelView(xpAt(500) + 1, 500) },
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
      id: 'a',
      name: 'מדליה',
      note: 'הרמה במרכז: הכוכב הגדול בתוך טבעת שמתמלאת לפי ה-XP. מה שהרמה הבאה נותנת – בשני אריחים, הבגד הגדול והמטבעות לידו.',
      motion:
        'הגיליון עולה, ואז הכוכב נוחת בתוך הטבעת. הטבעת מתמלאת עם נקודה זוהרת בקצה, והמספר של ה-XP החסר יורד. האריחים קופצים אחד אחרי השני, וברק עובר על הבגד. ' +
        'באיסוף המדליה קופצת ויוצא ממנה קונפטי. ברמה העליונה הטבעת זהב ואור מסתובב מאחוריה.',
      render: card(LevelCardA),
    },
    {
      id: 'b',
      name: 'חלון ראווה',
      note: 'הפרס של הרמה הבאה הוא הגיבור: הבגד גדול על במה עם קרני אור, ומיד מתחתיו הסרגל – כמה XP חסר כדי לקבל אותו.',
      motion:
        'הגיליון עולה והסרט נפרש. הבגד נופל על הבמה ונמעך קצת כשהוא נוחת, ואז האור נדלק והמדבקה של המטבעות נדבקת. הסרגל מתמלא והמספר יורד. ' +
        'באיסוף הכוכב שליד הכותרת קופץ ויוצא ממנו קונפטי. ברמה העליונה נוחת גביע.',
      render: card(LevelCardB),
    },
    {
      id: 'c',
      name: 'מסלול',
      note: 'דרך קצרה מהרמה שלך לרמה הבאה, שמתמלאת לפי ה-XP. מהתחנה הבאה יורד כרטיס עם מה שהיא נותנת.',
      motion:
        'הגיליון עולה, הכוכב שלך נוחת, והדרך מתמלאת ממנו עם נקודה זוהרת בקצה. התחנה הבאה מצלצלת, הסימן שלה קופץ, והכרטיס נופל ממנה ומתנדנד על הוו. ' +
        'באיסוף הכוכב שלך קופץ ויוצא ממנו קונפטי. ברמה העליונה הדרך זהב מרמה 1 עד הכוכב שלך.',
      render: card(LevelCardC),
    },
  ],
}
