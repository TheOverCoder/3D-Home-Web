import type { Board } from '../../board'
import type { ToolStyle } from '../../../src/models/tools'
import { timeline } from '../../../src/film/format'
import { SHEARS } from '../../../src/film/shears'
import { FilmShearsA } from './FilmShearsA'

// A film, not a panel: buying the shears in the farm shop (plans/animal-tools.md §4: the sheep's tool, shears and a
// wool basket by the fold's gate post), as the film director made it (.claude/agents/film-director.md, lab/FILM.md).
// The film is data (src/film/shears.ts, `shearsFilm(style)`: the shearing stand in the style the player chose,
// src/models/tools.ts) played on the game's own models (src/film/stage3d.ts and ./pen.ts: the pen of the farm's fence
// sections, Dolly, Pnina, Lulu and Tzipi from the game's own flock, the contractor from the people engine, the tool's
// own shears in your hand), under the game's own overlay and end card (src/ui/Film.tsx). Not in the game yet: there it
// would be the `shears` film, asked once by the shears' card. Its states are moments to start from, two of them the
// build in the other two styles.

export interface FilmShearsState {
  /** the second of the film it starts from */
  from: number
  /** the shears' style (the skin the player chose); left out, a */
  style?: ToolStyle
  /** the player's XP after buying the shears (the end card's bar fills to it from the build's XP less); left out,
   *  level 13 near its end */
  xp?: number
}

const tl = timeline(SHEARS)
const at = (shot: number) => tl.shots[shot].start

