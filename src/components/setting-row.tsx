"use client"

import { useState } from "react"
import { ChevronRight, X, Check } from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer"

interface SettingRowProps {
  label: string
  value: string
  options?: string[]
  onSelect?: (value: string) => void
  readOnly?: boolean
}

export function SettingRow({ label, value, options, onSelect, readOnly }: SettingRowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const hasOptions = !readOnly && options && options.length > 0

  return (
    <>
      <button
        type="button"
        onClick={hasOptions ? () => setIsOpen(true) : undefined}
        className={`w-full flex items-center justify-between p-4 rounded-2xl bg-[#161616] border border-white/[0.06] transition-colors ${hasOptions ? "hover:bg-[#1c1c1c] cursor-pointer" : "cursor-default"
          }`}
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[11px] text-white/35">{label}</span>
          <span className="text-[15px] font-semibold text-white">{value}</span>
        </div>
        {hasOptions && <ChevronRight className="w-4 h-4 text-white/30" />}
      </button>

      {/* Bottom Sheet via Drawer */}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent>
          <div className="flex items-center justify-between mb-5">
            <DrawerTitle className="text-base">{label}</DrawerTitle>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {options?.map((option) => {
              const isSelected = option === value
              return (
                <button
                  type="button"
                  key={option}
                  onClick={() => {
                    onSelect?.(option)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-colors ${isSelected
                      ? "bg-[#c8ff00]/10 text-[#c8ff00] border border-[#c8ff00]/20"
                      : "text-white bg-white/[0.04] border border-transparent hover:bg-white/[0.07]"
                    }`}
                >
                  {option}
                  {isSelected && <Check className="w-4 h-4 text-[#c8ff00]" />}
                </button>
              )
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
