import type { Board } from '../../board'
import { timeline } from '../../../src/film/format'
import { SUPERMARKET } from '../../../src/film/supermarket'
import { FilmSupermarketA } from './FilmSupermarketA'

// A film, not a panel: buying the supermarket from the manager (src/farm/state.ts, buyMarket), as the film director
// made it (.claude/agents/film-director.md, lab/FILM.md). Chosen (A) and in the game now: the film is data
// (src/film/supermarket.ts) played on the game's own models (src/film/stage3d.ts: the market from its row, the manager
// and the contractor from the people engine, each line read aloud in words in its speaker's voice by src/film/speak.ts),
// under the game's own overlay and end card (src/ui/Film.tsx) — the game plays it on its canvas once the shop is bought
// from its card (src/film/films.ts, src/film/StoryFilm.tsx), the lab in a view of its own (lab/films/Player.tsx). Its
// states are moments to start from, and the end card with and without a level reached.

export interface FilmSupermarketState {
  /** the second of the film it starts from */
  from: number
  /** the player's XP after buying the shop (the end card's bar fills to it from 25 less); left out, level 13 near its end */
  xp?: number
}

const at = (shot: number) => timeline(SUPERMARKET).shots[shot].start

export const filmSupermarketBoard: Board<FilmSupermarketState> = {
  id: 'film-supermarket',
  title: 'סרט: קונים את הסופר',
  kind: 'film',
  added: '2026-11-17T18:30',
  ask: 'משימות שפותחות סרט של הדמויות מדברות: זוויות מצלמה, מה יגידו – במאי אמיתי לסרטים הקצרים. הסרט הראשון: קניית הסופר מהמנהל. מוזיקת רקע, העסקה, רואים את הכסף, עובד עם המזוודה, צילום מלמטה של הסופר, המוזיקה עולה לביט גנגסטרי, הסופר נראה מבריק – זה הרגע שקנית אותו.',
  status: 'choose',
  round:
    'לפי ההערה ("שדרוגים שיתרמו להמשך, יציב, קל לייצר עוד סרטים ברמה גבוהה יותר; תאורה; עוברים דרך קירות וחפצים; קולנועיות; אפקטים; פחות תחזוקה"), שדרוג של מנוע הסרטים עצמו – הסרט הזה נשאר אותו סרט, והכול חל על כל סרט: ' +
    '(1) אף אחד לא עובר דרך קיר, רהיט, גדר או אדם: כל הליכה עוקפת את הקירות והרהיטים של המקום (מהשורות של המשחק) ואת מי שעומד בדרך – בסוף הסרט הזה שני קונים עברו דרך המנהל והקבלן, עכשיו הם עוקפים; ובדיקה אוטומטית מתריעה על כל מי שנתקע בקיר, עובר דרך מישהו, או מצולם כשהוא לא על הבמה. ' +
    '(2) תאורה: אור הסביבה של המשחק עצמו (מתכות כבר לא שחורות), השמש בחוץ מוצבת לכל שוט כמו בצילומי קולנוע (מעל הכתף בשוט רחב, מאחור בשוט קרוב) עם אור מפתח על מי שמצולם, צל חד יותר בשוטים קרובים, וגוון עדין של שעת היום על התמונה. ' +
    '(3) קירות וגדרות שהמצלמה משאירה בחוץ נקבעים פעם אחת לכל שוט – שום דבר לא נעלם ומופיע באמצע שוט. ' +
    '(4) אפקטים בעולם עצמו (אבק, נוצות, ניצוצות, כוכבים סביב הראש) וחלקיקי אור באוויר; איריס מצויר לסוף; מוזיקת התגנבות וארבעה צלילים מצוירים. ' +
    '(5) ערכת סרטים: תבניות לרגעים שחוזרים (מביאים ארגז, מניחים, בונים – הקליקים מסונכרנים לחלקי הדגם), כך שסרט חדש הוא בעיקר הסיפור שלו.',
  still: 'yard',
  screen: 'market',
  research: [
    {
      pattern:
        'השמש מוצבת לכל שוט: רוב הצלמים מעמידים את השמש מאחורי הדמויות, בזווית למצלמה – קו אור סביבן – ומאירים את הפנים באור מפתח. במנוע: השמש מסתובבת סביב מי שמצולם לפי גודל השוט, תמיד באותו צד של השורה.',
      from: 'American Cinematographer (ASC) – Follow the Sun',
      url: 'https://theasc.com/blog/shot-craft/follow-the-sun',
    },
    {
      pattern: 'כל סצנה חייבת "להתהפך": בהתחלה המנהל מסתכל על החקלאי מלמעלה ומשלם 20%, בסוף החקלאי הבעלים, והוא זה שמציע למנהל 20%.',
      from: 'Robert McKee – Do your scenes turn?',
      url: 'https://mckeestory.com/do-your-scenes-turn/',
    },
    {
      pattern: 'זווית נמוכה = כוח. המנהל מצולם מלמטה כשהוא צוחק על החקלאי; אחרי הקנייה החקלאי מצולם מהרצפה, והמנהל בגובה העיניים, קטן עם הקופסה שלו.',
      from: 'StudioBinder – Low angle shot',
      url: 'https://www.studiobinder.com/blog/low-angle-shot/',
    },
    {
      pattern: 'מתח לפני הפתעה: כבר בשוט הראשון רואים את הקבלן סוחב מזוודה כבדה לחנות – הקהל יודע לפני המנהל. המזוודה נוחתת, נפתחת לאט, ורק אז הזוהר.',
      from: 'Hitchcock לטריפו – הפצצה מתחת לשולחן',
      url: 'https://nofilmschool.com/alfred-hitchcock-and-francois-truffaut-explain-surprise-vs-suspense',
    },
    {
      pattern: 'חוק השלוש עם היפוך: המנהל לועג פעמיים ("Back to sell me carrots, kid?", "With what? Turnips?") ובפעם השלישית מתחנן ("Buy my mug?").',
      from: 'No Film School – The rule of three',
      url: 'https://nofilmschool.com/rule-of-the-three',
    },
    {
      pattern: 'מוזיקה שמתחלפת עם הסיפור, ושקט לפני ה"דרופ": מוזק של סופר → שריטת תקליט עם הסנאפ → דופק של מתח → שקט של חצי שנייה → ביט בום־באפ והאורות נדלקים.',
      from: 'PC Gamer – עיצוב רגע החשיפה (עלייה, שקט, מכה)',
      url: 'https://www.pcgamer.com/behind-the-addictive-psychology-and-seductive-art-of-loot-boxes/',
    },
    {
      pattern: 'הליכה בהילוך איטי הופכת הליכה לתהלוכה – פעם אחת בסרט, לגיבור, כשהוא יוצא מהחנות שלו.',
      from: 'Reservoir Dogs – ההליכה בפתיחה',
      url: 'https://nofilmschool.com/reservoir-dogs-slow-mo-walk-defined-cool',
    },
    {
      pattern: 'הכפתור: אחרי השיא, בדיחה קצרה אחת ואז החוצה – וכרטיס הסיום מראה מה קיבלת, בתמונות של המשחק (הזיכרון שומר את השיא ואת הסוף).',
      from: 'Peak-end במשחקים – CHI 2016',
      url: 'https://www.cs.mcgill.ca/~jeromew/data/COMP766/CHI2016/p5608-gutwin.pdf',
    },
    {
      pattern:
        'דיבור במילים, לא ג׳יבריש: "שפת דמויות" כמו באנימל קרוסינג נותנת אופי אבל לא משמעות – ואי אפשר היה להבין מה אומרים. לכן כל שורה נקראת עכשיו בקולות הדיבור שכבר יש בכל טלפון (Web Speech), ולכל דמות קול, גובה וקצב משלה. רק במכשיר בלי קול באנגלית נשאר הג׳יבריש.',
      from: 'MDN – SpeechSynthesis',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis',
    },
    {
      pattern:
        'הטלפון מוסר את הדיבור מילה אחרי מילה (אירוע "boundary"), אז המילים בבועה עולות בדיוק כשהקול מגיע אליהן. ובאייפון דיבור מתחיל רק אחרי נגיעה – לכן הכפתור Sound (או כל נגיעה בסרט) "פותח" אותו.',
      from: 'MDN – boundary event · ResponsiveVoice – Browser support',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/boundary_event',
    },
    {
      pattern: 'אנגלית פשוטה: נושא ופועל בכל שורה ("You? Buy my shop?" במקום "With what?"), בלי ניבים ("mint condition"), מספרים כמו שאומרים אותם, וזמן לכל שורה בקצב של מי שאומר אותה.',
      from: 'Plain Language – Federal guidelines',
      url: 'https://www.plainlanguage.gov/guidelines/',
    },
    {
      pattern: 'תאורת "שורט קי": האור הראשי בא מהצד של הפנים שפונה הרחק מהמצלמה – הלחי הקרובה בצל, לפנים יש עומק. זה הסגנון הנפוץ בקולנוע.',
      from: 'Neil Oseman – Introduction to short key lighting',
      url: 'https://neiloseman.com/introduction-short-key-lighting/',
    },
    {
      pattern:
        'בסרטונים של משחקים מוסיפים לכל שוט אור מפתח ואור קצה משלו, שדולקים רק בשוט שצריך אותם. לקחנו: האורות של הדמויות עוקבים אחרי השוט – מכוונים לפנים, באותה עוצמה בכל מרחק, ואור הקצה רק בשוטים קרובים (בשוט רחב הוא מאיר את התפאורה).',
      from: 'CRYENGINE – Lighting Cinematics Tutorial',
      url: 'https://www.cryengine.com/docs/static/engines/cryengine-3/categories/1114113/pages/15011053',
    },
    {
      pattern: 'הראש של דמות מסתובב בנקודה שבה הוא באמת מתכופף – בבסיס הצוואר, לא באמצע הגולגולת. כך תוקן הבאג של הראש שיצא מהמקום.',
      from: 'Blender – Rigify bone positioning guide',
      url: 'https://docs.blender.org/manual/en/4.0/addons/rigging/rigify/bone_positioning.html',
    },
    {
      pattern:
        'סרט במנוע של המשחק מראה את העולם של השחקן – הבגדים שלו. לכן במשחק הסרט מצויר על הקנבס של המשחק עצמו, מהמודלים של המשחק ואת/ה בבגדים שלך מהמלתחה; המצלמה נשארת בצד של הדרך שזהה בכל חווה, וחלון הסיום עולה מעל המשחק החי.',
      from: 'Giant Bomb – In-engine cinematics',
      url: 'https://www.giantbomb.com/in-engine-cinematic/3015-964/',
    },
    {
      pattern:
        'כשפס התקדמות עובר רמה זה אירוע נפרד וגדול יותר: הפס מתמלא עד הסוף, הבזק, הכוכב קופץ, צליל וקונפטי – ואז הפס מתמלא מחדש. בחלון: הפס של הרמה מתמלא מה־XP שהיה לך לפני הקנייה, ואם עברת רמה – "Level 14!".',
      from: 'Game Juice – UI feedback design (מחפשים: progress bar overflow → level-up event)',
    },
    {
      pattern: 'לא רק לחגוג: להראות מה יש לך עכשיו ומה הפרס המשמעותי הבא. בחלון: "Yours now" (המדפים, הקופה, הקונים) ו"Next" (השדרוגים של החנות עד הסוף שלהם), מהשורות של המשחק עצמו.',
      from: 'Screensdesign – Loyalty rewards design examples',
      url: 'https://screensdesign.com/articles/mobile-app-loyalty-rewards-design-examples/',
    },
    {
      pattern:
        'פופאפ של הישג עובד כי הוא מהיר: צליל, הודעה קצרה, וחוזרים למשחק. בחלון: כל חלק נכנס אחרי הקודם בתוך שנייה וחצי (התמונה, הסרט, הפס, הכרטיסים, הבא), ושני כפתורים בלבד – Watch again ו־Continue.',
      from: 'The Xbox Hub – The achievement pop-up effect',
      url: 'https://www.thexboxhub.com/the-achievement-pop-up-effect-when-xbox-rewards-start-feeling-like-mini-jackpots/',
    },
  ],
  states: [
    { id: 'whole', name: 'מההתחלה', data: { from: 0 } },
    { id: 'case', name: 'הסנאפ והמזוודה', data: { from: at(5) } },
    { id: 'drop', name: 'הביט נכנס', data: { from: at(11) } },
    { id: 'button', name: 'הסוף: 20%', data: { from: at(15) } },
    { id: 'end', name: 'החלון בסוף', data: { from: timeline(SUPERMARKET).length } },
    { id: 'end-level', name: 'החלון בסוף – עם רמה חדשה', data: { from: timeline(SUPERMARKET).length, xp: 1375 } },
  ],
  variants: [
    {
      id: 'a',
      name: 'בהנהלה חדשה',
      note: 'סרט של 42 שניות ב־18 שוטים, בתלת־ממד של המשחק עצמו: הסופר מהשורה שלו, המנהל והקבלן ממנוע הדמויות, ואת/ה בבגדים שלך, ומסביב השמיים, הדרך והיער של המשחק. כל שורה נקראת במילים, באנגלית פשוטה, בקול הדיבור של הטלפון – לכל דמות קול, גובה וקצב משלה (בלי הורדות ובלי הקלטות); הסצנות שמדברים בהן מוארות כמו בקולנוע. עד 38 תווים לשורה, אפשר לדלג מהשנייה הראשונה, ובסוף חלון עם תחושת התקדמות: פס הרמה מתמלא, מה שלך עכשיו ומה זה פותח. במשחק: אחרי הקנייה מהכרטיס, פעם אחת. 🔊 עם קול: לחצו על Sound.',
      motion:
        'ערב, סגירה: מוזק מהרמקול של הסופר, והקבלן סוחב מזוודה כבדה לדלת. במשרד, לילה, אור מנורה חם: המנהל מקליד ולועג: "More carrots? I pay 40%, kid." ("עוד גזר? אני משלם 40%, ילד"). את/ה מצביע/ה על המסך – "FOR SALE · 1500" בזום. "You? Buy my shop? With carrots?" – הוא צוחק, מצולם מלמטה, הראש נזרק אחורה מבסיס הצוואר. סנאפ באצבעות: שריטת תקליט, שקט. ' +
        'הקבלן נכנס בהילוך איטי, דופק של מתח, קצה של אור כחלחל על הכתפיים: "Where do I put it, boss?" – הוא קורא לך "בוס". המזוודה נוחתת על השולחן (רעידה), נפתחת – "Whoa…" ואור זהב מלמטה על הפנים של המנהל, מקהלה, ורואים את המטבעות. "שעתיים אחר כך": "…1,499…" ' +
        'לחיצת יד באור צד חם על רקע כהה: "1,500. The shop is yours." – עלייה, חצי שנייה שקט, והביט נכנס: האורות נדלקים בקליק והמדפים מתמלאים בסחורה של החווה. בוקר: את/ה יוצא/ת מהחנות בהילוך איטי, מצולם/ת מהרצפה; באנר "UNDER NEW MANAGEMENT" נפרש על השלט, ניצוצות וקונפטי. ' +
        'הכפתור, בשוט מרובע מול החנות: המנהל יוצא עם קופסה, ספל ועציץ, נעמד לידך ומסתובב אלייך: "Want my mug? Only 10 coins." את/ה לא מסתובב/ת בכלל, ואחרי שנייה של שקט, מצולם/ת מלמטה מתחת לבאנר: "I\'ll give you 20%." – מה שהוא שילם לך בהתחלה, חצי ממה שהוא משלם היום. טרומבון עצוב, הוא קופא ומשתרך משם, והקונים נכנסים לחנות. ' +
        'החלון: נוחת בקפיצה עם קונפטי וצליל של רמה; החנות קופצת מתוך קרני אור, הסרט האדום נפרש מתחתיה, הפס הסגול מתמלא ו"‎+25 XP" סופר למעלה (עם רמה חדשה: הבזק, הכוכב קופץ, "Level 14!", עוד קונפטי), שלושת הכרטיסים של "Yours now" נוחתים אחד אחד עם וי ירוק, ואז "Next". ' +
        'המילים בבועה עולות בדיוק כשהקול מגיע אליהן; בלי קול – לפי השעון של הסרט.',
      adds: 'סרט שנפתח כשקונים את הסופר (אין עדיין סרטים במשחק), קולות לדמויות (אין דיבור במשחק), ובאנר "UNDER NEW MANAGEMENT" מעל השלט אחרי הקנייה.',
      render: (s, act) => <FilmSupermarketA s={s} onClose={act.close} />,
    },
  ],
}
