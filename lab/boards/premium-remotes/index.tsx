import type { Board } from '../../board'
import { STATES, type RemoteState } from './data'
import { PremiumRemotesA } from './PremiumRemotesA'
import { PremiumRemotesToday } from './PremiumRemotesToday'

// The two premium remotes (plans/animal-tools.md §2–§3): a good's picture in any panel opens its "where is it made"
// bubble (the order board's, as src/ui/GoodPic.tsx), with the button goFor picks — with the machines' remote "Open
// the mill", with the animals' remote and the tool owned "Open the coop" (the premium look), else "Show me" on the farm,
// else the words alone. Opened from afar, a panel says so and goes back where it was opened. And the remotes in the
// shop, 10,000 each. The scenes are the barn (its panel), the line at the gate, the oven's recipe and the shop; the
// mill from afar is the game's own machine panel (its sample), the coop the animal-tools board's A. Where a good comes
// from is the game's (sourceOf); goFor and the remotes are SAMPLE (./data.ts) until the game has them.

const ASK =
  'שני שלטי פרימיום, 10,000 מטבעות כל אחד, במראה מיוחד: שלט המכונות פותח את המכונה עצמה מהקשה על מוצר בחלון; שלט החיות (רק אחרי שיש כלי אחד לפחות) פותח את חלון הכלי של החיה, לאיסוף מרחוק. רק מהקשה על מוצר בתוך חלון. ' +
  'בלי שלט, הבועה רק אומרת מאיפה המוצר בא ומציעה "הראה לי".'

const ADDS = 'בכל חלון, הקשה על מוצר אומרת מאיפה הוא בא; ושני שלטי פרימיום (10,000 כל אחד) פותחים משם את המכונה או את הכלי של החיה, גם מרחוק.'

export const premiumRemotesBoard: Board<RemoteState> = {
  id: 'premium-remotes',
  title: 'שלטי הפרימיום',
  kind: 'ui',
  added: '2026-11-17T06:30',
  ask: ASK,
  status: 'choose',
  still: 'yard-clean',
  spot: 'store-2',
  screen: 'store',
  devices: ['upright', 'sideways', 'desktop'],
  research: [
    {
      pattern: 'הקשה על מוצר שחסר בהזמנה פותחת בועה שאומרת מי מייצר אותו – בלי לחפש. כאן: אותה בועה בכל חלון שיש בו תמונה של מוצר.',
      from: 'Hay Day – לוח המשלוחים (בועת המוצר והיצרן שלו)',
      url: 'https://www.supercheats.com/hay-day/walkthrough/production-buildings',
    },
    {
      pattern: 'כפתור "Go To" שמוצא את המבנה בשבילך: הדרך מהמוצר אל המקום שעושה אותו היא לחיצה אחת. כאן: "Show me", ועם שלט – פתיחה מרחוק.',
      from: 'The Simpsons: Tapped Out – Go To',
      url: 'https://answers.ea.com/t5/The-Simpsons-Tapped-Out/Zavislo-zadanie-v-simpsonah/td-p/12114580',
    },
    {
      pattern: 'דבר פרימיום נראה כמו שכבה אחרת: שפה זהובה, כתר ונצנוץ איטי – אבל בלי צבע חדש: מהצהוב של המשחק (A, C), או מהכהה של השבבים שלו (B).',
      from: 'ערכות ממשק "VIP" של משחקי מובייל – מסגרת זהב, כתר ונצנוץ (Black & Gold Game UI; HeroQuest UI Kit)',
      url: 'https://claireart8023.itch.io/blackgoldgameui6',
    },
    {
      pattern: 'חלון שנפתח ממקום אחר אומר מאיפה באת ואיך חוזרים (פירורי לחם / כפתור חזרה עם שם המקום), כדי שהקפיצה לא תבלבל.',
      from: 'Apple Human Interface Guidelines – Navigation (back button titled with the previous place)',
      url: 'https://developer.apple.com/design/human-interface-guidelines/navigation-bars',
    },
  ],
  states: STATES,
  variants: [
    {
      id: 'today',
      name: 'היום',
      note:
        'היום "מאיפה זה בא" קיים רק בלוח ההזמנות: הקשה על מוצר בהזמנה פותחת בועה – השם, כמה כבר בפנים, כמה במחסן, מאיפה הוא בא – ו־"Show me" כשאין מספיק, שהולך לשם. ' +
        'אין בועה כזאת באסם, בתור, במכונה או בשום חלון אחר, ואין שלטים. כאן: הלוח של המשחק עצמו, עם הזמנה של קמח, ביצים וחלב – נגיעה במוצר.',
      motion: 'הבועה קופצת מהמוצר (קפיץ קטן) עם חץ אליו; "Show me" סוגר את הלוח (במשחק: הולכים לשם).',
      render: (s, act) => <PremiumRemotesToday s={s} act={act} />,
    },
    {
      id: 'a',
      name: 'עלה זהב',
      note:
        'הפרימיום הוא הצהוב של המשחק שנהיה זהב: למעלה בהיר, שפה עמוקה, כתר בדיו ואור איטי שעובר עליו מדי פעם. בבועה – "Open the mill" כפתור זהב ברוחב הבועה, עם תמונת המכונה. ' +
        'בחנות – כרטיסי נייר עם מסגרת זהב. חלון שנפתח מרחוק לובש לשונית זהב על הפינה העליונה: "‹ Barn" (חזרה) ו־"Remote".',
      motion:
        'אור עובר על הכפתור כל כמה שניות (לא למי שמעדיף פחות תנועה). לחיצה על Open: הכפתור מבזיק וגדל לרגע, הבועה נסגרת והחלון עולה; הלשונית קופצת על הפינה אחריו. "‹ Barn": החלון יוצא בדרך שלו, והאסם חוזר.',
      adds: ADDS,
      render: (s, act) => <PremiumRemotesA s={s} act={act} />,
    },
  ],
}
