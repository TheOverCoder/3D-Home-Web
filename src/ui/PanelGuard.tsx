import { Component, useSyncExternalStore, type ErrorInfo, type ReactNode } from 'react'
import { useHome } from '../store'

// A panel that throws closes, and the game plays on (update-v1/CONTRACTS.md §1.5). In React 19 an error while drawing
// any part of the interface unmounts the whole page, the 3D scene with it; round each panel's slot a guard catches it
// instead: what was open closes (the panel, by default), a toast says "That didn't open properly", and the error goes
// into the diagnostics (Settings → Copy diagnostics: src/lib/diagnostics.ts keeps the console's errors). The guard draws
// nothing then, and once what it holds changes (the next panel), it draws again from fresh. Round a layer of the screen
// (the HUD, the corner menu, the dashboard) the layer is left out, with no word, and drawn again once what is over the
// game changes (a panel opened or closed, the settings, a mode, the map, the view): a few times a page at most, so a
// layer that fails every time stays out. A guard goes outside a panel's sheet, never inside it.

/** The toast when a panel could not open. */
export const DIDNT_OPEN = "That didn't open properly"

/** How many times a layer that failed is drawn again in one page, at most. */
export const LAYER_TRIES = 3

/** What is over the game, as one value: a layer that failed is drawn again when it changes. */
const sceneOf = (s: ReturnType<typeof useHome.getState>) => [s.phase, s.map, s.view, s.panel?.kind, s.settingsOpen, s.screen, s.editing, s.decorating].join('|')

// For the tests (?debug: `__home.guard.fail(name)`): a fault armed under a guard's name throws inside that guard the
// next time it draws with that name — at once for a layer; for a panel's slot, as that panel opens — as a part with a
// bug would. It is disarmed once the guard has caught it.
const armed = new Set<string>()
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((f) => f())
const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => listeners.delete(f)
}
export const guardHooks = {
  fail(name: string) {
    armed.add(name)
    changed()
  },
}

function Fault({ name }: { name: string }) {
  if (useSyncExternalStore(subscribe, () => armed.has(name))) throw new Error(`[test] a fault in "${name}"`)
  return null
}

interface GuardProps {
  name: string
  scene: string
  layer: boolean
  close?: () => void
  children: ReactNode
}

interface GuardState {
  failed: boolean
  /** what it held, and what was over the game, when it failed (set once the error is caught) */
  as: { name: string; scene: string } | null
  /** how many times it failed (a layer is drawn again only LAYER_TRIES times) */
  tries: number
}

const said = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e))

class Guard extends Component<GuardProps, GuardState> {
  state: GuardState = { failed: false, as: null, tries: 0 }

  static getDerivedStateFromError(): Partial<GuardState> {
    return { failed: true, as: null }
  }

  /** Drawn again: a panel's guard once it holds something else (the panel closed, or another opened), a layer's once
   *  what is over the game changed — never before the error was caught and what it failed with is known. */
  static getDerivedStateFromProps(p: GuardProps, s: GuardState): Partial<GuardState> | null {
    if (!s.failed || !s.as) return null
    const again = p.layer ? p.scene !== s.as.scene && s.tries <= LAYER_TRIES : p.name !== s.as.name
    return again ? { failed: false, as: null } : null
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const { name, scene, layer, close } = this.props
    armed.delete(name)
    this.setState((s) => ({ as: { name, scene }, tries: s.tries + 1 }))
    console.error(`[3d-home] "${name || 'nothing open'}" failed and was ${layer ? 'left out' : 'closed'}: ${said(error)}`, info.componentStack ?? '')
    if (layer) return
    // (closed from here: what the player was in goes, the rest of the game stays)
    if (name) useHome.getState().showToast(DIDNT_OPEN)
    ;(close ?? useHome.getState().closePanel)()
  }

  render() {
    if (this.state.failed) return null
    return (
      <>
        <Fault name={this.props.name} />
        {this.props.children}
      </>
    )
  }
}

/**
 * Keeps an error in what it holds from taking the game down. `name`: what it holds now (a panel's kind; '' while
 * nothing is open): the error says which, and it is drawn again once that changes. `close`: what closes it when it
 * throws (the panel open, by default). `layer`: a part of the screen, not something opened: left out quietly, and
 * drawn again once what is over the game changes.
 */
export function PanelGuard({ name, children, close, layer = false }: { name: string; children: ReactNode; close?: () => void; layer?: boolean }) {
  const scene = useHome((s) => (layer ? sceneOf(s) : ''))
  return (
    <Guard name={name} scene={scene} layer={layer} close={close}>
      {children}
    </Guard>
  )
}
