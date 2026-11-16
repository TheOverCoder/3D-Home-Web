import type { Board } from '../../board'
import { ScarecrowView } from './ScarecrowView'

// Scarecrows for the beds (3D, the 3D designer's): something new the farm lacks, in the place they would stand — at the
// far end of the west beds by the fence, facing the garden door, the first thing seen down the path on the way out of
// the house. "Today" is the place as it is, without them; A, B and C are sets of three matching scarecrows in three
// styles farmers really made, made with the kit in ./models/scarecrows.ts. Its states: in the game (at the player's
// eye on the path) and close (turning round the three under a finger).

export interface ScarecrowState {
  view: 'game' | 'close'
}

export const scarecrowBoard: Board<ScarecrowState> = {
  id: 'scarecrow',
  title: 'דחלילים בערוגות',
  kind: '3d',
  added: '2026-11-16T09:00',
  ask:
    'צריך עוד סוכן לעיצוב תלת־ממד: שיפורים שמביאים אלמנטים בתלת־ממד שמתאימים למשחק, או שיפורי תלת־ממד לאישור. תעשה את הסוכן ותן לו לבנות גם הצעות. · ' +
    'סיבוב 2: "לייצר לכל וריאציה 3 סוגי דחלילים תואמים, סך הכל 9, לפי דחלילים שבאמת היו טרנד פעם במציאות. תבנה אותם."',
  status: 'choose',
  round:
    'סיבוב 2, לפי ההערה שלך: כל וריאציה היא עכשיו שלושה דחלילים תואמים, 9 בסך הכל, וכל סגנון הוא דחליל שחקלאים באמת עשו. ' +
    'A – החווה האמריקאית (שנות ה־30, ומסורת הדחליל ואשתו של המהגרים הגרמנים בפנסילבניה): האיכר, אשת האיכר והילד. ' +
    'B – השדות של אנגליה וסקוטלנד (ה־tattie bogle וה־hodmedod): ראשי לפת ומנגולד מגולפים ובגדים ישנים – האדון בצילינדר, החורש בחלוק, והבוגל עם הרעשן. ' +
    'C – שדה האורז ביפן (קקאשי): רגל אחת מבמבוק ופרצוף "הנוהנומוהג׳י" מצויר בדיו – האיכר בכובע קש וגלימת קש, אישה בקימונו, וילד בהאפי. ' +
    'כל דחליל 1,338–1,755 משולשים, מתחת למשקל של 1,800, ונקי בבדיקות של המודלים (חתיכות רופפות, חורים, ריחוף).',
  still: 'none',
  research: [
    {
      pattern: 'הקקאשי היפני המסורתי עומד על רגל אחת עם כובע קש בשדה האורז – לכן ב־C אין מכנסיים: מוט במבוק אחד, כובע קונוס רחב וגלימת קש.',
      from: 'Japonin – Japanese scarecrows (kakashi)',
      url: 'https://www.japonin.com/teachers-blog/412-japanese-scarecrows.html',
    },
    {
      pattern: 'את הפרצוף של הקקאשי מציירים ב"הנוהנומוהג׳י": האותיות へのへのもへじ הן גבות, עיניים, אף, פה ולחי – ציור של ילדים מתקופת אדו.',
      from: 'Henohenomoheji (ויקיפדיה)',
      url: 'https://en.wikipedia.org/wiki/Henohenomoheji',
    },
    {
      pattern: 'בבריטניה ממלאים שק בקש ושמים עליו לפת או דלעת עם פרצוף מגולף; וורזל גאמידג׳ החליף ראשים של לפת, מנגולד ולפת שוודית. מכאן ראשי השורש המגולפים של B.',
      from: 'Worzel Gummidge ודחלילים בריטיים',
      url: 'https://en.wikipedia.org/wiki/Worzel_Gummidge',
    },
    {
      pattern: 'הדחליל הבריטי לובש בגדים ישנים של אחרים: כובע צילינדר או מגבעת באולר, מעיל, וחלוק העבודה של החורש הכפרי.',
      from: 'The smock frock – the English rural smock',
      url: 'https://www.smockfrock.co.uk/tag/katty-king/',
    },
    {
      pattern: 'בתמונות החוות האמריקאיות של שנות ה־30 הדחליל עשוי מבגדי עבודה ישנים, עם קש שיוצא מהם, בכל השדות עד אחרי מלחמת העולם השנייה.',
      from: 'Popular Science – the history of scarecrows',
      url: 'https://www.popsci.com/environment/scarecrow-history/',
    },
    {
      pattern: 'המהגרים הגרמנים בפנסילבניה בנו את ה־Butzemann, ולפעמים גם "אישה" לדחליל – מכאן האיכר, אשתו והילד ב־A.',
      from: 'Grit – Reign of the scarecrow',
      url: 'https://www.grit.com/farm-and-garden/reign-of-the-scarecrow/',
    },
    {
      pattern: 'דמות צריכה להיקרא קודם בצללית ואחר כך בצבע: כל שלישייה כאן שונה בצללית (כובע רחב, צילינדר, קונוס; מכנסיים, שמלה, גלימה) ולא רק בצבעים.',
      from: 'Valve – Illustrative Rendering in Team Fortress 2',
      url: 'https://steamcdn-a.akamaihd.net/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2.pdf',
    },
  ],
  states: [
    { id: 'game', name: 'במשחק', data: { view: 'game' } },
    { id: 'close', name: 'מקרוב', data: { view: 'close' } },
  ],
  variants: [
    {
      id: 'today',
      name: 'היום',
      note: 'הערוגות היום, בלי דחלילים: בסוף השביל רק הגדר והשדה שמעבר לה.',
      render: (s) => <ScarecrowView v="today" s={s} />,
    },
    {
      id: 'a',
      name: 'החווה האמריקאית',
      note:
        'שלושה דחלילים עם ראש שק תפור: האיכר בכובע קש, חולצה אדומה ואוברול ג׳ינס עם טלאים (1,498 משולשים); אשת האיכר בשמלה כחולה, סינר ומצנפת אדומה, עם צמות מחוטי קש (1,612); והילד, נמוך יותר, בכובע מצחייה, מכנסי ג׳ינס מקופלים ומטפחת צוואר, ידיים למעלה (1,428). ' +
        'כל אחד מתחת למשקל של 1,800 משולשים; שלושתם יחד 4,538: פחות מ־2% מהתקציב של המצלמה (250,000).',
      adds: 'דחלילים חדשים לחווה: לקנות בחנות הקישוטים ולהציב ליד הערוגות.',
      render: (s) => <ScarecrowView v="a" s={s} />,
    },
    {
      id: 'b',
      name: 'השדות של אנגליה',
      note:
        'שלושה דחלילים בבגדים ישנים: האדון עם ראש לפת מגולף, כובע צילינדר מעוך, פראק שחור עם זנבות ואפוד אדום (1,352 משולשים); החורש עם ראש מנגולד, חלוק עבודה ארוך בצבע זית עם צווארון רחב, מטפחת אדומה וכובע לבד רחב (1,456); והבוגל הסקוטי עם ראש שק, מגבעת באולר, ז׳קט טוויד וצעיף ארוך שעף ברוח, יד מורמת עם רעשן להברחת ציפורים (1,755). ' +
        'כל אחד מתחת למשקל של 1,800; שלושתם יחד 4,563.',
      adds: 'דחלילים חדשים לחווה: לקנות בחנות הקישוטים ולהציב ליד הערוגות.',
      render: (s) => <ScarecrowView v="b" s={s} />,
    },
    {
      id: 'c',
      name: 'שדה האורז ביפן',
      note:
        'שלושה קקאשי על רגל אחת מבמבוק, עם פרצוף מבד ופנים מצוירים בדיו (へのへのもへじ): האיכר בכובע קונוס רחב וגלימת קש עם שרוולים כחולים (1,442 משולשים); אישה בקימונו אדום עם צווארון לבן, אובי זהב ומטפחת ראש כחולה (1,530); וילד במעיל האפי אדום עם שוליים לבנים וסרט ראש, ידיים למעלה (1,338). ' +
        'כל אחד מתחת למשקל של 1,800; שלושתם יחד 4,310.',
      adds: 'דחלילים חדשים לחווה: לקנות בחנות הקישוטים ולהציב ליד הערוגות.',
      render: (s) => <ScarecrowView v="c" s={s} />,
    },
  ],
}
