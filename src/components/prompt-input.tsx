"use client"

import { useRef, useCallback, useEffect } from "react"

interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
}

export function PromptInput({ value, onChange, placeholder, hint }: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize: reset height to auto, then set to scrollHeight (capped by CSS max-height)
  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [])

  // Re-calc on every value change (including external resets like effect selection)
  useEffect(() => {
    autoResize()
  }, [value, autoResize])

  return (
    <div className="w-full rounded-2xl bg-[#161616] border border-white/[0.06] p-4">
      <label htmlFor="prompt-textarea" className="block text-sm font-semibold text-white mb-1.5">
        Промпт
      </label>
      <textarea
        id="prompt-textarea"
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Describe the scene you want to create..."}
        className="w-full bg-transparent text-sm text-white/60 placeholder:text-white/25 resize-none outline-none leading-relaxed pr-1"
        rows={3}
        style={{ minHeight: "56px", maxHeight: "176px", overflow: "auto" }}
      />
      <p className="text-[10px] text-white/20 mt-1.5">
        {hint || "✏️ Пишите промпт на английском языке"}
      </p>
    </div>
  )
}

