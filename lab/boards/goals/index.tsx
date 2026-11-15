import { art } from '../../../src/ui/art'
import type { Board } from '../../board'
import { CLOSE, LATER, READY, START, type GoalsState } from './data'
import { GoalsD } from './GoalsD'
import { Today } from './Today'
import '../level/board.css'

// The goals board (src/farm/GoalsPanel.tsx, src/farm/goals.ts): the trophy at the top opens it. Its states are made by
// the game's own pure code from a farm's numbers (./data.tsx); a claim moves a goal on to its next step as the game's
// claimGoal does, and its coins fly to the coin chip.

/** The coin of the chip at the top of the still, where the game's coins land (as on the level's board). */
const ChipCoin = () => (
  <span className="farm-chip-item coins lab-chip-coin" aria-hidden="true">
    <img src={art('coin')} alt="" />
  </span>
)

export const goalsBoard: Board<GoalsState> = {
  id: 'goals',
  title: 'מטרות',
  kind: 'ui',
  added: '2026-11-15T08:29',
  ask:
    'ביקשת לעצב את זה (🙋). מהמפה: שש שורות דומות, כולן ב־0, אף אחת לא "הבאה בתור"; הפרס קטן בצד; כשמטרה מושגת יש רק כפתור Claim ירוק – אין רגע. · ' +
    'סיבוב 2: "לשלב את B ו־A: שרואים 2 בשורה, פס התקדמות, עוד אנימציות – שילוב שלהם ושיפור."',
  status: 'choose',
  round:
    'סיבוב 2, לפי מה שענית (✓ A, ✓ B, "לשלב, 2 בשורה, פס התקדמות, עוד אנימציות"): A ו־B הם עכשיו עיצוב אחד, D. ' +
    'למעלה – הזרקור של A: המטרה הכי קרובה (או זו שהושגה) גדולה, עם אור רך מאחורי התמונה, הטבעת, המילים של כמה, מה היא נותנת ופס עם המספרים. ' +
    'מתחת – המדבקות של B, עכשיו שתיים בשורה, ולכל אחת פס התקדמות משלה עם המספר (44/60) ומדבקת המטבעות בפינה. ' +
    'עוד אנימציות: נגיעה במדבקה מעיפה את התמונה שלה לזרקור (וזו שהייתה שם חוזרת למקומה), חותמת ✓ נוחתת על Claim, הכרטיס מתהפך למדרגה הבאה כבר מלא בחלקו, ' +
    'ברק עובר על הפסים מדי פעם (מהר יותר ברבע האחרון), ומדבקה מוכנה מתנדנדת. C (לא סומנה) ירדה. חדש: E – לנעוץ מטרה בראש המסך (✦ תכונה חדשה).',
  still: 'yard',
  spot: 'goals',
  screen: 'goals',
  research: [
    {
      pattern: 'המשימה הבאה גדולה למעלה עם הפרס שלה, והשאר ברשימה קצרה מתחת. מכאן A: מטרה אחת בזרקור, ונגיעה בשורה מביאה אותה לזרקור.',
      from: 'Animal Crossing: New Horizons – Nook Miles',
      url: 'https://animal-crossing.com/new-horizons/',
    },
    {
      pattern: 'הישגים כאריחים: כל אחד תמונה בתוך טבעת שמתמלאת, וכשמושג – הוא "קופץ" מהדף ומחכה ללחיצה. מכאן B: ספר מדבקות.',
      from: 'Pokémon GO – מדליות; Duolingo – הישגים',
      url: 'https://pokemongolive.com/',
    },
    {
      pattern: 'כל מטרה היא סולם של מדרגות (10, 30, 75…) ותמיד יש עוד מדרגה – רואים את הקרובה ואת הדרך הארוכה יחד. מכאן C: מסילה עם המדרגה שמאחור, זו שמטפסים אליה, והבאה.',
      from: 'Hay Day – Achievements (שלושה כוכבים לכל הישג)',
      url: 'https://supercell.com/en/games/hayday/',
    },
    {
      pattern: 'מאמץ גדל כשהמטרה קרובה, ומה שכבר נעשה נספר הלאה: אחרי איסוף המדרגה הבאה מתחילה מלאה בחלקה, וברבע האחרון כתוב "Only 3 more!".',
      from: 'Kivetz, Urminsky & Zheng 2006 (goal gradient); Nunes & Drèze 2006 (endowed progress)',
      url: 'https://business.columbia.edu/faculty/research/goal-gradient-hypothesis-resurrected-purchase-acceleration-illusionary-goal',
    },
  ],
  states: [
    { id: 'start', name: 'תחילת המשחק: הכל בהתחלה', data: START },
    { id: 'close', name: 'כמה מטרות קרובות לסוף', data: CLOSE },
    { id: 'ready', name: 'שתי מטרות הושגו ומחכות לאיסוף', data: READY },
    { id: 'later', name: 'הרבה אחר כך: מספרים גדולים, מדרגות עמוקות', data: LATER },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'תמונה של לוח המטרות במשחק היום (הוא קורא את החווה בעצמו, אז אי אפשר לצייר אותו לבד כאן): שש שורות דומות עם פס דק, והפרס קטן בצד.',
      motion: 'החלון מחליק פנימה. Claim ירוק – והשורה מתחלפת, בלי רגע.',
      render: () => <Today />,
    },
    {
      id: 'd',
      name: 'זרקור ומדבקות (A + B)',
      note:
        'המטרה הבאה בזרקור למעלה (מ־A): התמונה בטבעת עם אור מאחוריה, מה לעשות, "Only 3 more!" ברבע האחרון, מה היא נותנת בתמונות, ופס עבה עם המספרים וסימן לבן איפה המדרגה התחילה. ' +
        'מתחת – שאר המטרות כמדבקות, שתיים בשורה (מ־B), לכל אחת טבעת, מילים, פס עם המספר ומדבקת מטבעות. מטרה שהושגה קמה מהדף עם Claim משלה. נגיעה במדבקה מביאה אותה לזרקור.',
      motion:
        'הגיליון עולה, הזרקור מתהפך פנימה והמדבקות קופצות אחת אחרי השנייה; הטבעות והפסים מתמלאים בגל. האור מאחורי הזרקור מסתובב לאט, וברק עובר על הפסים מדי פעם. ' +
        'נגיעה במדבקה: התמונה שלה עפה לזרקור והקודמת חוזרת למקומה. Claim: חותמת ✓ נוחתת בלחיצה, המטבעות עפים לצ׳יפ, קונפטי, והכרטיס מתהפך למדרגה הבאה – כבר מלאה בחלקה ("40% there already!").',
      render: (s, act) => (
        <>
          <ChipCoin />
          <GoalsD s={s} act={act} />
        </>
      ),
    },
    {
      id: 'e',
      name: 'D + נעיצה בראש המסך',
      note:
        'אותו לוח, וליד הפס של הזרקור כפתור סיכה: מטרה ננעצת עולה לראש המסך במשחק – פס קטן מתחת למצפן עם התמונה, המילים והמספר, שמתמלא תוך כדי משחק. ' +
        'כך רואים את ההתקדמות בלי לפתוח את הלוח. מדבקה של מטרה ננעצת מקבלת סיכה צהובה.',
      motion: 'נגיעה בסיכה: היא נצבעת צהוב, והפס הקטן עף מהגיליון למעלה ונוחת מתחת לצ׳יפים בקפיצה, והמילוי שלו רץ. נגיעה שוב – הוא עולה ונעלם.',
      adds: 'לנעוץ מטרה אחת לראש המסך: פס קטן מתחת למצפן שמראה את ההתקדמות שלה תוך כדי משחק, בלי לפתוח את לוח המטרות.',
      render: (s, act) => (
        <>
          <ChipCoin />
          <GoalsD s={s} act={act} pin />
        </>
      ),
    },
  ],
}
