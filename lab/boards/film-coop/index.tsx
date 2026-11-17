import type { Board } from '../../board'
import { COOP } from '../../../src/film/coop'
import { timeline } from '../../../src/film/format'
import { FilmCoopA } from './FilmCoopA'

// A film, not a panel: buying the coop in the farm shop (plans/animal-tools.md §4: the hens' tool, a nest for every
// hen), as the film director made it (.claude/agents/film-director.md, lab/FILM.md). The film is data
// (src/film/coop.ts) played on the game's own models (src/film/stage3d.ts and ./pen.ts: the pen of the farm's fence
// sections, the hens and the rooster from the game's own crowd, the contractor from the people engine; the coop a
// stand-in of plain shapes until the 3D designer's is chosen on `tools-3d`), under the game's own overlay and end card
// (src/ui/Film.tsx). Not in the game yet: there it would be the `coop` film, asked once by the coop's card. Its states
// are moments to start from.

export interface FilmCoopState {
  /** the second of the film it starts from */
  from: number
  /** the player's XP after buying the coop (the end card's bar fills to it from the build's XP less); left out, level
   *  13 near its end */
  xp?: number
}

const tl = timeline(COOP)
const at = (shot: number) => tl.shots[shot].start

export const filmCoopBoard: Board<FilmCoopState> = {
  id: 'film-coop',
  title: 'סרט: הלול',
  kind: 'film',
  added: '2026-11-17T06:18',
  ask: 'בקניית כלי: סרטון קצר שבו מביאים ובונים אותו. שלושה סרטונים, אחד לכל חיה – לכל חיה סרט משלה עם סיפור משלו.',
  status: 'choose',
  still: 'yard',
  screen: 'shop',
  research: [
    {
      pattern:
        'סרט בלי מילים לחיות: ב"שון כבשון" החליטו מההתחלה שאין דיבור, ובדיחה שצריכה מילים – מוותרים עליה. אצלנו התרנגולות לא מדברות: רק קרקורים של המשחק, והבדיחה היא התמונה – שבע ציפורים סביב קן אחד.',
      from: 'Below the Line – Burton ו־Starzak על דיאלוג בלי מילים בשון כבשון',
      url: 'https://www.btlnews.com/awards/directors-mark-burton-and-richard-starzak-excel-in-non-verbal-dialog-in-shaun-the-sheep/',
    },
    {
      pattern: 'מתח לפני הפתעה: הקבלן נכנס עם ארגז סגור ומטיל ספק ("They’ll still fight") – אנחנו מחכים לראות מה בפנים. הארגז נוחת, נפתח, והקנים עולים אחד אחרי השני.',
      from: 'Hitchcock לטריפו – הפצצה מתחת לשולחן',
      url: 'https://nofilmschool.com/alfred-hitchcock-and-francois-truffaut-explain-surprise-vs-suspense',
    },
    {
      pattern: 'שקט לפני הדרופ: הקנים עולים עם "רייזר", חצי שנייה שקט, ואז הביט נוחת והתרנגולות מתפזרות כל אחת לקן שלה – בלי שום מריבה.',
      from: 'PC Gamer – עיצוב רגע החשיפה (עלייה, שקט, מכה)',
      url: 'https://www.pcgamer.com/behind-the-addictive-psychology-and-seductive-art-of-loot-boxes/',
    },
    {
      pattern: 'חוק השלוש: הביצים קופצות לקנים בשלוש "פופ" – שתיים, ארבע, שש.',
      from: 'No Film School – The rule of three',
      url: 'https://nofilmschool.com/rule-of-the-three',
    },
    {
      pattern: 'הכפתור: הליכת הגיבור בהילוך איטי מהרצפה – כמו שהחקלאי יוצא מהסופר בסרט הקודם – אבל הפעם זה התרנגול, שלא עשה כלום, ולוקח את כל הקרדיט בקריאת "קוקוריקו".',
      from: 'Reservoir Dogs – ההליכה בפתיחה (פרודיה עליה)',
      url: 'https://nofilmschool.com/reservoir-dogs-slow-mo-walk-defined-cool',
    },
    {
      pattern: 'בניין בונים "מחוץ למסך": בסטארדיו ואלי רובין בונה את הלול בלי שרואים, ולמחרת הוא שם. אצלנו כל הבנייה היא שוט אחד של שנייה וחצי – החלקים עולים במקומם.',
      from: 'Stardew Valley Wiki – Coop',
      url: 'https://stardewvalleywiki.com/Coop',
    },
  ],
  states: [
    { id: 'whole', name: 'מההתחלה', data: { from: 0 } },
    { id: 'build', name: 'הארגז והקנים', data: { from: at(3) } },
    { id: 'button', name: 'הסוף: התרנגול', data: { from: at(6) } },
    { id: 'end', name: 'החלון בסוף', data: { from: tl.length } },
  ],
  variants: [
    {
      id: 'a',
      name: 'קן לכל אחת',
      note: `סרט של ${Math.round(tl.length)} שניות ב־${tl.shots.length} שוטים, בתלת־ממד של המשחק: דיר ממקטעי הגדר הלבנה של החווה, שש תרנגולות ותרנגול מהמודלים של המשחק, הקבלן, ואת/ה בבגדים שלך. הלול כאן ממלא מקום עשוי צורות פשוטות (שישה קנים אדומים בשורה) – הדגם האמיתי ייכנס מהלוח של המעצב/ת (tools-3d), והסרט לא משתנה. שורה אחת בלבד, של הקבלן; התרנגולות רק מקרקרות. 🔊 עם קול: לחצו על Sound.`,
      motion:
        'בוקר. קפשן: "6 hens. 1 nest." – שש תרנגולות ותרנגול נדחקים סביב קן אחד ליד השער, מקרקרים, ואת/ה מחוץ לגדר, כתפיים שמוטות, מחכה לביצים. מוזיקת מתח. ' +
        'הקבלן נכנס עם ארגז עץ סגור בידיים: "Six nests? They’ll still fight." ("שישה קנים? הן עדיין יריבו"). ' +
        'הארגז נוחת (חבטה, רעידה), הדפנות נופלות, וחמשת הקנים הנוספים עולים מהאדמה אחד אחרי השני עם קליקים, והגג מעליהם. רייזר, חצי שנייה שקט – ' +
        'והביט נוחת: הבזק, והתרנגולות מתפזרות בשקט, כל אחת לקן שלה. ביצים קופצות לקנים: שתיים, ארבע, שש. ' +
        'הכפתור: התרנגול, שלא עשה כלום, צועד לבד בהילוך איטי מצולם מהרצפה כמו גיבור, נעצר, שקט – וקוקוריקו. ' +
        'החלון: הלול, "+5 XP" בפס הרמה, "Yours now": הלול ו־6 קנים; "Next": "3 a nest → 4", "1 a tap → 2".',
      adds: 'סרט שנפתח כשקונים את הלול בחנות (אין עדיין כלים לחיות במשחק).',
      render: (s, act) => <FilmCoopA s={s} onClose={act.close} />,
    },
  ],
}
