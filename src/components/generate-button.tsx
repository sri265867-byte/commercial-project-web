"use client"

import { Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface GenerateButtonProps {
  cost: number
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
}

export function GenerateButton({ cost, onClick, disabled, loading }: GenerateButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-3.5 h-auto px-6 rounded-full bg-[#c8ff00] text-black font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#d4ff33] active:bg-[#b8ee00] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_24px_rgba(200,255,0,0.25)]"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Генерация...
        </>
      ) : (
        <>
          Создать
          <Sparkles className="w-4 h-4 fill-black" />
          {cost}
        </>
      )}
    </Button>
  )
}
