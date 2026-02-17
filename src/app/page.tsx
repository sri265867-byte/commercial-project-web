"use client"

import { useState } from "react"
import { CreateVideoTab } from "@/components/create-video-tab"
import { MotionControlTab } from "@/components/motion-control-tab"
import { ShopTab } from "@/components/shop-tab"

type Tab = "create" | "motion" | "shop"

const tabs: { id: Tab; label: string }[] = [
  { id: "create", label: "Создать видео" },
  { id: "motion", label: "Motion Control" },
  { id: "shop", label: "Магазин" },
]

export default function Page() {
  const [activeTab, setActiveTab] = useState<Tab>("create")

  return (
    <main className="h-[var(--tg-viewport-stable-height,100dvh)] bg-background max-w-md mx-auto flex flex-col pt-safe pb-safe overflow-hidden">
      {/* Tab Navigation - Optimized for touch */}
      <nav className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/10">
        <div className="flex items-center justify-around px-2 pt-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-3 text-[14px] transition-colors whitespace-nowrap min-w-[30%] flex justify-center ${activeTab === tab.id
                ? "text-white font-bold"
                : "text-white/40 font-medium hover:text-white/60 active:text-white/50"
                }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-t-full mx-4" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab Content — keep all tabs mounted, show/hide via CSS */}
      <div className="flex-1 px-4 pt-4 overflow-y-auto">
        <div style={{ display: activeTab === "create" ? "block" : "none" }}>
          <CreateVideoTab />
        </div>
        <div style={{ display: activeTab === "motion" ? "block" : "none" }}>
          <MotionControlTab />
        </div>
        <div style={{ display: activeTab === "shop" ? "block" : "none" }}>
          <ShopTab />
        </div>
      </div>
    </main>
  )
}
