import type { Board } from '../../board'
import type { ToolStyle } from '../../../src/models/tools'
import { BUCKET } from '../../../src/film/bucket'
import { timeline } from '../../../src/film/format'
import { FilmMilkBucketA } from './FilmMilkBucketA'

// A film, not a panel: buying the milk bucket in the farm shop (plans/animal-tools.md §4: the cows' tool, by the
// pasture's gate post), as the film director made it (.claude/agents/film-director.md, lab/FILM.md). The film is data
// (src/film/bucket.ts, `bucketFilm(style)`: the bucket's stand in the style the player chose, src/models/tools.ts)
// played on the game's own models (src/film/stage3d.ts and ./pen.ts: the pen of the farm's fence sections, Bella, Mazal
// and Daisy from the game's own herd, the contractor from the people engine, the tool's own pail kicked about), under
// the game's own overlay and end card (src/ui/Film.tsx). Not in the game yet: there it would be the `bucket` film, asked
// once by the bucket's card. Its states are moments to start from, two of them the build in the other two styles.

export interface FilmMilkBucketState {
  /** the second of the film it starts from */
  from: number
  /** the bucket's style (the skin the player chose); left out, a */
  style?: ToolStyle
  /** the player's XP after buying the bucket (the end card's bar fills to it from the build's XP less); left out,
   *  level 13 near its end */
  xp?: number
}

const tl = timeline(BUCKET)
const at = (shot: number) => tl.shots[shot].start

