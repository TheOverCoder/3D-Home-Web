import type { Board } from '../../board'
import { timeline } from '../../../src/film/format'
import { SHEARS } from '../../../src/film/shears'
import { FilmShearsA } from './FilmShearsA'

// A film, not a panel: buying the shears in the farm shop (plans/animal-tools.md §4: the sheep's tool, shears and a
// wool basket by the gate post), as the film director made it (.claude/agents/film-director.md, lab/FILM.md). The film
// is data (src/film/shears.ts) played on the game's own models (src/film/stage3d.ts and ./pen.ts: the pen of the farm's
// fence sections, Dolly, Pnina, Lulu and Tzipi from the game's own flock, the contractor from the people engine; the
// shears and basket a stand-in of plain shapes until the 3D designer's is chosen on `tools-3d`), under the game's own
// overlay and end card (src/ui/Film.tsx). Not in the game yet: there it would be the `shears` film, asked once by the
// shears' card. Its states are moments to start from.

export interface FilmShearsState {
  /** the second of the film it starts from */
  from: number
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
  added: '2026-11-17T06:18',
  ask: 'בקניית כלי: סרטון קצר שבו מביאים ובונים אותו. שלושה סרטונים, אחד לכל חיה – לכל חיה סרט משלה עם סיפור משלו.',
  status: 'choose',
  still: 'yard',
  screen: 'shop',
  research: [
    {
      pattern:
        'הגזיזה ב"שון כבשון" וב"גילוח צמוד" של וואלאס וגרומיט: העדר בורח מהמספריים של החקלאי – בדיחה שלא צריכה מילה. אצלנו: "סניפ־סניפ" (הצליל של הגזיזה במשחק), דולי מרימה ראש – והעדר מתפזר לפינות.',
      from: 'British Comedy Guide – Shaun the Sheep, The Kite',
      url: 'https://comedy.co.uk/tv/shaun_the_sheep/episodes/1/23',
    },
    {
      pattern: 'המבט למצלמה: כשדולי שומעת את המספריים היא לא בורחת מיד – היא מרימה את הראש ומסתכלת ישר אלינו. רגע מוחזק, ורק אז הבריחה.',
      from: 'ACMI – Wallace & Gromit: Aardman’s odd couple',
      url: 'https://www.acmi.net.au/stories-and-ideas/wallace-gromit-humour-comedy-style/',
    },
    {
      pattern: 'הניגוד בין שני סגנונות מוזיקה הוא בדיחה בפני עצמו: המרדף על מוזיקת מתח, ואחרי השקט – לא ביט, אלא המוזק של חנות (כמו רדיו במספרה). הכבשים עומדות בתור כמו לקוחות.',
      from: 'lab/FILM.md – Music names the world, then turns with the story',
    },
    {
      pattern: 'מתח לפני הפתעה: הקבלן נכנס עם ארגז סגור ואומר מה כולם יודעים ("Sheep run. Every time."); הארגז נפתח, והסל והמספריים עולים ליד עמוד השער.',
      from: 'Hitchcock לטריפו – הפצצה מתחת לשולחן',
      url: 'https://nofilmschool.com/alfred-hitchcock-and-francois-truffaut-explain-surprise-vs-suspense',
    },
    {
      pattern: 'השחקן הוא השקט, ומצולם מלמטה כשהכוח עובר אליו: מעבר לכתף של דולי, ממש מגובה של כבשה – השורה היחידה שלך, הקריאה של ספר: "Next!".',
      from: 'StudioBinder – Low angle shot',
      url: 'https://www.studiobinder.com/blog/low-angle-shot/',
    },
  ],
  states: [
    { id: 'whole', name: 'מההתחלה', data: { from: 0 } },
    { id: 'scatter', name: 'סניפ, והבריחה', data: { from: at(1) } },
    { id: 'build', name: 'הארגז והסל', data: { from: at(4) } },
    { id: 'button', name: 'הסוף: Next!', data: { from: at(5) } },
    { id: 'end', name: 'החלון בסוף', data: { from: tl.length } },
  ],
  variants: [
    {
      id: 'a',
      name: 'הבא בתור',
      note: `סרט של ${Math.round(tl.length)} שניות ב־${tl.shots.length} שוטים, בתלת־ממד של המשחק: דיר ממקטעי הגדר הלבנה של החווה, דולי, פנינה, לולו וציפי מהעדר של המשחק, הקבלן, ואת/ה בבגדים שלך. המספריים והסל כאן ממלאי מקום עשויים צורות פשוטות (סל נצרים ומספריים על עמוד השער) – הדגם האמיתי ייכנס מהלוח של המעצב/ת (tools-3d), והסרט לא משתנה. שתי שורות: של הקבלן ושלך. 🔊 עם קול: לחצו על Sound.`,
      motion:
        'צהריים. דולי לועסת דשא, ואת/ה מתגנב/ת מאחוריה, היד למעלה: "סניפ, סניפ" (הצליל של הגזיזה במשחק). מוזיקת מתח. ' +
        'דולי מרימה את הראש ומסתכלת ישר אלינו. רגע. ' +
        'שוט רחב מלמעלה: שריטת תקליט, המוזיקה נקטעת, וכל ארבע הכבשים בורחות לארבע פינות הדיר. את/ה נשאר/ת לבד, מושך/ת בכתפיים. ' +
        'הקבלן נכנס עם ארגז סגור: "Sheep run. Every time." ("כבשים בורחות. תמיד"). ' +
        'הארגז נוחת ונפתח, סל נצרים ומספריים עולים ליד עמוד השער. רייזר, חצי שנייה שקט – ' +
        'ובמקום ביט: מוזיקת המעלית של החנות, והכבשים יוצאות מהשער אחת אחרי השנייה ונעמדות בתור לאורך הגדר, כמו במספרה. צמר ראשון בסל. ' +
        'הכפתור: מעבר לכתף של דולי, מגובה של כבשה, את/ה ליד הסל מצביע/ה: "Next!". ' +
        'החלון: המספריים, "+5 XP", "Yours now": מספריים וסל צמר; "Next": "3 a sheep → 4", "1 a tap → 2".',
      adds: 'סרט שנפתח כשקונים את המספריים בחנות (אין עדיין כלים לחיות במשחק).',
      render: (s, act) => <FilmShearsA s={s} onClose={act.close} />,
    },
  ],
}
