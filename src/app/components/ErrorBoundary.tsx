import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ProjectVault Uncaught Render Error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleHome = () => {
    window.location.href = '/projects'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-screen items-center justify-center bg-bg p-6">
          <div className="w-full max-w-md rounded-dialog border border-line bg-surface p-6 shadow-dialog text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-danger-soft text-danger">
              <AlertCircle className="size-6" />
            </div>
            <h1 className="mt-4 text-lg font-semibold tracking-tight text-fg">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted">
              {this.state.error?.message || 'An unexpected rendering error occurred in ProjectVault.'}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-control bg-fg px-4 text-xs font-semibold text-white transition hover:bg-[#26262c]"
              >
                <RefreshCw className="size-3.5" />
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleHome}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-control border border-line-strong bg-surface px-4 text-xs font-medium text-fg hover:bg-surface-2"
              >
                Return to Projects
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
