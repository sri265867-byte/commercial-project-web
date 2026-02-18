"use client"

import React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { ArrowLeft, AudioLines, VolumeOff } from "lucide-react"

interface MotionVideo {
  id: string
  src: string
  poster?: string
}

const MOTION_VIDEOS: MotionVideo[] = [
  { id: "1", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/7c764ec1-9343-48dd-a300-8fb7b2be09a5.mp4" },
  { id: "2", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/55f89edc-767d-49ca-aad3-6ce882b6ee72.mp4" },
  { id: "3", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/c6295691-22c7-47ae-9a52-0922358ca984.mp4" },
  { id: "4", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/e05ab9a7-bd13-4098-9768-100d89dc53ce.mp4" },
  { id: "5", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/45722083-63ea-41fb-9c41-956abf7a5f9d.mp4" },
  { id: "6", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/f3f1068f-60f7-49d9-8256-4ed09c4d20a6.mp4" },
  { id: "7", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/38a58318-780d-41c8-98e8-190106e54eb0.mp4" },
  { id: "8", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/b7d972dc-fa4b-4024-8158-e3ad85bfb5df.mp4" },
  { id: "9", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/d9d7ea02-fdcc-475a-a53e-d3353a8b866e.mp4" },
  { id: "10", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/c1571011-b5f8-4cd0-98d1-149be80bd21a.mp4" },
  { id: "11", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/062dcd0d-2b81-4e82-8757-8bb1cd491581.mp4" },
  { id: "12", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/22287793-7664-4802-b0a3-ba8c0f65f994.mp4" },
  { id: "13", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/1c1ad507-fd7e-45eb-8f20-5436d3e3f238.mp4" },
  { id: "14", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/f232909a-5eff-4515-9547-5478a7c48616.mp4" },
  { id: "15", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/1f72d445-36d9-4df6-90e2-b09c299b9de9.mp4" },
  { id: "16", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/1ad056fe-79aa-4347-afdc-2b4e360fbed1.mp4" },
  { id: "17", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/c079d025-9bc6-401e-8eaa-ec4057e5c304.mp4" },
  { id: "18", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/75c8909f-7873-44d1-bb02-5f09317a11ad.mp4" },
  { id: "19", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/aa86f373-d5c3-4a81-abe6-12b5959b8534.mp4" },
  { id: "20", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/b0aa5384-f5ef-4804-8d3e-393464bc342e.mp4" },
  { id: "21", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/b7b1dabf-b6f7-4b6e-b57a-e49c4e49dc32.mp4" },
  { id: "22", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/3cbb7bc4-1cb0-4930-ae53-6ad1bf5c2ae6.mp4" },
  { id: "23", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/fc0bb74c-2a62-4113-99cb-f0ee05aaacf3.mp4" },
  { id: "24", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/7508928a-5c4c-47f2-81c2-592ebbbdfff2.mp4" },
  { id: "25", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/950b8e26-60d5-46c6-b415-f82e717a5c4e.mp4" },
  { id: "26", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/d23fcbf7-23a6-4799-88ec-decdfb653de4.mp4" },
  { id: "27", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/23dd378e-e15a-4bf8-9d53-f2ecd5641e9d.mp4" },
  { id: "28", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/1c4f77b2-0eb4-481a-b415-1765aaf4f866.mp4" },
  { id: "29", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/d0a6a5a5-0dde-4d2d-bf78-59966da9bafa.mp4" },
  { id: "30", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/289b7f9f-27be-4457-b767-62e4a6aa8b71.mp4" },
  { id: "31", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/7107e003-72c2-408a-aebd-fe635f421389.mp4" },
  { id: "32", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/b9fbbad6-12ee-4b5d-8559-29b8326e5a37.mp4" },
  { id: "33", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/459929b4-b2a9-467b-80d2-ab5939cb2654.mp4" },
  { id: "34", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/79698ca2-09eb-4d5d-b280-4c5779bf20e2.mp4" },
  { id: "35", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/98dbdabd-655f-4731-95e0-11d1dc89ae0d.mp4" },
  { id: "36", src: "https://cdn.higgsfield.ai/kling_motion_control_preset/9f600689-986b-41e8-95cf-3e03b5d377dc.mp4" },
]

// ─── Global poster cache (persists across re-renders) ────────────────────────
const posterCache = new Map<string, string>()

// ─── VideoCard with lazy mount/unmount ───────────────────────────────────────

interface VideoCardProps {
  video: MotionVideo
  isAudioActive: boolean
  onToggleAudio: (videoId: string) => void
  onSelect?: (video: MotionVideo) => void
}

const VideoCard = React.memo(function VideoCard({
  video,
  isAudioActive,
  onToggleAudio,
  onSelect,
}: VideoCardProps) {
  const containerRef = useRef<HTMLButtonElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [shouldMount, setShouldMount] = useState(false)
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const posterUrl = posterCache.get(video.id) ?? null

  // IntersectionObserver: mount/unmount video based on viewport proximity
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Cancel any pending unmount
          if (unmountTimerRef.current) {
            clearTimeout(unmountTimerRef.current)
            unmountTimerRef.current = null
          }
          setShouldMount(true)
        } else {
          // Debounce unmount to prevent flicker during fast scrolling
          unmountTimerRef.current = setTimeout(() => {
            setShouldMount(false)
          }, 500)
        }
      },
      { rootMargin: "200px 0px" }
    )

    observer.observe(container)
    return () => {
      observer.disconnect()
      if (unmountTimerRef.current) {
        clearTimeout(unmountTimerRef.current)
      }
    }
  }, [])

  // Auto-play when video mounts & capture poster on first frame
  useEffect(() => {
    const vid = videoRef.current
    if (!vid || !shouldMount) return

    const handleLoadedData = () => {
      // Capture first frame as poster if not cached yet
      if (!posterCache.has(video.id)) {
        try {
          const canvas = document.createElement("canvas")
          canvas.width = vid.videoWidth
          canvas.height = vid.videoHeight
          const ctx = canvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
            const dataUrl = canvas.toDataURL("image/webp", 0.6)
            posterCache.set(video.id, dataUrl)
          }
        } catch {
          // CORS or security error — ignore, we'll just show bg color
        }
      }
      vid.play().catch(() => { })
    }

    vid.addEventListener("loadeddata", handleLoadedData)

    // If already loaded (cached by browser), play immediately
    if (vid.readyState >= 2) {
      handleLoadedData()
    }

    return () => {
      vid.removeEventListener("loadeddata", handleLoadedData)
      vid.pause()
    }
  }, [shouldMount, video.id])

  // Sync muted state from parent
  useEffect(() => {
    const vid = videoRef.current
    if (!vid || !shouldMount) return

    if (isAudioActive) {
      vid.muted = false
      vid.play().catch(() => {
        vid.muted = true
      })
    } else {
      vid.muted = true
    }
  }, [isAudioActive, shouldMount])

  const handleToggleAudio = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggleAudio(video.id)
    },
    [video.id, onToggleAudio]
  )

  const handleSelect = useCallback(() => {
    onSelect?.(video)
  }, [video, onSelect])

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
          src={video.src}
          poster={posterUrl ?? video.poster}
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        /* Lightweight poster placeholder — no video decoder allocated */
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

      {/* Gradient overlay at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Sound toggle icon */}
      <button
        type="button"
        onClick={handleToggleAudio}
        className="absolute bottom-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-transform active:scale-90"
        aria-label={isAudioActive ? "Выключить звук" : "Включить звук"}
      >
        {isAudioActive ? (
          <AudioLines className="w-3.5 h-3.5 text-white" />
        ) : (
          <VolumeOff className="w-3.5 h-3.5 text-white/70" />
        )}
      </button>
    </button>
  )
})

// ─── MotionLibrary ───────────────────────────────────────────────────────────

interface MotionLibraryProps {
  open: boolean
  onClose: () => void
  onSelectVideo?: (video: MotionVideo) => void
}

export function MotionLibrary({ open, onClose, onSelectVideo }: MotionLibraryProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null)
  const effectiveActiveAudioId = open ? activeAudioId : null

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

  // Toggle audio: if same video clicked again → mute, otherwise switch
  const handleToggleAudio = useCallback((videoId: string) => {
    setActiveAudioId((prev) => (prev === videoId ? null : videoId))
  }, [])

  const handleSelect = useCallback(
    (v: MotionVideo) => {
      onSelectVideo?.(v)
      onClose()
    },
    [onSelectVideo, onClose]
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
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-[15px] font-semibold text-white">Библиотека движений</h1>
        </div>
      </div>

      <div className="overflow-y-auto h-[calc(100vh-52px)]">
        {/* Video Grid */}
        <div className="px-3 pt-4 pb-8">
          <p className="text-[12px] text-white/40 font-medium mb-3 px-1">
            Начните с копирования движения из библиотеки
          </p>
          <div className="grid grid-cols-3 gap-2">
            {MOTION_VIDEOS.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                isAudioActive={effectiveActiveAudioId === video.id}
                onToggleAudio={handleToggleAudio}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

