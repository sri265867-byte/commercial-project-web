"use client"

import { useState } from "react"
import { ChevronRight, X, Check } from "lucide-react"
import { type ModelId, models, modelList } from "@/lib/models"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer"

interface ModelSelectorProps {
  selectedModel: ModelId
  onSelectModel: (model: ModelId) => void
}

export function ModelSelector({ selectedModel, onSelectModel }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const model = models[selectedModel]

  return (
    <>
      {/* Trigger Row */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#161616] border border-white/[0.06] hover:bg-[#1c1c1c] transition-colors"
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[11px] text-white/35">Модель</span>
          <span className="text-[15px] font-semibold text-white">{model.name}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-white/30" />
      </button>

      {/* Bottom Sheet via Drawer */}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <DrawerTitle className="text-base">Выберите модель</DrawerTitle>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Model List */}
          <div className="flex flex-col gap-2">
            {modelList.map((modelId) => {
              const m = models[modelId]
              const isSelected = modelId === selectedModel

              return (
                <button
                  type="button"
                  key={modelId}
                  onClick={() => {
                    onSelectModel(modelId)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition-colors ${isSelected
                    ? "bg-[#c8ff00]/10 border border-[#c8ff00]/20"
                    : "bg-white/[0.04] border border-transparent hover:bg-white/[0.07]"
                    }`}
                >
                  <div>
                    <span className={`text-sm font-semibold ${isSelected ? "text-[#c8ff00]" : "text-white"}`}>
                      {m.name}
                    </span>
                  </div>
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
