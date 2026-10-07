import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback: ReactNode
  onError?: (error: unknown) => void
}

/** Keeps one failing subtree (a missing HDRI, no WebGL...) from blanking the whole app. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.warn('[3d-home] a part of the scene failed to start:', error, info.componentStack)
    this.props.onError?.(error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