export const filmMilkBucketBoard: Board<FilmMilkBucketState> = {
  id: 'film-milk-bucket',
  title: 'סרט: דלי החלב',
  kind: 'film',
  added: '2026-11-17T18:30',
  ask: 'בקניית כלי: סרטון קצר שבו מביאים ובונים אותו. שלושה סרטונים, אחד לכל חיה – לכל חיה סרט משלה עם סיפור משלו.',
  status: 'choose',
  round:
    'לפי ההערה ("לשפר בעיות: הגדר נעלמת וחוזרת, הארגז לא מוחזק, אין סיפור – שיהיה קולנועי, מצחיק, ארוך יותר"): (1) סיפור חדש של 35 שניות ב־16 שוטים: חוק השלוש בתמונה ולא במילים – דלי מס׳ 1 עף, דלי מס׳ 2 עף אל מחוץ לדיר (שומעים רק את הנפילה הרחוקה), ודלי מס׳ 3 נוחת לך על הראש. ' +
    '(2) הקבלן מחזיק את הארגז בשתי ידיים בצדדים, מתכופף ומניח, והולך. (3) הגדר כבר לא נעלמת וחוזרת: החליבה מצולמת מתוך הדיר והדוכן מצולם מלפני הגדר, ומה שהמצלמה משאירה בחוץ נקבע פעם אחת לכל שוט. ' +
    '(4) הדוכן הוא הדגם שבחרת (סגנון א׳, ב׳ ו־ג׳ במצבים); הדלי שבועטים בו הוא הדלי של הדגם. (5) דייזי בועטת באמת – רואים את הרגל האחורית נזרקת, ובסוף היא בועטת באוויר מאחורי הגדר ולא מגיעה.',
  still: 'yard',
  screen: 'shop',
  research: [
    {
      pattern: 'חוק השלוש: פעמיים קובעות תבנית, השלישית שוברת אותה. דלי אחד עף, דלי שני עף רחוק יותר, והשלישי – על הראש שלך.',
      from: 'No Film School – The rule of three',
      url: 'https://nofilmschool.com/rule-of-the-three',
    },
    {
      pattern: 'הבדיחה מחוץ לפריים: הדלי השני עף מהתמונה, ואנחנו נשארים על הפנים הקפואות שלך – שנייה של שקט, ואז רחוק רחוק "קלאנק" ו"מוו" נעלב. הצליל עושה את הבדיחה.',
      from: 'PremiumBeat – 8 comedy techniques Edgar Wright does right',
      url: 'https://www.premiumbeat.com/blog/8-comedy-techniques-edgar-wright-does-right',
    },
    {
      pattern: 'הצחוק בתגובה: אחרי שהדלי נוחת על הראש – שוט אחד, בינוני, עליך עם הדלי על העיניים וכוכבים מסביב. רק תגובה אחת לכל בדיחה.',
      from: 'PremiumBeat – Directing and editing a comedy short',
      url: 'https://www.premiumbeat.com/blog/directing-editing-comedy-short/',
    },
    {
      pattern: 'המבט למצלמה: גרומיט מסתכל ישר אלינו כדי לשתף אותנו בבדיחה. דייזי עושה את זה פעמיים – אחרי הבעיטה הראשונה (תמימה), ואחרי הבעיטה באוויר (מובסת).',
      from: 'ACMI – Wallace & Gromit: Aardman’s odd couple',
      url: 'https://www.acmi.net.au/stories-and-ideas/wallace-gromit-humour-comedy-style/',
    },
    {
      pattern: 'שקט לפני הדרופ: בתום הבנייה המוזיקה נקטעת, דייזי מתקרבת לגדר, תקתוק, תקתוק – בעיטה באוויר – ואז הביט, והפרות באות לבד אל הדוכן.',
      from: 'PC Gamer – רגע החשיפה (עלייה, שקט, מכה)',
      url: 'https://www.pcgamer.com/behind-the-addictive-psychology-and-seductive-art-of-loot-boxes/',
    },
  ],
  states: [
    { id: 'whole', name: 'מההתחלה', data: { from: 0 } },
    { id: 'kicks', name: 'שלושת הדליים', data: { from: at(1) } },
    { id: 'build', name: 'הארגז והדוכן', data: { from: at(8) } },
    { id: 'button', name: 'הבעיטה באוויר והסוף', data: { from: at(11) } },
    { id: 'end', name: 'החלון בסוף', data: { from: tl.length } },
    { id: 'style-b', name: 'הבנייה · סגנון ב׳', data: { from: at(8), style: 'b' } },
    { id: 'style-c', name: 'הבנייה · סגנון ג׳', data: { from: at(8), style: 'c' } },
  ],
  variants: [
    {
      id: 'a',
      name: 'מחוץ להישג',
      note: `סרט של ${Math.round(tl.length)} שניות ב־${tl.shots.length} שוטים, בתלת־ממד של המשחק: הדוכן שבחרת (סגנון א׳, או ב׳/ג׳ לפי הסקין), בלה, מזל ודייזי מהעדר של המשחק, הקבלן, ואת/ה בבגדים שלך. שתי שורות: של הקבלן ושלך. 🔊 עם קול: לחצו על Sound.`,
      motion:
        'ערב, אור זהוב. קפשן "Pail No. 1" – את/ה כורע/ת וחולב/ת את דייזי, מוזיקת מעלית רגועה, צליל החליבה של המשחק. שוט נמוך: הדלי מתחת לעטינים; דייזי מרימה ראש; תקתוק, תקתוק. ' +
        'בעיטה – הרגל האחורית נזרקת, הדלי עף בקשת ונוחת בשלולית חלב, המוזיקה נקטעת. דייזי מסתובבת ומסתכלת ישר למצלמה. ' +
        '"Pail No. 2" – שוב חליבה, שוב בעיטה, והדלי עף אל מחוץ לדיר. שוט קרוב עליך, קפוא; שנייה של שקט; רחוק – "קלאנק" ו"מוו". ' +
        '"Pail No. 3" – את/ה מסתכל/ת עליה בחשד… כלום… חולב/ת – בעיטה, והדלי נוחת לך על הראש: "בונק", שריקה יורדת, כוכבים. ' +
        'הקבלן נכנס עם ארגז כבד בשתי ידיים, ואת/ה יוצא/ת מהשער עם הדלי על הראש: "Hang it up? She’ll kick that too." ("לתלות אותו? היא תבעט גם בזה"). מניח, הולך. את/ה זורק/ת את הדלי מהראש; הארגז נפתח והדוכן עולה ממנו חלק אחרי חלק. ' +
        'דייזי ניגשת לגדר מאחורי הדוכן, מסתובבת עם הגב אליו… תקתוק… ובועטת באוויר. היא מסתובבת אלינו. הביט: הפרות באות לגדר והדלי בדוכן מתמלא. ' +
        'הכפתור: את/ה, מצולם/ת מלמטה, בלי להסתכל עליה: "Kick it now, Daisy." – שקט – "מוווו" מובס וטרומבון עצוב. ' +
        'החלון: הדלי, "+5 XP", "Yours now": דלי החלב וחלב ליד העמוד; "Next": "3 a cow → 4", "1 a tap → 2".',
      adds: 'סרט שנפתח כשקונים את דלי החלב בחנות (אין עדיין כלים לחיות במשחק).',
      render: (s, act) => <FilmMilkBucketA s={s} onClose={act.close} />,
    },
  ],
}
