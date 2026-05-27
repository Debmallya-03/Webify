"use client"

/**
 * error-boundary.tsx
 * Place this file at: app/components/error-boundary.tsx
 *
 * Provides three ErrorBoundary wrappers for Webify:
 *   - EditorErrorBoundary  → wraps the Monaco editor panel
 *   - PreviewErrorBoundary → wraps the live-preview iframe panel
 *   - AppErrorBoundary     → outermost safety net for the whole app shell
 *
 * React ErrorBoundaries MUST be class components — hooks cannot catch
 * render-phase errors. This file is intentionally "use client" so it
 * can be imported into the page.tsx client component tree.
 */

import React from "react"
import { AlertTriangle, RefreshCw, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"

// ─── Core ErrorBoundary class ─────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Custom fallback UI — overrides the built-in one when provided */
  fallback?: React.ReactNode
  /** Label shown in the fallback, e.g. "Editor" or "Preview" */
  scope?: string
  /** Optional callback for logging/monitoring */
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[Webify ErrorBoundary:${this.props.scope ?? "Component"}]`,
      error,
      info.componentStack,
    )
    this.props.onError?.(error, info)
  }

  /** Call this to clear the error and re-render children (no full page reload) */
  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <PanelFallback
        scope={this.props.scope ?? "Component"}
        message={this.state.error?.message ?? "An unexpected error occurred."}
        onReset={this.reset}
      />
    )
  }
}

// ─── Panel-level fallback UI (editor / preview) ───────────────────────────────

interface PanelFallbackProps {
  scope: string
  message: string
  onReset: () => void
}

function PanelFallback({ scope, message, onReset }: PanelFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-gray-50 dark:bg-gray-900 p-6 text-center">
      <div className="max-w-sm w-full bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-xl shadow-lg p-6 space-y-4">

        {/* Icon + heading */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {scope} crashed
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              An unexpected error occurred in the {scope.toLowerCase()}.
            </p>
          </div>
        </div>

        {/* Error message */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-4 py-3 text-left">
          <p className="text-xs font-mono text-red-700 dark:text-red-300 break-words line-clamp-4">
            {message}
          </p>
        </div>

        {/* Recovery actions */}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            variant="default"
            size="sm"
            onClick={onReset}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
          >
            <Code2 className="w-4 h-4" />
            Reload editor
          </Button>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Your code is auto-saved and will not be lost.
        </p>
      </div>
    </div>
  )
}

// ─── App-shell crash screen ───────────────────────────────────────────────────

function AppCrashScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-6 text-center">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Webify ran into a problem
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm leading-relaxed">
              The editor crashed unexpectedly. Your code is saved in
              localStorage and will be restored when you reload.
            </p>
          </div>
        </div>

        <Button
          size="lg"
          onClick={() => window.location.reload()}
          className="w-full flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Reload Webify
        </Button>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          If this keeps happening, try clearing your browser cache.
        </p>
      </div>
    </div>
  )
}

// ─── Named convenience wrappers (used in page.tsx) ────────────────────────────

/** Wraps the Monaco editor panel. A crash here keeps the preview alive. */
export function EditorErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary scope="Editor">{children}</ErrorBoundary>
}

/** Wraps the live-preview panel. A crash here never touches the editor. */
export function PreviewErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary scope="Preview">{children}</ErrorBoundary>
}

/**
 * Top-level boundary — last line of defence.
 * Shows a full-page recovery screen instead of a blank white page.
 * Used in page.tsx (NOT layout.tsx, which is a Server Component).
 */
export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary scope="App" fallback={<AppCrashScreen />}>
      {children}
    </ErrorBoundary>
  )
}
