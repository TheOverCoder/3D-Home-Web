import { BOARDS } from '../boards'
import { MAP } from '../map'
import { useReviews } from '../play/reviews'
import audit from '../audit.json'
import check from '../check.json'

// The lab's status (#status): what was checked and works, what the automatic check found in the designs, what the
// user has said so far (live, from the lab's database), what is not perfect yet, and how it reaches the designer. The
// checks are scripts/lab-check.mjs (the lab used end to end: lab/check.json) and scripts/lab-audit.mjs (every screen of
// every board: lab/audit.json); run them again after a change and publish.

interface Finding {
  screens: number
  errors: string[]
  blank: string[]
  scroll: string[]
  small: string[]
  tiny: string[]
  under: string[]
  off: string[]
}
const FINDINGS: { key: keyof Omit<Finding, 'screens'>; say: string }[] = [
  { key: 'errors', say: 'שגיאות בדף' },
  { key: 'blank', say: 'מסך ריק' },
  { key: 'scroll', say: 'הדף גולש וצריך לגלול' },
  { key: 'off', say: 'כפתור מחוץ למסך' },
  { key: 'small', say: 'כפתור קטן מאצבע (פחות מ־44 פיקסלים)' },
  { key: 'tiny', say: 'טקסט קטן מ־13 פיקסלים' },
  { key: 'under', say: 'כפתור מתחת לחריץ או לפס הבית של הטלפון' },
]

const when = (iso: string) => new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
const letter = (id: string) => (id === 'today' ? 'היום' : id.toUpperCase())

/** What is not perfect yet, said plainly (kept up to date by hand when one is fixed or found). */
const LIMITS = [
  'בסבב האחרון המעצב לא חיפש באינטרנט: כלי החיפוש שהוספתי לו מתחילים לעבוד מהסשן הבא. ה"מחקר" בלוחות האלה הוא מהידע שלו.',
  'ב"היום" של מסך הטעינה, מסך הפתיחה והחלק העליון מוצגת תמונה מהמשחק ולא המסך החי, כי הם תלויים במשחק עצמו. בחלון הרמה "היום" הוא החלון החי.',
  "בטלפון לרוחב, כשהמסך צר מהתמונה של המשחק, התמונה נחתכת מימין (הצ'יפים שבשמאל נשארים).",
  'הצילום פריים אחר פריים של אנימציות לפעמים לא מדויק בדהייה של ספריית התנועה; כשזה קורה המעצב בודק בזמן אמת.',
  'הסימונים שלך נשמרים במאגר של הקישור. כשהמעבדה רצה במחשב שלי בלי הקישור, הם נשמרים רק בדפדפן.',
  'כדי שהעיצובים ייכנסו למשחק, חסרים בו כמה נתונים: רמה לכל חווה ברשימת החוות, "מה מוכן עכשיו" לכל חווה, טיפים למסך הטעינה, ותמונה קטנה של הבית שנטענת לפני כל השאר.',
]

