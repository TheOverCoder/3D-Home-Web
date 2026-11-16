import { LevelCard } from '../../../src/farm/LevelCard'
import { levelView } from '../../../src/farm/levelView'
import { xpAt } from '../../../src/farm/xp'
import { flyCoins } from '../../../src/fx/coins'
import { coinsToFly } from '../../../src/fx/fx'
import { art } from '../../../src/ui/art'
import type { Act, Board } from '../../board'
import { BOXES } from './gifts'
import { LevelCardF } from './LevelCardF'
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
const at = (points: number, paid: number, gain: number, ready?: LevelState['ready'], boxes?: string): LevelState => ({
  ...levelView(points, paid),
  gain,
  ready,
  boxes: boxes ? BOXES[boxes] : undefined,
})

export const levelBoard: Board<LevelState> = {
  id: 'level',
  title: 'חלון הרמה',
  kind: 'ui',
  added: '2026-11-16T04:30',
  ask:
    'הפופאפ של הרמה לא נראה מקצועי לעיצוב · סיבוב 2: "שירגיש משחק ממכר – שיהיה ברור כמה הסרגל מלא, סימונים חכמים על הסרגל, והרגשה של התקדמות שנותנת היי קטן" · ' +
    'סיבוב 3: "לשלב בצורה חכמה את C ו־B: אהבתי את התאורה מאחורי החפצים, והסרגל צריך להיות כמו במשחקים פופולריים, עם העקרונות של משחק מתגמל; לשלב את כל האנימציות בצורה יעילה."',
  status: 'choose',
  spot: 'level',
  screen: 'level',
  round:
    'סיבוב 5, לפי ההערה על E ("רפרנס אחד; הגלילה לא עובדת; פתיחת המתנה לא ברורה; הרמות הקודמות לא מעניינות; להתמקד בהתקדמות ובתחושת הישג; פרס קטן לפתוח כל 25% – ארבעה; כפתור מתנה למה שלא נאסף; ' +
    'המתנה של עליית רמה נפרדת מהארבעה ונאספת לבד; את ה־random box המשתמש אוסף בעצמו, בקלות"). D ו־E ירדו – נשאר רפרנס אחד, F, בנוי מחדש: ' +
    '(1) הגיבור הוא סרגל הרמה, מחולק לארבעה רבעים, ועל סוף כל רבע עומדת קופסה – אפורה ונעולה עד שהסרגל מגיע אליה (הבאה בתור אומרת כמה XP חסר), ואז זוהרת, קופצת ומחכה לנגיעה אחת, ואחרי שנפתחה – מה שהיא נתנה במקומה עם ✓. ' +
    'הקופסה הרביעית (100%) מגיעה עם הרמה הבאה. (2) פתיחה ברורה: הקופסה עפה מהסרגל לאמצע הכרטיס וגדלה, רועדת כשהאור מתאסף מאחוריה, ומתפוצצת – קרני אור, קצת קונפטי, והפרס עולה ממנה גדול עם השם והכמות; Collect (או נגיעה) שולח אותו הביתה – המטבעות לצ׳יפ. ' +
    '(3) כפתור מתנה צהוב בתחתית: "Open 3 gifts" – פותח בבת אחת את כל מה שמחכה, מהרמה הזו ומרמות קודמות (שורה של קופסאות שמתפוצצות אחת אחרי השנייה, ואז סכום). אף קופסה לא הולכת לאיבוד. ' +
    '(4) מה שהרמה הבאה נותנת – המטבעות, בגד כל רמה חמישית והפתעה קטנה – מסומן "Comes by itself": אין יותר Claim; ברמה חדשה רואים למעלה "Level 7 reached!" ומה שנכנס לבד. ' +
    '(5) הרמות הקודמות ירדו; במקומן – האחוז הגדול, כמה עוד (או כמה כבר), "+9 new" על מה שהרווחת, ו"רוח" של מה שמוכן בחווה. (6) הגלילה: הכל נכנס בלי גלילה לאורך ולרוחב (לרוחב – הסרגל לרוחב כל הגיליון, ומתחתיו הרמה הבאה והכפתור זה ליד זה); בטלפון קטן הגוף גולל לבד ורק הכותרת מורידה את הגיליון. ' +
    'מצב חדש: "many" – חזרת אחרי זמן ויש הרבה קופסאות שמחכות.',
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
    { id: 'gift', name: 'ברמה הבאה בגד; קופסה אחת נפתחה, אחת מחכה, ועוד אחת מרמה 3', data: at(xpAt(4) + 40, 2, 9, beds('lettuce', 6), 'gift') },
    { id: 'almost', name: 'כמעט: חסרים 10 XP, שלוש הקופסאות נפתחו, ומה שמוכן בחווה מספיק', data: at(xpAt(9) + 125, 9, 14, beds('carrot', 8), 'almost') },
    { id: 'fresh', name: 'רמה חדשה (7): מה שהיא נתנה נכנס לבד; הקופסה האחרונה של רמה 6 מחכה', data: at(xpAt(7) + 6, 7, 6, goods('egg', 4), 'fresh') },
    { id: 'later', name: 'שליש מהרמה: קופסה אחת מוכנה ועוד שתיים מרמה 5', data: at(xpAt(6) + 30, 6, 5, undefined, 'later') },
    { id: 'many', name: 'חזרת אחרי זמן: הרבה קופסאות מחכות', data: at(xpAt(12) + 144, 12, 20, beds('tomato', 4), 'many') },
    { id: 'top', name: 'הרמה העליונה', data: at(xpAt(500) + 1, 500, 0, undefined, 'top') },
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
      id: 'f',
      name: 'התקדמות שפותחים',
      note:
        'הסרגל של הרמה הוא הגיבור: ארבעה רבעים, ועל סוף כל אחד קופסה – נעולה (עם כמה XP חסר לבאה), מוכנה (זוהרת וקופצת: נגיעה פותחת), או פתוחה (מה שנתנה עם ✓). ' +
        'מעליו האחוז הגדול וכמה עוד לרמה הבאה; בקצה – הכוכב של הרמה הבאה. מתחת: מה הרמה הבאה נותנת, "Comes by itself" (בלי Claim), וכפתור צהוב אחד כשמחכות קופסאות – "Open 3 gifts", כולל מרמות קודמות.',
      motion:
        'הגיליון עולה, הסרגל מתמלא ממה שהיה למה שיש (מה שהרווחת בוהק, "+9 new" קופץ), והקופסאות המוכנות קופצות ומתנדנדות מדי פעם. ' +
        'פתיחה: הקופסה עפה לאמצע הכרטיס וגדלה, רועדת, ומתפוצצת עם קרני אור וקונפטי – הפרס עולה גדול עם השם והמספר; Collect – המטבעות עפים לצ׳יפ, והקופסה על הסרגל הופכת לפרס עם ✓. ' +
        'כמה קופסאות: שורה שמתפוצצת אחת אחרי השנייה, ואז הסכום. גרירה למטה (לרוחב: ימינה) על הכותרת סוגרת.',
      adds: 'ארבע קופסאות הפתעה בכל רמה (ב־25%, 50%, 75% ו־100%) שהשחקן פותח בנגיעה, כפתור שפותח את כל מה שמחכה (גם מרמות קודמות), ומה שהרמה נותנת (מטבעות, בגד, הפתעה קטנה) נכנס לבד בלי Claim. הנתונים כאן לדוגמה.',
      render: (v, act) => (
        <>
          <ChipCoin />
          <LevelCardF v={v} boxes={v.boxes ?? { opened: [], missed: [] }} onClose={act.close} />
        </>
      ),
    },
  ],
}
