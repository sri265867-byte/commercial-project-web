"use client"

import React from "react"
import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { ArrowLeft, Search, X } from "lucide-react"
import { type ModelId, models } from "@/lib/models"
import {
  type Effect,
  getEffectsForModel,
} from "@/lib/effects/index"

// ─── Global poster cache ─────────────────────────────────────────────────────
const effectPosterCache = new Map<string, string>()

// ─── EffectCard ──────────────────────────────────────────────────────────────

interface EffectCardProps {
  effect: Effect
  onSelect?: (effect: Effect) => void
  eagerMount?: boolean
}

const EffectCard = React.memo(function EffectCard({
  effect,
  onSelect,
  eagerMount = false,
}: EffectCardProps) {
  const containerRef = useRef<HTMLButtonElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [shouldMount, setShouldMount] = useState(eagerMount)
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const posterUrl = effectPosterCache.get(effect.id) ?? null

  // IntersectionObserver: mount/unmount video based on viewport proximity
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (unmountTimerRef.current) {
            clearTimeout(unmountTimerRef.current)
            unmountTimerRef.current = null
          }
          setShouldMount(true)
        } else {
          unmountTimerRef.current = setTimeout(() => {
            setShouldMount(false)
          }, 500)
        }
      },
      { rootMargin: "600px 0px" }
    )

    observer.observe(container)
    return () => {
      observer.disconnect()
      if (unmountTimerRef.current) {
        clearTimeout(unmountTimerRef.current)
      }
    }
  }, [])

  // Auto-play and poster capture
  useEffect(() => {
    const vid = videoRef.current
    if (!vid || !shouldMount) return

    const handleLoadedData = () => {
      if (!effectPosterCache.has(effect.id)) {
        try {
          const canvas = document.createElement("canvas")
          canvas.width = vid.videoWidth
          canvas.height = vid.videoHeight
          const ctx = canvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
            const dataUrl = canvas.toDataURL("image/webp", 0.6)
            effectPosterCache.set(effect.id, dataUrl)
          }
        } catch {
          // ignore CORS errors
        }
      }
      vid.play().catch(() => { })
    }

    vid.addEventListener("loadeddata", handleLoadedData)
    if (vid.readyState >= 2) handleLoadedData()

    return () => {
      vid.removeEventListener("loadeddata", handleLoadedData)
      vid.pause()
    }
  }, [shouldMount, effect.id])



  const handleSelect = useCallback(() => {
    onSelect?.(effect)
  }, [effect, onSelect])

  return (
    <button
      type="button"
      ref={containerRef}
      className="relative rounded-xl overflow-hidden bg-[#1a1a1a] cursor-pointer group w-full"
      style={{ aspectRatio: "9/16", contain: "layout style paint" }}
      onClick={handleSelect}
    >
      {shouldMount ? (
        <video
          ref={videoRef}
          src={effect.videoUrl}
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 w-full h-full bg-[#1a1a1a]"
          style={
            posterUrl
              ? {
                backgroundImage: `url(${posterUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
              : undefined
          }
        />
      )}

      {/* Gradient overlay - taller for big text */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

      {/* Effect name */}
      <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-bold uppercase text-white leading-[1.15] tracking-wide drop-shadow-lg text-left">
        {effect.name}
      </span>
    </button>
  )
})

// ─── EffectsLibrary ──────────────────────────────────────────────────────────

interface EffectsLibraryProps {
  open: boolean
  onClose: () => void
  currentModel: ModelId
  onSelectEffect?: (effect: Effect) => void
}

export function EffectsLibrary({
  open,
  onClose,
  currentModel,
  onSelectEffect,
}: EffectsLibraryProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const effectiveSearchQuery = open ? searchQuery : ""
  const effectiveShowSearch = open && showSearch

  useEffect(() => {
    if (open) {
      setIsVisible(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
    } else {
      setIsAnimating(false)
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Focus search on open
  useEffect(() => {
    if (showSearch) {
      searchInputRef.current?.focus()
    }
  }, [showSearch])

  const filteredEffects = useMemo(() => {
    let effects = getEffectsForModel(currentModel)
    if (effectiveSearchQuery.trim()) {
      const query = effectiveSearchQuery.toLowerCase()
      effects = effects.filter((e) => e.name.toLowerCase().includes(query))
    }
    return effects
  }, [currentModel, effectiveSearchQuery])


  const handleSelect = useCallback(
    (effect: Effect) => {
      onSelectEffect?.(effect)
      onClose()
    },
    [onSelectEffect, onClose]
  )

  if (!isVisible) return null

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#0a0a0a] transition-transform duration-300 ease-out ${isAnimating ? "translate-y-0" : "translate-y-full"
        }`}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors shrink-0"
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-[15px] font-semibold text-white flex-1">
            Эффекты для {models[currentModel].name}
          </h1>
          {!effectiveShowSearch ? (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors shrink-0"
              aria-label="Поиск"
            >
              <Search className="w-4 h-4 text-white/60" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowSearch(false)
                setSearchQuery("")
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors shrink-0"
              aria-label="Закрыть поиск"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          )}
        </div>

        {/* Search bar */}
        {effectiveShowSearch && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск эффектов..."
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#c8ff00]/30 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-3.5 h-3.5 text-white/30" />
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Content */}
      <div className="overflow-y-auto h-[calc(100vh-52px)]">
        {filteredEffects.length > 0 ? (
          <div className="px-3 pt-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              {filteredEffects.map((effect, index) => (
                <EffectCard
                  key={effect.id}
                  effect={effect}
                  onSelect={handleSelect}
                  eagerMount={index < 6}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-60 gap-3">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center">
              <Search className="w-5 h-5 text-white/20" />
            </div>
            <p className="text-[13px] text-white/30">Эффекты не найдены</p>
          </div>
        )}
      </div>
    </div>
  )
}
