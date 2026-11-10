import { Script, createContext } from 'node:vm'

// For the unit tests only (Node, never part of the game): a loop that never ends would hang the whole test run, so a
// test that guards against one runs the code through here and is told whether it ended. V8 can stop a script that runs
// past a time limit, the functions it calls included.

const context = createContext({ job: () => {} })
const call = new Script('job()')

/** Runs `fn`, stopped after `ms` if it has not ended by then: whether it ended. Anything it throws is thrown on. */
export function endsWithin(ms: number, fn: () => void): boolean {
  context.job = fn
  try {
    call.runInContext(context, { timeout: ms })
    return true
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') return false
    throw e
  } finally {
    context.job = () => {}
  }
}
