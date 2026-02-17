"use client"

import { useRef, useState, useCallback, useEffect } from "react"

interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function PromptInput({ value, onChange, placeholder }: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const checkScroll = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }, [])

  useEffect(() => {
    checkScroll()
  }, [value, checkScroll])

  return (
    <div className="w-full rounded-2xl bg-[#161616] border border-white/[0.06] p-4">
      <label className="block text-sm font-semibold text-white mb-1.5">
        Промпт
      </label>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={checkScroll}
          placeholder={placeholder || "Опишите сцену, которую хотите создать, с деталями."}
          className="w-full bg-transparent text-sm text-white/60 placeholder:text-white/25 resize-none outline-none min-h-[56px] leading-relaxed pr-1"
          rows={3}
        />
        {/* Fade indicator when more text below */}
        {canScrollDown && (
          <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-[#161616] via-[#161616]/90 to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  )
}
