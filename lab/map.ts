// The map of the game's interface: every screen that wraps the game (the opening and loading, the screen in play, the
// sheets and cards, the talks with characters, the settings, the notices…) as the game has it today, with the
// designer's verdict and what it proposes, by priority. It is where the next boards come from. Pictures are
// lab/map/<id>-upright.jpg and <id>-sideways.jpg (either or both), and another state of the same screen
// <id>-upright-2.jpg…, from the game itself: node scripts/lab-map-shots.mjs (the dev server up).

export interface Screen {
  /** also its pictures' names */
  id: string
  /** a few words, in Hebrew */
  name: string
  /** which part of the game: one of AREAS */
  area: (typeof AREAS)[number]
  /** where it is in the code */
  where: string
  /** good as it is / to improve / to design again / missing */
  grade: 'good' | 'fix' | 'redo' | 'missing'
  /** what works (one line) */
  works: string
  /** what is wrong, a few short lines */
  wrong: string[]
  /** what the designer proposes (one or two lines) */
  idea: string
  /** 1 first */
  priority: 1 | 2 | 3
  /** the board for it, when there is one */
  board?: string
  /** what a picture shows, by the end of its name ('upright', 'upright-2', 'sideways'…), when it is more than the
   *  screen itself (another state, another tab); otherwise its caption is the way the phone is held */
  shots?: Record<string, string>
}

export const AREAS = ['פתיחה', 'מסך המשחק', 'פעולות', 'חלונות', 'שיחה', 'הגדרות', 'הודעות'] as const

