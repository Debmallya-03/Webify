"use client"

import { useEffect, useRef } from "react"
import * as monaco from "monaco-editor"

if (typeof window !== "undefined") {
  window.MonacoEnvironment = {
    getWorkerUrl: function (moduleId: string, label: string) {
      if (label === "json") {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(
          `self.MonacoEnvironment = { baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/' }; importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/language/json/json.worker.js');`
        )}`
      }
      if (label === "css" || label === "scss" || label === "less") {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(
          `self.MonacoEnvironment = { baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/' }; importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/language/css/css.worker.js');`
        )}`
      }
      if (label === "html" || label === "handlebars" || label === "razor") {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(
          `self.MonacoEnvironment = { baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/' }; importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/language/html/html.worker.js');`
        )}`
      }
      if (label === "typescript" || label === "javascript") {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(
          `self.MonacoEnvironment = { baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/' }; importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/language/typescript/ts.worker.js');`
        )}`
      }
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(
        `self.MonacoEnvironment = { baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/' }; importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/base/worker/workerMain.js');`
      )}`
    },
  }
}

interface MonacoEditorProps {
  language: string
  value: string
  onChange: (value: string) => void
  theme?: "light" | "dark"
  /** Receives the editor instance on mount, and `null` on unmount. */
  onEditorReady?: (editor: monaco.editor.IStandaloneCodeEditor | null) => void
}

export default function MonacoEditor({
  language,
  value,
  onChange,
  theme,
  onEditorReady,
}: MonacoEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const statusRef = useRef<HTMLDivElement | null>(null)
  const charCountRef = useRef<HTMLDivElement | null>(null)
  const lineCountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (editorRef.current && !monacoRef.current) {
      // Configure Monaco Editor
      monaco.editor.defineTheme("custom-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#1f2937",
          "editor.foreground": "#f9fafb",
        },
      })

      monaco.editor.defineTheme("custom-light", {
        base: "vs",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#ffffff",
          "editor.foreground": "#374151",
        },
      })

      // Create editor instance
      monacoRef.current = monaco.editor.create(editorRef.current, {
        value,
        language,
        theme: theme === "dark" ? "custom-dark" : "custom-light",
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly: false,
        cursorStyle: "line",
        wordWrap: "on",
        tabSize: 2,
        insertSpaces: true,
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        glyphMargin: false,
        contextmenu: true,
        mouseWheelZoom: true,
        smoothScrolling: true,
        cursorBlinking: "blink",
        cursorSmoothCaretAnimation: "on",
        renderLineHighlight: "line",
        selectOnLineNumbers: true,
        matchBrackets: "always",
        autoClosingBrackets: "always",
        autoClosingQuotes: "always",
        autoSurround: "languageDefined",
        formatOnPaste: true,
        formatOnType: true,
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: "on",
        acceptSuggestionOnCommitCharacter: true,
        snippetSuggestions: "top",
        emptySelectionClipboard: false,
        copyWithSyntaxHighlighting: true,
        multiCursorModifier: "alt",
        accessibilitySupport: "auto",
        quickSuggestions: {
          other: true,
          comments: false,
          strings: false,
        },
      })

      // Listen for content changes
      monacoRef.current.onDidChangeModelContent(() => {
        if (monacoRef.current) {
          const val = monacoRef.current.getValue()
          onChange(val)
          // Update status bar imperatively to avoid re-renders
          updateStatusBar(val)
        }
      })

      // Listen for cursor position changes
      monacoRef.current.onDidChangeCursorPosition(() => {
        if (monacoRef.current) {
          const val = monacoRef.current.getValue()
          updateStatusBar(val)
        }
      })

      // Add keyboard shortcuts
      monacoRef.current.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        // Prevent default save behavior
        console.log("Save shortcut pressed")
      })

      onEditorReady?.(monacoRef.current)
      // Initialize status bar with initial value
      updateStatusBar(value)
    }

    return () => {
      if (monacoRef.current) {
        onEditorReady?.(null)
        monacoRef.current.dispose()
        monacoRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update editor value when prop changes
  useEffect(() => {
    if (monacoRef.current && monacoRef.current.getValue() !== value) {
      monacoRef.current.setValue(value)
      // Immediately update status bar when value prop changes (e.g., tab switch)
      updateStatusBar(value)
    }
  }, [value])

  // Update editor language when prop changes
  useEffect(() => {
    if (monacoRef.current) {
      const model = monacoRef.current.getModel()
      if (model) {
        monaco.editor.setModelLanguage(model, language)
      }
    }
  }, [language])

  // Handle theme changes
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.updateOptions({
        theme: theme === "dark" ? "custom-dark" : "custom-light",
      })
    }
  }, [theme])

  // Helper: compute and render status text
  const updateStatusBar = (text: string) => {
    try {
      const lines = text === "" ? 0 : text.split("\n").length
      const chars = text.length
      
      // Get cursor position
      let line = 1
      let column = 1
      if (monacoRef.current) {
        const pos = monacoRef.current.getPosition()
        if (pos) {
          line = pos.lineNumber
          column = pos.column
        }
      }
      
      // Update individual elements
      if (lineCountRef.current) {
        lineCountRef.current.textContent = `Ln ${line}, Col ${column}`
      }
      if (charCountRef.current) {
        charCountRef.current.textContent = `${chars} chars`
      }
      if (statusRef.current) {
        statusRef.current.textContent = `${lines} lines`
      }
    } catch {
      // swallow errors to avoid breaking editor
    }
  }

  return (
    <div className="h-full w-full flex flex-col min-w-0">
      <div ref={editorRef} className="flex-1 min-h-0 min-w-0" />
      {/* VS Code-style status bar */}
      <div className="h-7 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between px-3 text-xs text-gray-600 dark:text-gray-400 select-none">
        <div className="flex gap-6">
          <div ref={statusRef} className="hover:text-gray-900 dark:hover:text-gray-200 cursor-default" />
          <div ref={lineCountRef} className="hover:text-gray-900 dark:hover:text-gray-200 cursor-default font-mono" />
        </div>
        <div ref={charCountRef} className="hover:text-gray-900 dark:hover:text-gray-200 cursor-default font-mono" />
      </div>
    </div>
  )
}
