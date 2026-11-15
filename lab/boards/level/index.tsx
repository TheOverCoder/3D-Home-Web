import { LevelCard } from '../../../src/farm/LevelCard'
import { levelView } from '../../../src/farm/levelView'
import { xpAt } from '../../../src/farm/xp'
import { flyCoins } from '../../../src/fx/coins'
import { coinsToFly } from '../../../src/fx/fx'
import { art } from '../../../src/ui/art'
import type { Act, Board } from '../../board'
import { LevelCardD } from './LevelCardD'
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
const at = (points: number, paid: number, gain: number, ready?: LevelState['ready'], opened = 0): LevelState => ({ ...levelView(points, paid), gain, ready, opened })

export const levelBoard: Board<LevelState> = {
  id: 'level',
  title: 'חלון הרמה',
  kind: 'ui',
  added: '2026-11-15T08:29',
  ask:
    'הפופאפ של הרמה לא נראה מקצועי לעיצוב · סיבוב 2: "שירגיש משחק ממכר – שיהיה ברור כמה הסרגל מלא, סימונים חכמים על הסרגל, והרגשה של התקדמות שנותנת היי קטן" · ' +
    'סיבוב 3: "לשלב בצורה חכמה את C ו־B: אהבתי את התאורה מאחורי החפצים, והסרגל צריך להיות כמו במשחקים פופולריים, עם העקרונות של משחק מתגמל; לשלב את כל האנימציות בצורה יעילה."',
  status: 'choose',
  spot: 'level',
  screen: 'level',
  round:
    'סיבוב 4, לפי מה שענית (✗ A, ✓ B, ✓ C, "לשלב את B ו־C"): B ו־C הם עכשיו עיצוב אחד, D. ' +
    'מ־B: הבמה עם האור מאחורי הפרס (הקרניים נפתחות כשהוא נוחת ומסתובבות לאט) והמספר הגדול של כמה מלא. ' +
    'מ־C: הסרגל הוא הדרך של הפרק – חותמות זהב של הרמות שעברת (ומטבעות שמחכים מעליהן), הכוכב שלך, התחנה הבאה עם הפרס שלה בהילה של אור, והבגד של סוף הפרק – גם הוא באור. ' +
    'הסרגל עצמו נבנה מחדש כמו במשחקים פופולריים: עבה, מסילה כהה עם שוליים לבנים, מילוי מבריק עם פסים שזזים, ראש זוהר, והמספרים בתוך הסרגל (40 / 60). ' +
    'הסימונים החכמים: ארבעה רבעים – כל רבע שעברת הופך לכוכב זהב שמצלצל (מטרות קרובות); מה שהרווחת מאז הפעם הקודמת בוהק; "רוח" מפוספסת של מה שמוכן בחווה; ברבע האחרון הסרגל מתחמם והפרס קופץ. ' +
    'האנימציות הן עכשיו רצף אחד: הפרס נופל והאור נפתח, החותמות נדלקות עד הכוכב, הסרגל מתמלא, התחנה הבאה מצלצלת. ' +
    'A (✗) כבר ירדה בסיבוב הקודם. חדש: E – אותו כרטיס עם מתנה קטנה על כל רבע של הסרגל (✦ תכונה חדשה).',
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
    { id: 'gift', name: 'ברמה הבאה בגד, ויש מטבעות לאסוף', data: at(xpAt(4) + 40, 2, 9, beds('lettuce', 6), 1) },
    { id: 'almost', name: 'כמעט: חסרים 10 XP, ומה שמוכן בחווה מספיק', data: at(xpAt(9) + 125, 9, 14, beds('carrot', 8), 2) },
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
      id: 'd',
      name: 'הבמה והדרך (B + C)',
      note:
        'למעלה – הבמה של B: מה שהרמה הבאה נותנת, גדול, עם אור מאחוריו. מתחת – המספר הגדול של כמה מלא, ואז הדרך של C: חותמות הזהב של הרמות שעברת, הכוכב שלך, ' +
        'סרגל עבה כמו במשחקים (המספרים בתוכו, רבעים שהופכים לכוכבים, מה שהרווחת בוהק, "רוח" של מה שמוכן), התחנה הבאה בהילה של אור, והבגד בסוף הפרק. מתחת – מה הפעולה הבאה שווה.',
      motion:
        'רצף אחד: הגיליון עולה, הפרס נופל על הבמה ונמעך והקרניים נפתחות; החותמות נדלקות אחת אחת עד הכוכב שלך שנוחת בסיבוב; הסרגל מתמלא – מה שהיה, רגע, ואז מה שהרווחת בוהק – ' +
        'כל רבע שהוא עובר הופך לכוכב ומצלצל, האחוז והמספרים רצים, "+9 new" קופץ, והתחנה הבאה מצלצלת. הפסים בסרגל זזים כל הזמן, וברבע האחרון הפרס קופץ מדי פעם. ' +
        'איסוף: המטבעות עפים מהחותמות ומהכפתור לצ׳יפ, הכוכב קופץ, וקונפטי פעם אחת. גרירה למטה (לרוחב: ימינה) סוגרת.',
      render: card(LevelCardD),
    },
    {
      id: 'e',
      name: 'D + מתנה על כל רבע',
      note: 'אותו כרטיס, ועל כל רבע של הסרגל מתנה קטנה: אפורה עד שהסרגל עובר אותה, ואז היא זוהרת, קופצת ומחכה לנגיעה. בתוכה כמה מטבעות או חומר בנייה – פרס קטן וקרוב בדרך לפרס הגדול של הרמה.',
      motion: 'מתנה שהסרגל עבר נדלקת עם הכוכב של הרבע, וקופצת כל כמה שניות עם נקודה אדומה. נגיעה: היא רועדת, גדלה ונפתחת – מה שבתוכה עולה ממנה (מטבעות עפים לצ׳יפ), ובמקומה נשאר ✓ ירוק.',
      adds: 'מתנה קטנה על כל רבע של סרגל הרמה (מטבעות או חומר בנייה), שנפתחת בנגיעה כשהסרגל עובר אותה – פרסים קרובים בדרך לרמה. הנתונים כאן לדוגמה.',
      render: (v, act) => (
        <>
          <ChipCoin />
          <LevelCardD v={v} onClaim={claimed(v, act)} onClose={act.close} gifts />
        </>
      ),
    },
  ],
}
