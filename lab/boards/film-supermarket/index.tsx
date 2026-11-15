import type { Board } from '../../board'
import { timeline } from '../../films/format'
import { SUPERMARKET } from '../../films/supermarket'
import { FilmSupermarketA } from './FilmSupermarketA'

// A film, not a panel: buying the supermarket from the manager (src/farm/state.ts, buyMarket), as the film director
// made it (.claude/agents/film-director.md, lab/FILM.md). The film is data (lab/films/supermarket.ts) played by the
// lab's film player (lab/films/Player.tsx) on the game's own models: the market from its row, the manager and the
// contractor from the people engine, each line said aloud in its speaker's voice (lab/films/voice.ts), round the market
// the game's own sky, haze, lawn, lane and woods. Its states are moments to start from, so each part can be watched
// again on its own; nothing here is in the game yet.

export interface FilmSupermarketState {
  /** the second of the film it starts from */
  from: number
}

const at = (shot: number) => timeline(SUPERMARKET).shots[shot].start

export const filmSupermarketBoard: Board<FilmSupermarketState> = {
  id: 'film-supermarket',
  title: 'סרט: קונים את הסופר',
  kind: 'film',
  added: '2026-11-15T09:05',
  ask: 'משימות שפותחות סרט של הדמויות מדברות: זוויות מצלמה, מה יגידו – במאי אמיתי לסרטים הקצרים. הסרט הראשון: קניית הסופר מהמנהל. מוזיקת רקע, העסקה, רואים את הכסף, עובד עם המזוודה, צילום מלמטה של הסופר, המוזיקה עולה לביט גנגסטרי, הסופר נראה מבריק – זה הרגע שקנית אותו.',
  status: 'choose',
  round:
    'לפי ההערות: (1) כל דמות מדברת עכשיו בקול משלה – "שפת דמויות" כמו באנימל קרוסינג, שנוצרת לבד מהטקסט של השורה (צליל לכל הברה, שריקה ל־s, הפסקה בפסיק, עלייה בסימן שאלה), בלי הקלטות ובלי קבצים: המנהל מהיר ואפי, הקבלן איטי ועמוק, ואת/ה נמוך ורגוע. המילים בבועה עולות בזמן שהן נאמרות, הראש מהנהן עם כל הברה, והמוזיקה יורדת מתחת לדיבור. קול של דמות הוא כמה מספרים (גובה, קצב, גוון). ' +
    '(2) אין יותר רקע אפור: מסביב לסופר יש את השמיים, האובך, הדשא, הדרך והיער של המשחק עצמו, והמצלמה אף פעם לא מסתובבת אל החווה – כך שלא רואים חווה שהיא לא שלך. הסוף צולם מחדש מול החנות: שניכם עומדים זה לצד זה, והבאנר מעליכם. במשחק הסרט ירוץ בתוך הסצנה החיה, אז כל מה שרואים הוא העולם שלך כמו שהוא באותו רגע.',
  still: 'yard',
  screen: 'market',
  research: [
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
        'באנימל קרוסינג הדמויות "קוראות" את הטקסט עצמו – צליל לכל אות או הברה, בגובה של הדמות; האופי הוא הגובה והקצב (עצבני נמוך, עליז גבוה). לקחנו: הקול נוצר מהשורה עצמה, וכל דמות היא כמה מספרים.',
      from: 'How to: Animal Crossing Dialogue Sounds',
      url: 'https://geolojosh.itch.io/goodlands/devlog/314373/how-to-animal-crossing-dialogue-sounds',
    },
    {
      pattern: 'ב־Reigns הג׳יבריש "דטרמיניסטי": אותה שורה תמיד נשמעת אותו דבר, והגובה מבדיל בין דמויות. לקחנו: הקוביות של הקול הן האותיות של השורה – משנים טקסט, והקול משתנה איתו, בלי להקליט.',
      from: 'Disasterpeace – Reigns: A Thousand Years of Deterministic Babble',
      url: 'https://disasterpeace.com/blog/tag.Reigns',
    },
    {
      pattern:
        'בבנג׳ו־קאזואי שמו קולות משובשים במקום דיבוב – ושחקנים התאהבו בהם. תנועה (vowel) היא זמזום שעובר דרך שלוש תהודות של הפה; ככה עושים קול בלי הקלטה: זמזום בגובה של הדמות, ומסננים שזזים מתנועה לתנועה.',
      from: 'VGFacts – Banjo-Kazooie · University of Delaware – formant synthesis',
      url: 'https://www.asel.udel.edu/speech/tutorials/synthesis/vspace2.html',
    },
    {
      pattern: 'סרט במנוע של המשחק מראה את העולם של השחקן – הבגדים שלו, החווה שלו. לכן במשחק הסרט ירוץ בסצנה החיה (בלי סט משלו), ובמעבדה המצלמה נשארת בצד של הדרך שזהה בכל חווה.',
      from: 'Giant Bomb – In-engine cinematics',
      url: 'https://www.giantbomb.com/in-engine-cinematic/3015-964/',
    },
  ],
  states: [
    { id: 'whole', name: 'מההתחלה', data: { from: 0 } },
    { id: 'case', name: 'הסנאפ והמזוודה', data: { from: at(5) } },
    { id: 'drop', name: 'הביט נכנס', data: { from: at(11) } },
    { id: 'button', name: 'הסוף: 20%', data: { from: at(15) } },
  ],
  variants: [
    {
      id: 'a',
      name: 'בהנהלה חדשה',
      note: 'סרט של 41 שניות ב־18 שוטים, בתלת־ממד של המשחק עצמו: הסופר מהשורה שלו, המנהל והקבלן ממנוע הדמויות, ואת/ה בבגדים שלך, ומסביב השמיים, הדרך והיער של המשחק. כל שורה נאמרת בקול של הדמות (נוצר מהטקסט, בלי הקלטות), עד 38 תווים, אפשר לדלג מהשנייה הראשונה, ובסוף כרטיס עם מה שקיבלת. 🔊 עם קול: מוזיקה וקולות מההתחלה.',
      motion:
        'ערב, סגירה: מוזק מהרמקול של הסופר, והקבלן סוחב מזוודה כבדה לדלת. במשרד המנהל מקליד ולועג: "באת למכור לי גזר, ילד?". את/ה מצביע/ה על המסך – "FOR SALE · 1500" בזום. "עם מה? לפת?" – הוא צוחק, מצולם מלמטה. סנאפ באצבעות: שריטת תקליט, שקט. ' +
        'הקבלן נכנס בהילוך איטי, דופק של מתח: "Heavy one, boss" – הוא קורא לך "בוס". המזוודה נוחתת (רעידה), נפתחת – אור זהב על הפנים של המנהל ומקהלה, ורואים את המטבעות מעבר לכתף שלו. "שעתיים אחר כך": "1,498. 1,499…" ' +
        'לחיצת יד: "1,500. The shop is yours." – עלייה, חצי שנייה שקט, והביט נכנס: האורות נדלקים בקליק והמדפים מתמלאים בסחורה של החווה. בוקר: את/ה יוצא/ת מהחנות בהילוך איטי, מצולם/ת מהרצפה; באנר "UNDER NEW MANAGEMENT" נפרש על השלט, ניצוצות וקונפטי. ' +
        'הכפתור, בשוט מרובע מול החנות: המנהל יוצא עם קופסה, ספל ועציץ, נעמד לידך ומסתובב אלייך: "תקנה את הספל שלי? כמו חדש." את/ה לא מסתובב/ת בכלל, מצולם/ת מלמטה מתחת לבאנר: "אתן לך 20%." טרומבון עצוב, הוא קופא ומשתרך משם, והקונים נכנסים לחנות. כרטיס: "The shop is yours", ‎+25 XP. ' +
        'כל השורות נשמעות בקולות של הדמויות (המנהל מהיר ואפי, הקבלן איטי ועמוק, את/ה נמוך ורגוע), המילים עולות בבועה כשהן נאמרות, ו"אוּוּ…" של המנהל כשהמזוודה נפתחת.',
      adds: 'סרט שנפתח כשקונים את הסופר (אין עדיין סרטים במשחק), קולות לדמויות (אין דיבור במשחק), ובאנר "UNDER NEW MANAGEMENT" מעל השלט אחרי הקנייה.',
      render: (s, act) => <FilmSupermarketA s={s} onClose={act.close} />,
    },
  ],
}