export function StatusView({ onPage }: { onPage: (hash: string) => void }) {
  const r = useReviews()
  const boards = audit.boards as Record<string, Finding>
  const steps = check.steps
  const passed = steps.filter((s) => s.ok).length
  const screens = Object.values(boards).reduce((n, b) => n + b.screens, 0)
  const broken = Object.values(boards).reduce((n, b) => n + b.errors.length + b.blank.length + b.scroll.length + b.off.length, 0)
  const variants = BOARDS.reduce((n, b) => n + b.variants.filter((v) => v.id !== 'today').length, 0)
  const states = BOARDS.reduce((n, b) => n + b.states.length, 0)
  const allGood = passed === steps.length && broken === 0
  // the same step on each screen as one line, with a mark for each screen
  const whats = [...new Set(steps.map((s) => s.what))]
  const screensChecked = [...new Set(steps.map((s) => s.screen))]
  const requested = Object.keys(r.requests).filter((k) => r.requests[k])
  const nameOf = (id: string) => MAP.screens.find((s) => s.id === id)?.name ?? id
  return (
    <section className="board status-page" aria-labelledby="status-title">
      <header className="board-head">
        <div className="title-row">
          <h2 id="status-title">מצב המערכת</h2>
          <span className={`status ${allGood ? 'live' : 'choose'}`}>{allGood ? 'הכל עובד' : 'יש מה לתקן'}</span>
        </div>
        <p className="lede">בדיקה אחרונה: {when(check.at)}. כל מה שכתוב כאן נבדק אוטומטית, מסך אחרי מסך, בטלפון לאורך, לרוחב ובמחשב.</p>
      </header>

      <div className="tiles">
        <div className="tile">
          <b>{BOARDS.length}</b>
          <span>לוחות</span>
        </div>
        <div className="tile">
          <b>{variants}</b>
          <span>הצעות</span>
        </div>
        <div className="tile">
          <b>{states}</b>
          <span>מצבים</span>
        </div>
        <div className="tile">
          <b>{screens}</b>
          <span>מסכים שנבדקו</span>
        </div>
        <div className={`tile ${broken ? 'bad' : 'good'}`}>
          <b>{broken}</b>
          <span>תקלות</span>
        </div>
        <div className={`tile ${passed === steps.length ? 'good' : 'bad'}`}>
          <b>
            {passed}/{steps.length}
          </b>
          <span>פעולות שעובדות</span>
        </div>
      </div>

      <h3 className="status-h">מה בדקתי שעובד</h3>
      <div className="checks">
        {whats.map((what) => (
          <div key={what} className="check-row">
            <span className="check-what">{what}</span>
            <span className="check-marks">
              {screensChecked.map((sc) => {
                const s = steps.find((x) => x.what === what && x.screen === sc)
                return (
                  <span key={sc} className={`mark-chip ${s ? (s.ok ? 'ok' : 'no') : 'none'}`} title={s?.detail}>
                    {s ? (s.ok ? '✓' : '✗') : '–'} {sc}
                  </span>
                )
              })}
            </span>
          </div>
        ))}
      </div>

      <h3 className="status-h">מה הבדיקה האוטומטית מצאה בעיצובים</h3>
      <p className="lede">כל לוח נבדק בכל הצעה ובכל מצב. מה שמופיע כאן הוא לתיקון של המעצב בסבב הבא, לא תקלה במערכת.</p>
      <div className="audit">
        {BOARDS.map((b) => {
          const f = boards[b.id]
          if (!f) return null
          const found = FINDINGS.filter((x) => f[x.key].length > 0)
          return (
            <article key={b.id} className={`audit-card${found.length ? '' : ' clean'}`}>
              <header>
                <b>{b.title}</b>
                <small>{f.screens} מסכים</small>
                <button className="link-btn" onClick={() => onPage(b.id)}>
                  זה לצד זה ←
                </button>
              </header>
              {found.length === 0 ? (
                <p>✓ הכל תקין</p>
              ) : (
                <ul>
                  {found.map((x) => (
                    <li key={x.key}>
                      {x.say}: <b>{f[x.key].length}</b>
                      <details>
                        <summary>איפה</summary>
                        <code dir="ltr">{f[x.key].slice(0, 12).join('\n')}</code>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )
        })}
      </div>

      <h3 className="status-h">מה סימנת עד עכשיו</h3>
      <p className={`keeping ${r.keeping}`}>{r.keeping === 'shared' ? '✓ נקרא עכשיו מהמאגר של הקישור' : r.keeping === 'local' ? 'כאן רואים רק מה שנשמר בדפדפן הזה' : 'מתחבר…'}</p>
      <div className="marks-list">
        {BOARDS.map((b) => {
          const rv = r.review(b.id)
          const marks = Object.entries(rv.verdicts)
          return (
            <div key={b.id} className="marks-row">
              <b>{b.title}</b>
              <span>
                {marks.length === 0 && rv.notes.length === 0 ? (
                  <i className="quiet">עוד לא סימנת</i>
                ) : (
                  <>
                    {marks.map(([v, x]) => (
                      <span key={v} className={`mark-chip ${x === 'yes' ? 'ok' : 'no'}`}>
                        {x === 'yes' ? '✓' : '✗'} {letter(v)}
                      </span>
                    ))}
                    {rv.notes.length > 0 && <span className="mark-chip">💬 {rv.notes.length}</span>}
                  </>
                )}
              </span>
            </div>
          )
        })}
      </div>
      {requested.length > 0 && (
        <>
          <p className="lede">ביקשת עיצוב ל־{requested.length} מסכים:</p>
          <div className="req-chips">
            {requested.map((id) => (
              <span key={id} className={`mark-chip${BOARDS.some((b) => b.screen === id) ? ' ok' : ''}`}>
                {BOARDS.some((b) => b.screen === id) ? '✓ ' : ''}
                {nameOf(id)}
              </span>
            ))}
          </div>
        </>
      )}

      <h3 className="status-h">מה עוד לא מושלם</h3>
      <ul className="limits">
        {LIMITS.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

      <h3 className="status-h">איך מה שסימנת מגיע למעצב</h3>
      <ol className="limits">
        <li>מה שמסמנים בארגז החול (✓, ✗, הערות, נקודות, בקשות) נשמר במאגר של הקישור.</li>
        <li>אני קורא אותו ושם אותו בקובץ למעצב (lab/feedback), לפני כל סבב.</li>
        <li>המעצב עונה על כל הערה בשורה "מה חדש" של הלוח, ולא משאיר ✗ בלי תשובה.</li>
      </ol>
    </section>
  )
}
