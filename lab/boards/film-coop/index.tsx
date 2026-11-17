import type { Board } from '../../board'
import type { ToolStyle } from '../../../src/models/tools'
import { COOP } from '../../../src/film/coop'
import { timeline } from '../../../src/film/format'
import { FilmCoopA } from './FilmCoopA'

// A film, not a panel: buying the coop in the farm shop (plans/animal-tools.md §4: the hens' tool, a nest for every
// hen), as the film director made it (.claude/agents/film-director.md, lab/FILM.md). The film is data
// (src/film/coop.ts, `coopFilm(style)`: the coop in the style the player chose, src/models/tools.ts) played on the
// game's own models (src/film/stage3d.ts and ./pen.ts: the pen of the farm's fence sections, the hens and the rooster
// from the game's own crowd, the contractor from the people engine, the hens' old nest box as the farm has it), under
// the game's own overlay and end card (src/ui/Film.tsx). Not in the game yet: there it would be the `coop` film, asked
// once by the coop's card. Its states are moments to start from, two of them the build in the other two styles.

export interface FilmCoopState {
  /** the second of the film it starts from */
  from: number
  /** the coop's style (the skin the player chose); left out, a */
  style?: ToolStyle
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
  added: '2026-11-17T18:30',
  ask: 'בקניית כלי: סרטון קצר שבו מביאים ובונים אותו. שלושה סרטונים, אחד לכל חיה – לכל חיה סרט משלה עם סיפור משלו.',
  status: 'choose',
  round:
    'לפי ההערה ("יותר עלילה סוחפת מצחיקה ומעניינת, קולנועיות"): (1) סיפור חדש וארוך יותר – 32 שניות ב־13 שוטים – עם חוק השלוש: מריבה על תיבת הקינון הישנה, הקבלן מהמר "הן ירצו את אותו קן", והן באמת רצות כולן לקן הראשון ("Told you.") – ובפעם השלישית נקישת האצבעות שלך שוברת את התבנית: שש תרנגולות קופצות לשישה קנים, אחת אחרי השנייה. ' +
    '(2) הקבלן מחזיק את הארגז בשתי הידיים, בצדדים, נשען אחורה מהמשקל, מתכופף ומניח אותו עם חבטה וענן אבק. (3) הגדר כבר לא נעלמת וחוזרת: הפעולה קורית לפני הגדר, ומה שהמצלמה משאירה בחוץ נקבע פעם אחת לכל שוט. ' +
    '(4) הלול הוא הדגם שבחרת (סגנון א׳; הסגנון הוא פרמטר של הסרט – שני מצבים מראים את הבנייה בסגנונות ב׳ ו־ג׳). (5) המנוע שודרג: אף אחד לא עובר דרך גדר, כלי או אדם; אור לכל שוט; נוצות, אבק וניצוצות בעולם; איריס מצויר בסוף.',
  still: 'yard',
  screen: 'shop',
  research: [
    {
      pattern:
        'ב"מרד התרנגולות" הפתיחה היא מונטאז׳ של ניסיונות שנכשלים שוב ושוב – הבדיחה בחזרה. אצלנו: מריבה על התיבה הישנה, ואז שוב בדיוק אותה מריבה על הקן הראשון של הלול החדש (הקבלן צדק!), ובפעם השלישית נקישה אחת שוברת את התבנית.',
      from: 'Nepali Times – Fowl play on screen (Chicken Run)',
      url: 'https://nepalitimes.com/fowl-play-on-screen',
    },
    {
      pattern: 'סוף מצויר: האיריס נסגר על הגיבור ונעצר קטן סביבו לבדיחה אחרונה – אצלנו התרנגול, שלא עשה כלום, קורא קוקוריקו בתוך העיגול – ורק אז נסגר. שימוש קומי ידוע מהסרטים המצוירים הישנים.',
      from: 'Iris shot (Wikipedia) · TV Tropes – Iris Out',
      url: 'https://en.wikipedia.org/wiki/Iris_shot',
    },
    {
      pattern: 'סרט בלי מילים לחיות: ב"שון כבשון" החליטו מההתחלה שאין דיבור, ובדיחה שצריכה מילים – מוותרים עליה. התרנגולות רק מקרקרות; מילים יש רק לקבלן (שתיים: ההימור ו"Told you.").',
      from: 'Below the Line – Burton ו־Starzak על דיאלוג בלי מילים בשון כבשון',
      url: 'https://www.btlnews.com/awards/directors-mark-burton-and-richard-starzak-excel-in-non-verbal-dialog-in-shaun-the-sheep/',
    },
    {
      pattern: 'הזווית היא הכוח: כשהקבלן צודק ("Told you.") מצלמים אותו מלמטה, וכשהתרנגולות קופצות לקנים – מלמעלה, מגרד בראש.',
      from: 'StudioBinder – Low angle shot',
      url: 'https://www.studiobinder.com/blog/low-angle-shot/',
    },
    {
      pattern: 'השמש בחוץ מוצבת לכל שוט מחדש, כמו שצלמים עושים: בשוט רחב מעל הכתף של המצלמה (שרואים את המקום), בשוט קרוב מאחורי הדמויות (קו אור סביבן) – ואור מפתח על הפנים.',
      from: 'American Cinematographer (ASC) – Follow the Sun',
      url: 'https://theasc.com/blog/shot-craft/follow-the-sun',
    },
  ],
  states: [
    { id: 'whole', name: 'מההתחלה', data: { from: 0 } },
    { id: 'build', name: 'הארגז והלול', data: { from: at(3) } },
    { id: 'turn', name: 'Told you – והנקישה', data: { from: at(8) } },
    { id: 'button', name: 'הסוף: התרנגול', data: { from: at(12) } },
    { id: 'end', name: 'החלון בסוף', data: { from: tl.length } },
    { id: 'style-b', name: 'הבנייה · סגנון ב׳', data: { from: at(3), style: 'b' } },
    { id: 'style-c', name: 'הבנייה · סגנון ג׳', data: { from: at(3), style: 'c' } },
  ],
  variants: [
    {
      id: 'a',
      name: 'קן לכל אחת',
      note: `סרט של ${Math.round(tl.length)} שניות ב־${tl.shots.length} שוטים, בתלת־ממד של המשחק: הלול שבחרת (סגנון א׳, או ב׳/ג׳ לפי הסקין), שש תרנגולות ותרנגול מהמודלים של המשחק, תיבת הקינון הישנה כמו בחווה, הקבלן, ואת/ה בבגדים שלך. שתי שורות, של הקבלן; התרנגולות רק מקרקרות. 🔊 עם קול: לחצו על Sound.`,
      motion:
        'בוקר. קפשן "6 hens. 1 nest." – שבע ציפורים נדחקות סביב תיבת קינון אחת ונוצות עפות; את/ה מחכה לביצה, ידיים על המותניים; התרנגול יושב על עמוד השער. ' +
        'תרנגולת אחת קופצת פנימה ודוחפת את השנייה החוצה. את/ה מושיט/ה יד לביצה – ומקבל/ת ניקור (כוכבים, "בונק"). ' +
        'הקבלן נכנס עם ארגז כבד בשתי ידיים: "Six nests? They’ll want the same one." ("שישה קנים? הן ירצו את אותו אחד"). מתכופף, מניח – חבטה ואבק. הארגז נפתח והלול עולה ממנו חלק אחרי חלק, קליק וניצוץ לכל חלק. ' +
        'שקט. שש תרנגולות מרימות ראש אל שישה קנים… ורצות כולן לאותו קן. הקבלן, מלמטה: "Told you." ' +
        'את/ה, בשקט: נקישת אצבעות. הביט נוחת: שש תרנגולות קופצות לשישה קנים, אחת אחרי השנייה, והביצים מופיעות בזוגות. הקבלן, מלמעלה, מגרד בראש. ' +
        'הכפתור: התרנגול, שישב על העמוד כל הזמן, יורד בהילוך איטי מצולם מהרצפה כמו גיבור; האיריס נסגר עליו, נעצר – קוקוריקו. ' +
        'החלון: הלול, "+5 XP" בפס הרמה, "Yours now": הלול ו־6 קנים; "Next": "3 a nest → 4", "1 a tap → 2".',
      adds: 'סרט שנפתח כשקונים את הלול בחנות (אין עדיין כלים לחיות במשחק).',
      render: (s, act) => <FilmCoopA s={s} onClose={act.close} />,
    },
  ],
}
