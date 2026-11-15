import { art } from '../../../src/ui/art'
import type { Board } from '../../board'
import { CLOSE, LATER, READY, START, type GoalsState } from './data'
import { GoalsA } from './GoalsA'
import { GoalsB } from './GoalsB'
import { GoalsC } from './GoalsC'
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
  added: '2026-11-15T01:37',
  ask: 'ביקשת לעצב את זה (🙋). מהמפה: שש שורות דומות, כולן ב־0, אף אחת לא "הבאה בתור"; הפרס קטן בצד; כשמטרה מושגת יש רק כפתור Claim ירוק – אין רגע.',
  status: 'choose',
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
      id: 'a',
      name: 'המטרה הבאה בזרקור',
      note:
        'המטרה הכי קרובה (או זו שהושגה) גדולה למעלה: התמונה שלה בתוך טבעת שמתמלאת, מה לעשות, המספר, ומילים של כמה: מתחת לחצי – כמה עשית, מעל – כמה נשאר, ברבע האחרון "Only 3 more!". ' +
        'מה היא נותנת – בתמונות. על הפס סימן לבן: איפה התחילה המדרגה הזאת. השאר בשורות קצרות מתחת; נגיעה בשורה מביאה אותה לזרקור.',
      motion:
        'הגיליון עולה, הטבעת מתמלאת והפס רץ. מטרה שהושגה מקבלת חותמת ✓ שנוחתת. Claim: המטבעות עפים לצ׳יפ, קונפטי, והכרטיס מתהפך אל המדרגה הבאה של אותה מטרה – כבר מלאה בחלקה ("40% there already!").',
      render: (s, act) => (
        <>
          <ChipCoin />
          <GoalsA s={s} act={act} />
        </>
      ),
    },
    {
      id: 'b',
      name: 'ספר מדבקות',
      note:
        'שש המטרות כאריחים ברשת: בכל אריח התמונה בתוך טבעת שמתמלאת, מה לעשות, כמה (באותן מילים חכמות), ומדבקה בפינה של כמה מטבעות הוא נותן. ' +
        'מטרה שהושגה "קמה" מהדף – טבעת ירוקה, מתנדנדת, ופס Claim לרוחב התחתית. בלי גלילה, לאורך ולרוחב.',
      motion: 'האריחים קופצים אחד אחרי השני, והטבעות מתמלאות. אריח מוכן מתנדנד למעלה ולמטה. Claim: המטבעות עפים לצ׳יפ, קונפטי, והאריח מתהפך אל המדרגה הבאה, הטבעת שלו כבר מלאה בחלקה.',
      render: (s, act) => (
        <>
          <ChipCoin />
          <GoalsB s={s} act={act} />
        </>
      ),
    },
    {
      id: 'c',
      name: 'סולמות',
      note:
        'כל מטרה היא מסילה קצרה של המספרים שלה: המדרגה שמאחוריך (✓ זהב), זו שאתה מטפס אליה (והפרס שלה מעליה), והבאה – חיוורת, כי תמיד יש עוד. ' +
        'הקטע שאתה עליו מתמלא, וברבע האחרון כתוב מתחת לראש "3 more". מדרגה שהושגה הופכת לכפתור ירוק עגול על המסילה עצמה: לוחצים על אבן הדרך כדי לקחת את הפרס.',
      motion: 'השורות נכנסות אחת אחרי השנייה והקטעים מתמלאים עם ראש זוהר. כפתור מוכן פועם. לחיצה: המטבעות עפים לצ׳יפ, קונפטי, והמסילה גולשת מדרגה אחת קדימה – הקטע החדש כבר מלא בחלקו.',
      render: (s, act) => (
        <>
          <ChipCoin />
          <GoalsC s={s} act={act} />
        </>
      ),
    },
  ],
}
