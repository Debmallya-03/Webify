"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, X, ChevronLeft, Loader2, AlertCircle, RotateCcw, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface GeneratedCode {
  html: string
  css: string
  javascript: string
}

interface AIAssistantProps {
  onGenerate: (code: GeneratedCode) => void
  theme?: "light" | "dark"
}

const PROMPT_SUGGESTIONS = [
  "A responsive portfolio website with dark theme",
  "A modern pricing page with 3 tiers",
  "An animated landing page for a SaaS product",
  "A to-do app with local storage",
  "A CSS-only accordion FAQ section",
]

export default function AIAssistant({ onGenerate, theme }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastPrompt, setLastPrompt] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [prompt])

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 150)
  }, [isOpen])

  const handleGenerate = async (overridePrompt?: string) => {
    const finalPrompt = (overridePrompt ?? prompt).trim()
    if (!finalPrompt) return

    setIsLoading(true)
    setError(null)
    setLastPrompt(finalPrompt)

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.")

      onGenerate({
        html: data.html ?? "",
        css: data.css ?? "",
        javascript: data.javascript ?? "",
      })

      setPrompt("")
      toast.success("Code generated!", { description: "Your editors have been updated." })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate code."
      setError(message)
      toast.error("Generation failed", { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleGenerate()
    }
  }

  const handleSuggestion = (suggestion: string) => {
    setPrompt(suggestion)
    textareaRef.current?.focus()
  }

  return (
    <>
      {/* Floating button — bottom left */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
        className={`
          fixed bottom-6 left-16 z-40
          flex items-center gap-2
          px-4 py-3 rounded-2xl
          font-semibold text-sm
          shadow-xl border
          transition-all duration-200 select-none
          hover:scale-105 active:scale-95
          ${isOpen
            ? "bg-blue-600 text-white border-blue-700"
            : theme === "dark"
              ? "bg-gray-800 text-blue-400 border-gray-700 hover:bg-gray-700"
              : "bg-white text-blue-600 border-gray-200 hover:bg-blue-50"
          }
        `}
      >
        <Wand2 className="w-4 h-4" />
        <span>AI</span>
      </button>

      {/* Sidebar — slides in from left */}
      <div
        className={`
          fixed top-14 left-0 h-[calc(100%-3.5rem)] z-30
          flex flex-col w-80 sm:w-96
          shadow-2xl border-r
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${theme === "dark"
            ? "bg-gray-900 border-gray-700 text-gray-100"
            : "bg-white border-gray-200 text-gray-900"
          }
        `}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${
          theme === "dark" ? "border-gray-700 bg-gray-800/80" : "border-gray-200 bg-gradient-to-r from-blue-50 to-white"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-md">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">AI Assistant</p>
              <p className={`text-[11px] mt-0.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                Powered by Groq
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className={`p-1.5 rounded-lg transition-colors ${
              theme === "dark" ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"
            }`}
            aria-label="Close AI Assistant"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

          {/* Prompt input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="ai-prompt" className={`text-xs font-semibold uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
              Describe your website
            </label>
            <div className={`rounded-xl border-2 transition-colors ${
              theme === "dark"
                ? "border-gray-700 bg-gray-800 focus-within:border-blue-500"
                : "border-gray-200 bg-gray-50 focus-within:border-blue-400 focus-within:bg-white"
            }`}>
              <textarea
                id="ai-prompt"
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. A dark landing page for a music streaming app with animated hero section..."
                rows={3}
                disabled={isLoading}
                className="w-full resize-none rounded-xl px-3 py-2.5 text-sm bg-transparent outline-none placeholder:text-gray-400 disabled:opacity-50 leading-relaxed"
              />
              <div className={`flex items-center justify-between px-3 pb-2 text-[11px] ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                <span>{prompt.length > 0 ? `${prompt.length} chars` : "Tip: be specific for better results"}</span>
                <span className="font-mono">⌘↵ generate</span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className={`flex gap-2 p-3 rounded-xl border text-sm ${
              theme === "dark" ? "bg-red-950/50 border-red-800 text-red-300" : "bg-red-50 border-red-200 text-red-700"
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs mb-0.5">Generation failed</p>
                <p className="text-xs leading-relaxed opacity-80">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss error">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Suggestions */}
          <div className="flex flex-col gap-2">
            <p className={`text-xs font-semibold uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
              Try these
            </p>
            <div className="flex flex-col gap-1.5">
              {PROMPT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  disabled={isLoading}
                  className={`
                    group text-left text-xs px-3 py-2.5 rounded-xl border transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2
                    ${theme === "dark"
                      ? "border-gray-700 bg-gray-800/60 hover:bg-gray-700 hover:border-blue-500 text-gray-300"
                      : "border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 text-gray-600"
                    }
                  `}
                >
                  <Sparkles className={`w-3 h-3 shrink-0 transition-colors ${theme === "dark" ? "text-gray-600 group-hover:text-blue-400" : "text-gray-400 group-hover:text-blue-500"}`} />
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <p className={`text-[11px] leading-relaxed px-3 py-2 rounded-lg border ${
            theme === "dark" ? "text-gray-500 border-gray-800 bg-gray-800/40" : "text-gray-400 border-gray-100 bg-gray-50"
          }`}>
            This will replace your current code. Download your project first to keep your work.
          </p>
        </div>

        {/* Footer */}
        <div className={`shrink-0 px-4 py-3 border-t ${
          theme === "dark" ? "border-gray-700 bg-gray-800/80" : "border-gray-200 bg-gray-50"
        }`}>
          <div className="flex gap-2">
            {lastPrompt && !isLoading && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGenerate(lastPrompt)}
                title="Regenerate with same prompt"
                className="h-10 w-10 p-0 shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
            <Button
              onClick={() => handleGenerate()}
              disabled={isLoading || prompt.trim().length === 0}
              className="flex-1 h-10 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
              ) : (
                <><Wand2 className="w-4 h-4" />Generate Code</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}