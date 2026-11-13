// The map of the game's interface: every screen that wraps the game (the opening and loading, the screen in play, the
// sheets and cards, the talks with characters, the settings, the notices…) as the game has it today, with the
// designer's verdict and what it proposes, by priority. It is where the next boards come from. Pictures are
// lab/map/<id>-upright.jpg and <id>-sideways.jpg (either or both), from the game itself.

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
}

export const AREAS = ['פתיחה', 'מסך המשחק', 'פעולות', 'חלונות', 'שיחה', 'הגדרות', 'הודעות'] as const

export const MAP: { summary: string; screens: Screen[] } = { summary: '', screens: [] }
