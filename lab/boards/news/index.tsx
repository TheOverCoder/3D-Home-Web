import { NewsCard } from '../../../src/farm/news/NewsCard'
import { newsView } from '../../../src/farm/news/view'
import type { Board } from '../../board'
import { DRAW, DRAWN, FESTIVAL, POOL, QUIET, RUSH, drawn, type NewsState } from './data'

// The farm news (src/farm/news/NewsCard.tsx, LuckyReels.tsx; src/farm/news/NewsPanel.tsx feeds it the farm's), as the
// game has it: opened from the corner menu's "Farm news". Its states are moments of one week read by the game's own
// newsView over sample records (./data.ts); Draw draws on the lab's dice as the game's does on the farm's.

export const newsBoard: Board<NewsState> = {
  id: 'news',
  title: 'עיתון החווה והאירועים',
  kind: 'ui',
  added: '2026-11-16T12:25',
  ask:
    'אירועים שבועיים ועיתון לחווה, בנויים במשחק: יום הגרלה (פעם בשבוע – הגרלה בלחיצה אחת עם תחושת לוטו אמיתית, שני מוצרים שנמכרים ×2 כל היום), יום משלוחי מתנות כפולים, ' +
    'עיתון החווה עם "פעיל עכשיו" ו"בקרוב" עם ימים ושעות, ותג קטן כשיש אירוע שלא נראה או הגרלה שלא נעשתה; ועוד סוגי אירועים רק אם הם שווים את זה (עד 8).',
  status: 'live',
  chosen: 'today',
  round:
    'נבנה ישר במשחק (בלי סבב בחירה, כמו שביקשת) – מה שרואים כאן הוא הקוד של המשחק עם נתונים לדוגמה. ' +
    'חמישה אירועים בשבוע לפי התאריך והשעה של המכשיר: יום שוק (שני וראשון 8:00–20:00, קונים פי 2 בשער), פסטיבל הקציר (רביעי, גידולים גדלים פי 2), יום המתנות (חמישי, כל מתנה של קונה או הזמנה פעמיים), ' +
    'עומס במכונות (שישי 16:00–חצות, המכונות פי 2) ויום ההגרלה (שבת). שלישי שקט. העיתון בתפריט הפינה, עם תג שמש כשמשהו מחכה.',
  still: 'yard',
  spot: 'settings',
  screen: 'news',
  research: [
    {
      pattern: 'אירועים קצרים שחוזרים: "בונוס" (עוד פרסים בהזמנות) ו"האצה" (גידולים או מכונות מהר יותר), כל אחד יום אחד – מכאן חמשת האירועים, כל אחד משנה דבר אחד שהשחקן כבר עושה.',
      from: 'Hay Day – אירועי בונוס והאצה (ויקי הקהילה)',
    },
    {
      pattern: 'גלגלים שעוצרים אחד אחרי השני בונים ציפייה; ההאטה בסוף רכה, עם מעט "עבר ונחזר"; התוצאה נקבעת לפני שמשהו זז – מה שרואים הוא מה שהוגרל.',
      from: 'עיצוב גלגלי מכונות מזל (עצירה בזה אחר זה, האטה בשלבים)',
      url: 'https://animationxpress.com/?p=1633039',
    },
    {
      pattern: 'בלי מניפולציה: ההגרלה חינם, פעם ביום שלה, בלי "כמעט" מזויף ובלי טיימר שלוחץ; מה שהוגרל נשאר לכל היום.',
      from: 'lab/CRAFT.md – Ethics (Clark et al. 2009 על near-miss; Zendle & Cairns 2018)',
    },
    {
      pattern: 'תג על הכפתור כשמשהו מחכה, שנעלם כשנראה – אותו תג בכל המשחק.',
      from: 'Township / Hay Day – תגים על התפריט',
      url: 'https://www.playrix.com/township',
    },
  ],
  states: [
    { id: 'draw', name: 'שבת: ההגרלה מחכה', data: DRAW },
    { id: 'drawn', name: 'שבת אחרי ההגרלה: עגבניות ועוגת לימון ×2', data: DRAWN },
    { id: 'festival', name: 'רביעי: פסטיבל הקציר (חדש)', data: FESTIVAL },
    { id: 'rush', name: 'שישי בערב: עומס במכונות (כבר נראה)', data: RUSH },
    { id: 'quiet', name: 'שלישי: יום שקט, רק "בקרוב"', data: QUIET },
  ],
  variants: [
    {
      id: 'today',
      name: 'במשחק',
      note:
        'עמוד ראשון של עיתון: הראש (העיתון המגולגל, Farm News, התאריך, קו כפול), "Active now" – האירוע של היום כסיפור: תמונה, מה הוא עושה, שבב האפקט, עד מתי וכמה נשאר על פס שמתרוקן; ' +
        'ביום ההגרלה הסיפור הוא המכונה עצמה: שני גלגלים ו־Draw אחד. "Coming soon": כל אירוע אחר על דף לוח שנה (יום ותאריך), שם, מתי ("Tomorrow · All day") ושבב. יום שקט אומר מה הבא.',
      motion:
        'הגיליון עולה (לרוחב: מימין) והבלוקים נכנסים אחד אחרי השני; התמונה של האירוע נוחתת אחרונה בקפיץ, והפס של הזמן שנשאר מתמלא. ' +
        'Draw: הנורות רצות, כל גלגל נמשך מעט לאחור, מסתובב דרך המוצרים ומאט אל המוצר שלו עם קפיצה קטנה – הראשון, ואז השני – רטט קטן וחותמת ×2 בכל נחיתה, וכששניהם בפנים קונפטי אחד וצליל של מתנה. נגיעה בגלגלים עוצרת מיד. החלקה למטה סוגרת.',
      render: (s, act) => (
        <NewsCard
          v={newsView(s.at, s.rec, POOL, s.seenBefore)}
          onDraw={() => {
            const [next, goods] = drawn(s)
            act.set(next)
            return goods
          }}
          onClose={act.close}
        />
      ),
    },
  ],
}
