// A new board in the design lab, ready to fill: lab/boards/<id>/ with its board (index.tsx) and a first variant (its
// component and CSS file), listed in lab/boards.ts. It shows at once in the sandbox — ringed on the game's screen when
// it names a spot, and in the list of screens when it names its map screen — and side by side (#<id>).
//
//   node scripts/lab-new.mjs <id> "<title, in Hebrew>" [--spot level] [--screen level] [--ask "<the user's words>"]
//
// Spots are the game's chips and buttons in lab/stills/<still>.json (coins, line, store, goals, day, level, settings…);
// screens are the ids of lab/map.ts.
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { args } from './lab-tools.mjs'

const a = args()
const [id, title] = a._
if (!id || !title || !/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('usage: node scripts/lab-new.mjs <id: lower-case-words> "<title>" [--spot s] [--screen s] [--ask "…"]')
const lab = join(dirname(fileURLToPath(import.meta.url)), '../lab')
const dir = join(lab, 'boards', id)
if (existsSync(dir)) throw new Error(`lab/boards/${id} is there already`)
const name = id.replace(/-(\w)/g, (_, c) => c.toUpperCase())
const Name = name[0].toUpperCase() + name.slice(1)
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

await mkdir(dir, { recursive: true })
await writeFile(
  join(dir, 'index.tsx'),
  `import type { Board } from '../../board'
import { ${Name}A } from './${Name}A'

// ${title}: what the piece of the interface is, and where the game has it (its component and CSS). Its states come
// from the game's own pure code, never numbers the game cannot make; "today" draws the game's own component.

export interface ${Name}State {
  /** what the piece shows (from the game's pure code) */
  label: string
}

export const ${name}Board: Board<${Name}State> = {
  id: ${q(id)},
  title: ${q(title)},
  ask: ${q(a.ask ?? 'הבקשה, במילים של המשתמש')},
  status: 'choose',
  still: 'yard',${a.spot ? `\n  spot: ${q(a.spot)},` : ''}${a.screen ? `\n  screen: ${q(a.screen)},` : ''}
  states: [{ id: 'first', name: 'המצב הראשון', data: { label: ${q(title)} } }],
  variants: [
    {
      id: 'a',
      name: 'שם קצר',
      note: 'מה שונה בהצעה הזאת, בשורה או שתיים.',
      motion: 'מה זז ומתי: הפתיחה, הלחיצה, הרגע של המסך.',
      render: (s, act) => <${Name}A s={s} onClose={act.close} />,
    },
  ],
}
`,
)
await writeFile(
  join(dir, `${Name}A.tsx`),
  `import { m } from 'motion/react'
import { Shell } from '../../../src/ui/Shell'
import { PRESS, SPRING } from '../../../src/ui/motion'
import type { ${Name}State } from './index'
import './${Name}A.css'

// A · <its name>: what it shows first, and how it moves. Every rule of its CSS is under .v-${id}-a.

export function ${Name}A({ s, onClose }: { s: ${Name}State; onClose: () => void }) {
  return (
    <Shell title={s.label} onClose={onClose}>
      <m.div className="v-${id}-a" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={SPRING.sheet}>
        <m.button className="btn primary" {...PRESS} onClick={onClose}>
          OK
        </m.button>
      </m.div>
    </Shell>
  )
}
`,
)
await writeFile(join(dir, `${Name}A.css`), `/* A · <its name> (./${Name}A.tsx) */\n.v-${id}-a { display: grid; gap: 12px; }\n`)

const list = join(lab, 'boards.ts')
const was = await readFile(list, 'utf8')
const now = was
  .replace(/(import \{ \w+ \} from '\.\/boards\/[\w-]+'\n)(?![\s\S]*import \{ \w+ \} from '\.\/boards\/)/, `$1import { ${name}Board } from './boards/${id}'\n`)
  .replace(/export const BOARDS: Board<any>\[\] = \[/, `export const BOARDS: Board<any>[] = [${name}Board, `)
if (now === was) throw new Error('could not list it in lab/boards.ts: add it by hand')
await writeFile(list, now)
console.log(`lab/boards/${id}: index.tsx, ${Name}A.tsx, ${Name}A.css — listed in lab/boards.ts. In the sandbox: ${a.spot ? `ringed on "${a.spot}"` : 'in the list'}.`)