export const MAP: { summary: string; screens: Screen[] } = {
  summary: [
    'החלונות של החווה טובים ועקביים: תמונה, כותרת קצרה, שבבים וכפתור צהוב אחד. החלש הוא מה שמסביבם: הפתיחה מדברת כמו מפתח, ולרוחב Play יורד מתחת למסך; החלק העליון תופס רבע מסך לאורך; ודמויות לא מדברות בכלל.',
    'הסדר שאני ממליץ ללוחות הבאים: הפתיחה והטעינה ← החלק העליון של המסך ← שיחה עם דמויות, מהקונים בשער ← צעדים ראשונים ← הגדרות אחת.',
    'ובינתיים – לבחור בלוח הרמה, שמחכה לך.',
  ].join('\n'),
  screens: [
    // ── the opening ──
    {
      id: 'loading',
      name: 'מסך הטעינה',
      area: 'פתיחה',
      where: 'src/ui/Loading.tsx',
      grade: 'good',
      works: 'במשחק: B – הדרך הביתה בחלון עגול, שורה אחת במילים של שחקן, פס אחד אמיתי עם הזמן שנשאר, טיפ שמתחלף, ורגע אחד כשמוכן.',
      wrong: ['בזמן הטעינה עוד לא רואים מה מחכה בחווה (✦ ב־B) – כרטיס החווה במסך הפתיחה מראה אותו מיד אחרי.'],
      idea: 'בנוי במשחק (B). כשמוכן, הרגע שלו – ואז מסך הפתיחה (E) תופס את מקומו.',
      priority: 1,
    },
    {
      id: 'intro',
      name: 'מסך הפתיחה',
      area: 'פתיחה',
      where: 'src/ui/Intro.tsx · Loading.tsx · SavesPanel.tsx',
      grade: 'good',
      works: 'במשחק: E – תפריט אמיתי מעל החווה: Continue או New farm, שישה אריחים, כרטיס חווה לשחקן חוזר עם מה שמחכה לו.',
      wrong: ['אין עוד שם לכל חווה ובחירת מקום בדף New farm (✦).'],
      idea: 'בנוי במשחק (E). הבא: השם לחווה, אם תרצה.',
      priority: 1,
      shots: {
        upright: 'שחקן חדש',
        'upright-2': 'הדף Music',
        'upright-3': 'שחקן חוזר',
        sideways: 'לרוחב',
        'sideways-2': 'לרוחב, הדף Music',
        'sideways-3': 'שחקן חוזר, לרוחב',
      },
    },
    {
      id: 'saves',
      name: 'חוות שמורות',
      area: 'פתיחה',
      where: 'src/ui/SavesPanel.tsx',
      grade: 'good',
      works: 'במשחק: D – לשונית לכל חווה עם כוכב הרמה, כרטיס עם מספרים בתמונות, Play גדול, וההתחלה מחדש בלחיצה ארוכה.',
      wrong: ['אין עוד תמונה ושם לכל חווה (✦): המשחק צריך לצלם את החווה כששומר.'],
      idea: 'בנוי במשחק (D), גם כדף Load farm במסך הפתיחה.',
      priority: 2,
      board: 'saves',
    },

    // ── the screen in play ──
    {
      id: 'top',
      name: 'החלק העליון: שבבים ומצפן',
      area: 'מסך המשחק',
      where: 'src/farm/TopDash.tsx · XpChip.tsx · DayChip.tsx · src/ui/Compass.tsx · HudMode.tsx · PhotoButton.tsx',
      grade: 'good',
      works:
        'במשחק: D – לוח מחוונים: המטבעות, דרך הרמה עם הפרס, המצפן עם השעה, הממגורה והאסם כמיכלים, התור והמטרות, ותפריט עם שמות. עם F: הדרך זוהרת כשמחכות קופסאות מתנה ומספרן בסופה, ומטבעות הרמה עפים מהמספר אל המטבעות ונספרים כשהם מגיעים.',
      wrong: ['המטרה הננעצת (✦) מחכה לנעיצה בלוח המטרות.'],
      idea: 'בנוי במשחק (D), ובתצוגה "נקי" כפתור צילום ושיתוף.',
      priority: 1,
      shots: { upright: 'הכל', 'upright-2': 'רק המצפן', sideways: 'לרוחב', 'sideways-2': 'לרוחב, רק המצפן' },
    },
    {
      id: 'touch',
      name: 'כפתורי המגע',
      area: 'מסך המשחק',
      where: 'src/ui/TouchControls.tsx · src/lib/stick.ts',
      grade: 'fix',
      works: 'המקל בא אל האגודל, הכפתור העגול גדול ומראה מה יקרה, והכל בפינות.',
      wrong: [
        'שלושת הכפתורים מעל המקל (חץ, הולך, פרסה) – סמלים בלי מילה, קשה לנחש.',
        '"JUMP" במילים באנגלית, כשכל השאר סמלים.',
        'כפתורים כהים כמעט נעלמים על רצפה כהה ועל עשב.',
        'המילה מתחת לכפתורי המשנה 11px.',
      ],
      idea: 'אותם מקומות, שפה אחת: קפיצה כסמל, שלושת הכלים כפתור אחד שנפתח, וטבעת בהירה סביב כל כפתור כדי שייראה על כל רקע.',
      priority: 2,
    },
    {
      id: 'edit',
      name: 'עריכת החווה וקישוט הבית',
      area: 'מסך המשחק',
      where: 'src/farm/EditPanel.tsx · src/home/DecoratePanel.tsx · FurnitureShop.tsx',
      grade: 'fix',
      works: 'מבט מלמעלה, כרטיס בתחתית, Done צהוב בפינה; בבית – חדרים כשבבים וחנות רהיטים מסודרת.',
      wrong: [
        'בחווה הכרטיס הוא פסקה של שלוש שורות ועוד שורת עזרה.',
        'תוויות האדמה ("North meadow 150 coins") נחתכות בקצות המסך.',
        'לא רואים מה אפשר להזיז עד שמנסים: אין סימן על הדברים עצמם.',
        'בקישוט אין שבב מטבעות – רואים כמה יש רק בתוך החנות.',
        'החנות מכסה את החדר: בוחרים רהיט בלי לראות איפה הוא יעמוד.',
      ],
      idea: 'שני המצבים באותה שפה: סימן ✥ קטן על כל מה שזז, כרטיס של שורה אחת, והחנות כמגירה נמוכה שמשאירה את החדר בעין.',
      priority: 2,
      shots: { upright: 'עריכת החווה', 'upright-2': 'קישוט הבית', 'upright-3': 'חנות הרהיטים', sideways: 'עריכת החווה, לרוחב', 'sideways-2': 'קישוט, לרוחב', 'sideways-3': 'חנות, לרוחב' },
    },

    // ── actions ──
    {
      id: 'action',
      name: 'הכפתור העגול והתמונה מעליו',
      area: 'פעולות',
      where: 'src/ui/Hud.tsx · ActionGlyph.tsx · TouchControls.tsx',
      grade: 'fix',
      works: 'הכפתור מראה את הדבר עצמו ואת הפועל ("Harvest"), והתמונה מעליו אומרת כמה (×16).',
      wrong: ['אותו דבר נאמר פעמיים ורחוק: ×16 באמצע המסך והכפתור בפינה.', 'התווית האמצעית יושבת על הסצנה, בדיוק איפה שמסתכלים.', 'מצב "מחכים" (⏱ 0:37) נראה כמו כפתור, אבל אין מה ללחוץ.'],
      idea: 'הכמות עוברת לכפתור עצמו (תג ×16 על הקצה שלו). באמצע נשאר רק "מחכים": שקוף יותר, עם שעון שמתמלא.',
      priority: 2,
      shots: { upright: 'לקצור', 'upright-2': 'מחכים שיגדל', sideways: 'לרוחב' },
    },
    {
      id: 'tag',
      name: 'תג מחיר וכרטיסי אישור',
      area: 'פעולות',
      where: 'src/ui/ThingTag.tsx · ConfirmCard.tsx · src/farm/FarmUI.tsx (BuildPanel) · Ladder.tsx',
      grade: 'fix',
      works: 'מטבע ומחיר על הדבר עצמו; הכרטיס: תמונה, שם, שורה אחת, "Not now" ואז "Build · 30" – בדיוק לפי הכללים.',
      wrong: [
        'כרטיס המכונה מכסה לאורך את הכפתורים שמעל המקל, ולרוחב את המצפן והכפתורים בפינה.',
        'מה שנכנס למכונה (חיטה ×3) קטן בפס חיוור, בלי חץ אל מה שיוצא.',
        'שני סוגי כרטיס לאותו רגע ("לפני שמוציאים"): גיליון בתחתית וכרטיס צף.',
        'לרוחב, כרטיס של שורה אחת ושני כפתורים הוא גיליון בגובה כל המסך – רובו ריק.',
        'התג הוא עוד עיגול לבן בסצנה, בלי "זנב" אל הדבר שהוא שלו.',
      ],
      idea: 'משפחה אחת של "לפני שמוציאים": מה נכנס → מה יוצא בשורה אחת, המחיר על הכפתור, ומקום קבוע ליד הכפתור העגול שלא מכסה שום כפתור אחר.',
      priority: 2,
      shots: { upright: 'תג מחיר', 'upright-2': 'הכרטיס שהוא פותח', 'upright-3': 'כרטיס של מכונה', sideways: 'תג, לרוחב', 'sideways-2': 'כרטיס, לרוחב', 'sideways-3': 'מכונה, לרוחב' },
    },

    // ── the sheets ──
    {
      id: 'level',
      name: 'כרטיס הרמה',
      area: 'חלונות',
      where: 'src/farm/LevelCard.tsx · levelView.ts',
      grade: 'good',
      works:
        'F במשחק: הסרגל עם ארבע קופסאות על הרבעים (נעולה, מוכנה, פתוחה עם מה שנתנה), פתיחה באמצע הכרטיס, כפתור שפותח את כל מה שמחכה (גם מרמות קודמות), ומה שהרמה נותנת – המטבעות והמתנה – נכנס לבד, בלי Claim; "Level N reached!" אומר מה נכנס.',
      wrong: [],
      idea: 'להשאיר. אולי בהמשך: נגיעה ארוכה על תמונה של פרס אומרת את שמו.',
      priority: 1,
      board: 'level',
    },
    {
      id: 'seeds',
      name: 'שקיות זרעים',
      area: 'חלונות',
      where: 'src/farm/FarmUI.tsx (SeedsPanel, BedPanel)',
      grade: 'good',
      works: 'רשת של שמונה גידולים: תמונה, זמן, מחיר וכמה יש במחסן; נגיעה אחת שותלת.',
      wrong: ['הגיליון מכסה כמעט את כל המסך כדי לבחור דבר אחד.', 'לא רואים כמה ערוגות יישתלו, ומה הקציר שווה.', 'הכמות במחסן קטנה בפינה וקל לפספס אותה.'],
      idea: 'להשאיר. אפשר גיליון בחצי גובה, והגידול שנשתל אחרון – ראשון.',
      priority: 3,
    },
    {
      id: 'goals',
      name: 'מטרות',
      area: 'חלונות',
      where: 'src/farm/GoalsPanel.tsx',
      grade: 'fix',
      works: 'כל מטרה כמו הזמנה: תמונה, מה לעשות, פס התקדמות ומה היא נותנת.',
      wrong: ['שש שורות דומות, כולן ב־0 – אף אחת לא "הבאה בתור".', 'הפרס (מטבעות וחומר בניין) קטן בצד, בלי מילה.', 'כשמטרה מושגת יש רק כפתור Claim ירוק – אין רגע.'],
      idea: 'E (נבחר) בסיבוב 4: כל פרס בתוך הכרטיס שלו, הזרקור עם הפרס בסוף הפס, מדבקה מתחלפת רק עם הזרקור, ו־Claim all. ועוד רפרנס, F: ארון המדליות – מתכת לכל מדרגה ומדליה שמסתובבת באיסוף.',
      priority: 2,
      board: 'goals',
    },
    {
      id: 'store',
      name: 'הממגורה והאסם',
      area: 'חלונות',
      where: 'src/farm/StorePanel.tsx',
      grade: 'good',
      works: 'מה בפנים בתמונות עם כמות, כמה מלא, מה הרמה הבאה צריכה, ודרך ללכת לקבלן.',
      wrong: ['"22/50" הוא שבב קטן; מחסן כמעט מלא לא נראה מלא.', '"Upgrade" אפור בלי לומר מה חסר.', 'שמות ארוכים נשברים לשתי שורות ("Sheaves of wheat").'],
      idea: 'להשאיר. להוסיף פס מילוי גדול בראש (ירוק עד אדום).',
      priority: 3,
      shots: { upright: 'ממגורה', 'upright-2': 'אסם', sideways: 'לרוחב' },
    },
    {
      id: 'orders',
      name: 'לוח ההזמנות',
      area: 'חלונות',
      where: 'src/farm/orderBoard/OrdersBoard.tsx',
      grade: 'good',
      works: 'במשחק מסיבוב 4 (E, לוח העץ): קרש לכל הזמנה, יתדות שמתמלאות, Put in אחד ואז Send, מאיפה כל מוצר מגיע, ולשונית Office שקונה עם כרטיס.',
      wrong: [],
      idea: 'נבחר E ונכנס למשחק, כולל "Show me": בחווה הלוח נסגר והולכים לבד למקום שבו המוצר נעשה (הקרוב שמוכן, אחרת הקרוב).',
      priority: 3,
      board: 'orders',
    },
    {
      id: 'shop',
      name: 'חנות החווה',
      area: 'חלונות',
      where: 'src/farm/FarmUI.tsx (ShopPanel)',
      grade: 'fix',
      works: 'כל שדרוג: תמונה, שם, רמה, "5 → 6" ומחיר על הכפתור – ברור במבט.',
      wrong: ['המחיר קונה מיד, בלי כרטיס אישור – כמו שום קנייה אחרת במשחק.', 'רשימה ארוכה אחת; מה שכבר שלך ("Yours") באמצע.', 'שמונה כפתורים צהובים באותו מסך.'],
      idea: 'קבוצות (אדמה · בעלי חיים · תור), מה שנקנה יורד לסוף, והמחיר פותח כרטיס אישור כמו בכל מקום אחר.',
      priority: 2,
    },
    {
      id: 'market',
      name: 'החנות שלך (המחשב)',
      area: 'חלונות',
      where: 'src/farm/MarketPanel.tsx (MarketPanel, MarketPlacePanel)',
      grade: 'fix',
      works: 'כל מקום על המדף: מה יש, כמה, מחיר וסיכוי שיקנו; כרטיס מקום עם − ו־+ למחיר.',
      wrong: ['רשימה ארוכה של שורות זהות – לא נראה כמו מדפים.', 'בכרטיס מקום "Empty" צהוב הוא הכפתור הראשי, אף שזו הפעולה הנדירה.', 'סיכוי "78%" – מספר שקשה להרגיש.'],
      idea: 'מדף אמיתי: רשת משבצות עם תמונה ומספר, ריקה – מקווקוות. המחיר במחוון אחד, מזול ליקר, במקום אחוזים.',
      priority: 2,
      shots: { upright: 'המדפים', 'upright-2': 'מקום אחד', sideways: 'לרוחב' },
    },
    {
      id: 'away',
      name: 'ברוך שובך',
      area: 'חלונות',
      where: 'src/farm/AwayPanel.tsx',
      grade: 'good',
      works: 'מה קרה כשלא היית, בתמונות עם כמויות, וכפתור אחד שהולך לדבר הכי קרוב.',
      wrong: ['"Go there" לא אומר לאן.', 'הקופה (180 מטבעות), הדבר הכי שווה, באותו גודל כמו "New pieces".'],
      idea: 'להשאיר. הכי חשוב ראשון וגדול, והכפתור עם התמונה של המקום ("אל הביצים").',
      priority: 3,
    },
    {
      id: 'wardrobe',
      name: 'הארון',
      area: 'חלונות',
      where: 'src/home/WardrobePanel.tsx · Wardrobe.css',
      grade: 'good',
      works: 'המצלמה מצלמת אותך מלפנים, הגיליון משאיר אותך בעין, ונגיעה בבגד – לובשים מיד.',
      wrong: ['לשונית "Hats" בלי תמונה כשאין כובע – נראית ריקה.', 'הבגד הבא בשורה קטנה בתחתית, בלי לומר כמה רחוק (רק "at level 10").'],
      idea: 'להשאיר. ללשונית בלי בגד – סמל של "בלי", ולבגד הבא – פס קטן של הדרך אליו.',
      priority: 3,
    },
    {
      id: 'devices',
      name: 'המסכים בבית',
      area: 'חלונות',
      where: 'src/ui/ScreenModal.tsx · src/data/screens.ts',
      grade: 'redo',
      works: 'לשוניות עם החלקה ומספרים שסופרים – עשוי בקפידה.',
      wrong: [
        'עולם אחר: כהה, אפור וזכוכית, לא נייר וצהוב כמו כל המשחק.',
        'התוכן הוא תיק עבודות לדוגמה: "Placeholder. Introduce yourself or your studio…" – לא קשור לחווה.',
        'טקסט 11–12px באותיות קטנות ואפורות.',
      ],
      idea: 'קודם להחליט מה המסכים האלה בבית החווה (חדשות? יומן? מתכונים?), ואז לעצב אותם כמכשיר של החווה, בשפת הנייר.',
      priority: 2,
    },

    // ── talks ──
    {
      id: 'buyers',
      name: 'קונים בשער',
      area: 'שיחה',
      where: 'src/farm/Visitors.tsx (בועות) · src/farm/FarmUI.tsx (QueuePanel)',
      grade: 'fix',
      works: 'בועה מעל כל קונה: מה הוא רוצה, כמה ובכמה; בחלון – "מכור לכולם" בלחיצה אחת.',
      wrong: [
        'הבועות בעולם: הקרובה ענקית ונחתכת בקצה המסך, הרחוקות קטנות מדי לקריאה; לרוחב הן נבלעות מאחורי המצפן.',
        'בחלון, לאורך, השורות רחבות מהגיליון: ה־× נחתך בקצה המסך.',
        'הקונה הוא עיגול עם מספר בצבע החולצה, ו־"Generous / Fair / Low" זה כל מה שהוא "אומר".',
        '"Sell" אפור כשחסר, בלי לומר מה חסר.',
      ],
      idea: 'הקונה מדבר: פנים (מהמראה שלו), בועה עם הבקשה, ותשובה – למכור או "לא היום" – והפנים מגיבות.',
      priority: 1,
      shots: { upright: 'בשער', 'upright-2': 'חלון הקונים', sideways: 'בשער, לרוחב', 'sideways-2': 'חלון הקונים, לרוחב' },
    },
    {
      id: 'manager',
      name: 'המנהל בסופר',
      area: 'שיחה',
      where: 'src/farm/MarketPanel.tsx (ManagerPanel, MarketBuyPanel)',
      grade: 'fix',
      works: 'כל מוצר עם כמה יש ובכמה הוא קונה, ומה שההזמנות עוד צריכות.',
      wrong: ['רשימת מחירים, לא אדם: הוא לא אומר כלום, רק "Pays 20%".', 'כפתור "Sell" ירוק בכל שורה; "Sell all" בתחתית, מתחת לגלילה.', 'קניית החנות, המטרה הגדולה, בסוף הרשימה.'],
      idea: 'ראש של שיחה: המנהל ומשפט אחד שלו ("אני קונה ב־20%"), "מכור הכל" גדול מתחת, וקניית החנות כמטרה עם פס.',
      priority: 2,
    },
    {
      id: 'contractor',
      name: 'הקבלן',
      area: 'שיחה',
      where: 'src/farm/ContractorPanel.tsx',
      grade: 'fix',
      works: 'מה הוא מוכר היום, מה הוא קונה ממך, ולמה זה חשוב (✓ 1/1 לאסם).',
      wrong: ['שלושה חלקים ושני סולמות בגיליון אחד – ארוך, צריך לגלול.', 'כשהוא לא כאן ("Back in the morning") – רשימה של כפתורים כבויים.', 'כמו המנהל: בלי פנים ובלי קול.'],
      idea: 'אותה תבנית שיחה כמו המנהל: הוא אומר מה יש לו היום, ושתי לשוניות – "לקנות" ו"למכור".',
      priority: 2,
    },
    {
      id: 'talk',
      name: 'שיחה עם דמויות',
      area: 'שיחה',
      where: 'אין עדיין (רק הבועה מעל הקונים, src/farm/Visitors.tsx)',
      grade: 'missing',
      works: 'יש כבר דמויות עם מראה משלהן (rollLook), תנועות (נפנוף, קפיצה, ניד ראש) ובועות.',
      wrong: ['אין מקום שבו דמות אומרת משפט: הקונים, המנהל והקבלן הם רשימות.', 'אין שם ופנים יחד, ו"לענות" זה כפתור Sell או ×.', 'אין דרך להכיר מישהו או לחזור אליו (לקוח קבוע).'],
      idea: 'תבנית שיחה אחת לכולם: פנים מהמראה של הדמות, שם, בועה של משפט קצר ושתי תשובות. מתחילים בקונים בשער.',
      priority: 1,
    },

    // ── settings ──
    {
      id: 'settings',
      name: 'הגדרות',
      area: 'הגדרות',
      where: 'src/ui/SettingsPanel.tsx · Intro.tsx (SettingsPanel)',
      grade: 'redo',
      works: 'כל מה שאפשר לכוון נמצא, עם מילה קטנה של הסבר ליד כל שורה.',
      wrong: [
        'שני מסכי הגדרות שונים: בפתיחה תיבות סימון של הדפדפן (אחת שחורה) ושורות שנחתכות בקצה; במשחק מתגים.',
        'במשחק: הדבר הראשון הוא טבלת טקסט של "Controls"; אחריה עוד כעשרים שורות בלי לשוניות.',
        'מילים של מפתח: Field of view, Film grain, Depth of field, Copy diagnostics.',
        'מתגים בגובה 30px וכפתורי בחירה 36–38px – מתחת ל־44.',
        'במשחק הוא נכנס מהצד כמסך מלא – לא גיליון מלמטה כמו כל חלון אחר.',
      ],
      idea: 'הגדרות אחת לשני המקומות: לשוניות (צליל · תמונה · שליטה · עזרה), מתגים ומחוונים גדולים, הנפוץ למעלה, והטכני תחת "מתקדם".',
      priority: 2,
      shots: { upright: 'בזמן משחק', 'upright-2': 'בפתיחה', sideways: 'בזמן משחק, לרוחב', 'sideways-2': 'בפתיחה, לרוחב' },
    },

    // ── notices ──
    {
      id: 'first-steps',
      name: 'צעדים ראשונים',
      area: 'הודעות',
      where: 'src/ui/Hud.tsx (FirstHint, RoomTitle)',
      grade: 'redo',
      works: 'שורה שקטה שלא חוסמת, ושם החדר נכנס כמו כותרת של סרט.',
      wrong: ['כל ההדרכה היא משפט אחד לשבע שניות, ואז הוא נעלם לתמיד.', 'המשפט מסביר שלושה דברים בבת אחת, במילים, ולא מצביע על הכפתורים.', 'חווה חדשה לא אומרת מה עושים קודם: לשתול, לקצור, למכור.'],
      idea: 'שלושה צעדים קטנים, כל אחד כשצריך: אצבע על המקל ("ללכת"), טבעת על הכפתור העגול ("לשתול"), ואז המצפן ("זה מוכן") – וכל צעד נעלם כשעשית אותו.',
      priority: 1,
    },
    {
      id: 'toast',
      name: 'הודעה קצרה',
      area: 'הודעות',
      where: 'src/ui/Hud.tsx (toast) · TopStack.tsx',
      grade: 'good',
      works: 'תמונה ומעט מילים, במקום קבוע מתחת למצפן, ונעלמת לבד.',
      wrong: ['חלק מההודעות משפטים ארוכים ("Goal reached: … — claim it on the board") ל־2.2 שניות.', 'רווח, אזהרה (המחסן מלא) ומידע נראים אותו דבר.'],
      idea: 'להשאיר. שלושה סוגים בצבעי המשחק (רווח, אזהרה, מידע), עד חמש מילים, ואזהרה נשארת עד שנוגעים.',
      priority: 3,
    },
    {
      id: 'level-up',
      name: 'עלייה ברמה ובגד חדש',
      area: 'הודעות',
      where: 'src/farm/XpChip.tsx (LevelUp) · Xp.css',
      grade: 'good',
      works: 'רגע חגיגי אחד: הבזק, טבעת והמספר החדש, ואחריו הבגד בכרטיס משלו; שום דבר לא חוסם.',
      wrong: ['כבר במשחק: המטבעות של הרמה עפים מהמספר לצ׳יפ המטבעות, והמתנה (חומרי בנייה) קופצת ועפה למחסן; הצ׳יפ של הרמה זוהר כשמחכות קופסאות.'],
      idea: 'להשאיר. בסוף הרגע המטבעות קופצים אל שבב הרמה, כדי שיהיה ברור איפה אוספים.',
      priority: 3,
      shots: { upright: 'רמה חדשה', 'upright-2': 'בגד חדש', sideways: 'רמה, לרוחב', 'sideways-2': 'בגד, לרוחב' },
    },
    {
      id: 'errors',
      name: 'תקלות',
      area: 'הודעות',
      where: 'src/ui/Intro.tsx (Failure) · GraphicsNotice.tsx',
      grade: 'fix',
      works: 'אומר מה קרה, מציע מה לנסות, ומאפשר להעתיק פרטים לדיווח.',
      wrong: [
        'בפתיחה: בלוק טקסט ורוד, ומתחתיו כפתור אפור "Unavailable here".',
        'שלושה כפתורים באותו גודל (Try again, Try light graphics, Copy details).',
        'במשחק: "Continue" ו־"Reload" הם קישורים קטנים, לא כפתורים בגודל אצבע.',
      ],
      idea: 'כרטיס תקלה אחד בשפת המשחק: תמונה, משפט אחד, כפתור ראשי אחד ("לנסות שוב") והשאר קטן מתחת – בפתיחה ובמשחק.',
      priority: 2,
      shots: { upright: 'בפתיחה', 'upright-2': 'במשחק: הגרפיקה חזרה', sideways: 'בפתיחה, לרוחב', 'sideways-2': 'במשחק, לרוחב' },
    },
  ],
}