export const filmShearsBoard: Board<FilmShearsState> = {
  id: 'film-shears',
  title: 'סרט: המספריים',
  kind: 'film',
  added: '2026-11-17T18:30',
  ask: 'בקניית כלי: סרטון קצר שבו מביאים ובונים אותו. שלושה סרטונים, אחד לכל חיה – לכל חיה סרט משלה עם סיפור משלו.',
  status: 'choose',
  round:
    'לפי ההערה ("לתקן איך שהוא מחזיק את הארגז, פעולות ותנועות לא מספיק ברורות, להוסיף קולנועיות וסיפור"): (1) סיפור חדש של 37 שניות ב־15 שוטים: התגנבות על קצות האצבעות (מוזיקת "התגנבות" של מיתרים פריטה), "סניפ־סניפ" באוויר, דולי מסתכלת למצלמה – ובורחת; מרדף שלם סביב הדיר שאת/ה מפסיד/ה, מתנשף/ת. ' +
    '(2) הקבלן מחזיק את הארגז בשתי ידיים בצדדים, נשען אחורה מהמשקל, מתכופף ומניח. (3) פעולות ברורות: ריצה אמיתית (צעדים ארוכים, ידיים, הטיה קדימה), התכופפות, ידיים על המותניים, גירוד בראש; הגזיזה – הצמר יורד מדולי בשלושה "סניפ" עם פתיתי צמר, והסל מתמלא. ' +
    '(4) הדוכן הוא הדגם שבחרת (סגנון א׳, ב׳ ו־ג׳ במצבים), והמספריים ביד הם המספריים של הדגם.',
  still: 'yard',
  screen: 'shop',
  research: [
    {
      pattern: 'מתח לפני הפתעה: יודעים מה עומד לקרות (ההתגנבות, המספריים למעלה) ומחכים – מוזיקת "התגנבות" של מיתרים פריטה על קצות האצבעות, שני "סניפ" באוויר, והראש של דולי עולה לאט.',
      from: 'Hitchcock לטריפו – הפצצה מתחת לשולחן',
      url: 'https://nofilmschool.com/alfred-hitchcock-and-francois-truffaut-explain-surprise-vs-suspense',
    },
    {
      pattern: 'המרדף מלמעלה: שוט רחב ויציב מעל הגדר, את/ה רץ/ה סביב הדיר והכבשה תמיד צעד לפנייך – פריים רחב ויבש הוא בדיחה בפני עצמו.',
      from: 'PremiumBeat – 8 comedy techniques Edgar Wright does right',
      url: 'https://www.premiumbeat.com/blog/8-comedy-techniques-edgar-wright-does-right',
    },
    {
      pattern: 'קישוטנקטסו – הטוויסט במקום הדרופ: אחרי הבנייה לא נוחת ביט אלא מוזיקת חדר המתנה, ודולי יוצאת מהשער ומתיישבת על "הכיסא" מול הדוכן; העדר עומד מאחוריה בתור.',
      from: 'Wikipedia – Kishōtenketsu',
      url: 'https://en.wikipedia.org/wiki/Kish%C5%8Dtenketsu',
    },
    {
      pattern: 'המבט למצלמה, פעמיים: דולי מרימה ראש כששומעת את ה"סניפ" (ובורחת), ודולי הגזוזה, רזה פתאום, מסתכלת ישר אלינו.',
      from: 'ACMI – Wallace & Gromit: Aardman’s odd couple',
      url: 'https://www.acmi.net.au/stories-and-ideas/wallace-gromit-humour-comedy-style/',
    },
    {
      pattern: 'בלי מילים לכבשים: בשון כבשון בדיחה שצריכה מילים – מוותרים עליה. מילים יש רק לקבלן ("Sheep run. Every time.") ולך – הצחוק האחרון, "Next!".',
      from: 'Below the Line – Burton ו־Starzak על דיאלוג בלי מילים',
      url: 'https://www.btlnews.com/awards/directors-mark-burton-and-richard-starzak-excel-in-non-verbal-dialog-in-shaun-the-sheep/',
    },
  ],
  states: [
    { id: 'whole', name: 'מההתחלה', data: { from: 0 } },
    { id: 'chase', name: 'הבריחה והמרדף', data: { from: at(2) } },
    { id: 'build', name: 'הארגז והדוכן', data: { from: at(6) } },
    { id: 'haircut', name: 'התור והגזיזה', data: { from: at(9) } },
    { id: 'end', name: 'החלון בסוף', data: { from: tl.length } },
    { id: 'style-b', name: 'הבנייה · סגנון ב׳', data: { from: at(6), style: 'b' } },
    { id: 'style-c', name: 'הבנייה · סגנון ג׳', data: { from: at(6), style: 'c' } },
  ],
  variants: [
    {
      id: 'a',
      name: 'הבא בתור',
      note: `סרט של ${Math.round(tl.length)} שניות ב־${tl.shots.length} שוטים, בתלת־ממד של המשחק: הדוכן שבחרת (סגנון א׳, או ב׳/ג׳ לפי הסקין), דולי, פנינה, לולו וציפי מהעדר של המשחק, הקבלן, ואת/ה בבגדים שלך. שתי שורות: של הקבלן ושלך. 🔊 עם קול: לחצו על Sound.`,
      motion:
        'צהריים. מוזיקת התגנבות: את/ה מתגנב/ת על ברכיים כפופות אל דולי שרועה, המספריים למעלה. שוט קרוב: "סניפ… סניפ" באוויר. ' +
        'דולי מרימה ראש ומסתכלת ישר אלינו; המוזיקה נעצרת. היא בורחת (אבק ופתיתי צמר), העדר מתפזר, ואת/ה רץ/ה אחריה. ' +
        'מלמעלה, מעל הגדר: מרדף סביב הדיר – היא תמיד צעד לפנייך. את/ה נעצר/ת מתנשף/ת, כפוף/ה; היא רועה כאילו כלום. ' +
        'הקבלן נכנס עם ארגז כבד בשתי ידיים: "Sheep run. Every time." ("כבשים בורחות. תמיד"). מתכופף, מניח – חבטה ואבק. הארגז נפתח והדוכן עולה ממנו חלק אחרי חלק, והמספריים נוצצים. ' +
        'לא ביט – מוזיקת חדר המתנה. דולי יוצאת מהשער ומתיישבת על "הכיסא" מול הדוכן, ושלוש הכבשות האחרות עומדות מאחוריה בתור. הקבלן מגרד בראש; את/ה מושך/ת בכתפיים. ' +
        'הגזיזה: שלושה "סניפ", הצמר יורד מדולי בשלושה שלבים, והסל מתמלא. דולי, גזוזה ורזה, מסתכלת ישר אלינו. ' +
        'הכפתור: את/ה, מצולם/ת מלמטה, מצביע/ה: "Next!" – ופנינה צועדת לכיסא. ' +
        'החלון: המספריים, "+5 XP", "Yours now": המספריים וסל הצמר; "Next": "3 a sheep → 4", "1 a tap → 2".',
      adds: 'סרט שנפתח כשקונים את המספריים בחנות (אין עדיין כלים לחיות במשחק).',
      render: (s, act) => <FilmShearsA s={s} onClose={act.close} />,
    },
  ],
}
