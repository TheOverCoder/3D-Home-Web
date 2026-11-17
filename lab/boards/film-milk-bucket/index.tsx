import type { Board } from '../../board'
import { BUCKET } from '../../../src/film/bucket'
import { timeline } from '../../../src/film/format'
import { FilmMilkBucketA } from './FilmMilkBucketA'

// A film, not a panel: buying the milk bucket in the farm shop (plans/animal-tools.md §4: the cows' tool, a bucket on
// the gate post), as the film director made it (.claude/agents/film-director.md, lab/FILM.md). The film is data
// (src/film/bucket.ts) played on the game's own models (src/film/stage3d.ts and ./pen.ts: the pen of the farm's fence
// sections, Bella, Mazal and Daisy from the game's own herd, the contractor from the people engine; the bucket a
// stand-in of plain shapes until the 3D designer's is chosen on `tools-3d`), under the game's own overlay and end card
// (src/ui/Film.tsx). Not in the game yet: there it would be the `bucket` film, asked once by the bucket's card. Its
// states are moments to start from.

export interface FilmMilkBucketState {
  /** the second of the film it starts from */
  from: number
  /** the player's XP after buying the bucket (the end card's bar fills to it from the build's XP less); left out,
   *  level 13 near its end */
  xp?: number
}

const tl = timeline(BUCKET)

export const filmMilkBucketBoard: Board<FilmMilkBucketState> = {
  id: 'film-milk-bucket',
  title: 'סרט: דלי החלב',
  kind: 'film',
  added: '2026-11-17T06:18',
  ask: 'בקניית כלי: סרטון קצר שבו מביאים ובונים אותו. שלושה סרטונים, אחד לכל חיה – לכל חיה סרט משלה עם סיפור משלו.',
  status: 'choose',
  still: 'yard',
  screen: 'shop',
  research: [
    {
      pattern: 'המבט למצלמה: גרומיט (וגם אוליבר הארדי) מסתכל ישר אלינו כדי לשתף אותנו – בלי מילה. אצלנו דייזי בועטת בדלי, ואז מרימה את הראש ומסתכלת ישר למצלמה, תמימה. הצחוק בתגובה, בשוט אחד.',
      from: 'ACMI – Wallace & Gromit: Aardman’s odd couple',
      url: 'https://www.acmi.net.au/stories-and-ideas/wallace-gromit-humour-comedy-style/',
    },
    {
      pattern: 'בדיחה חוזרת צריכה שלוש פעמים, וכל פעם גדולה מהקודמת. אין זמן להראות שלוש בעיטות, אז הקבלן מספר את השתיים הקודמות במשפט אחד ("That’s three pails this week."), ורואים רק את השלישית.',
      from: 'Comedy for Animators – Running gags',
      url: 'https://comedyforanimators.com/2020/01/27/running-gags/',
    },
    {
      pattern: 'צליל בדיוק על החיתוך: שוט קרוב על הדלי והזנב שמתנופף, שני תקתוקים – חיתוך – "קלאנק", רעידה, והמוזיקה נקטעת. את הבעיטה עצמה לא רואים.',
      from: 'Edgar Wright – טכניקות קומדיה חזותית',
      url: 'https://www.premiumbeat.com/blog/8-comedy-techniques-edgar-wright-does-right',
    },
    {
      pattern: 'מתח לפני הפתעה, ושקט לפני הדרופ: הארגז נכנס סגור; הזרוע והדלי עולים על העמוד; חצי שנייה שקט; הביט, והפרות באות לבד.',
      from: 'Hitchcock לטריפו · PC Gamer על רגע החשיפה',
      url: 'https://nofilmschool.com/alfred-hitchcock-and-francois-truffaut-explain-surprise-vs-suspense',
    },
    {
      pattern: 'השחקן הוא השקט: שורה אחת בכל הסרט, הצחוק האחרון – אתגר לדייזי בשמה מהמשחק ("Kick it now, Daisy."), בלי להסתכל עליה. רגע שקט, ו"מוווו" מובס.',
      from: 'lab/FILM.md – The player is the quiet one',
    },
  ],
  states: [
    { id: 'whole', name: 'מההתחלה', data: { from: 0 } },
    { id: 'end', name: 'החלון בסוף', data: { from: tl.length } },
  ],
  variants: [
    {
      id: 'a',
      name: 'מחוץ להישג',
      note: `סרט של ${Math.round(tl.length)} שניות ב־${tl.shots.length} שוטים, בתלת־ממד של המשחק: דיר ממקטעי הגדר הלבנה של החווה, בלה, מזל ודייזי מהעדר של המשחק, הקבלן, ואת/ה בבגדים שלך. הדלי כאן ממלא מקום עשוי צורות פשוטות (דלי פח וזרוע ברזל על עמוד השער) – הדגם האמיתי ייכנס מהלוח של המעצב/ת (tools-3d), והסרט לא משתנה. שתי שורות: של הקבלן ושלך. 🔊 עם קול: לחצו על Sound.`,
      motion:
        'ערב, אור זהוב. קפשן: "Milking time." – את/ה חולב/ת את דייזי, הדלי על הרצפה ליד הרגליים האחוריות, צליל החליבה של המשחק. מוזיקת מתח. ' +
        'שוט קרוב ונמוך: הדלי, הרגליים, הזנב מתנופף, שני תקתוקים – חיתוך – "קלאנק", רעידה, הדלי שוכב על הצד בשלולית חלב, והמוזיקה נקטעת. ' +
        'דייזי מרימה את הראש ומסתכלת ישר אלינו, לועסת, "מוו". ' +
        'הקבלן נכנס עם ארגז סגור: "That’s three pails this week." ("זה הדלי השלישי השבוע"). ' +
        'הארגז נוחת ונפתח, זרוע ברזל ודלי חדש עולים על עמוד השער – גבוה. רייזר, חצי שנייה שקט – והביט: שלוש הפרות הולכות לבד אל העמוד, והדלי מתמלא: אחת, שתיים, שלוש. ' +
        'הכפתור: את/ה ליד העמוד, מצולם/ת מלמטה, לא מסתובב/ת: "Kick it now, Daisy." – רגע שקט – ו"מוווו" מובס. ' +
        'החלון: הדלי, "+5 XP", "Yours now": דלי החלב וחלב ליד העמוד; "Next": "3 a cow → 4", "1 a tap → 2".',
      adds: 'סרט שנפתח כשקונים את דלי החלב בחנות (אין עדיין כלים לחיות במשחק).',
      render: (s, act) => <FilmMilkBucketA s={s} onClose={act.close} />,
    },
  ],
}
