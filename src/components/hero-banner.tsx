"use client"

import { useRef, useEffect } from "react"
import { Pencil } from "lucide-react"

interface HeroBannerProps {
  title: string
  subtitle: string
  imageUrl: string
  videoUrl?: string
  onChangeBanner?: () => void
}

export function HeroBanner({ title, subtitle, imageUrl, videoUrl, onChangeBanner }: HeroBannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return

    const handleLoaded = () => {
      vid.play().catch(() => { })
    }

    vid.addEventListener("loadeddata", handleLoaded)
    if (vid.readyState >= 2) handleLoaded()

    return () => vid.removeEventListener("loadeddata", handleLoaded)
  }, [videoUrl])

  return (
    <div className="relative w-full h-[130px] rounded-2xl overflow-hidden">
      {videoUrl ? (
        <video
          key={videoUrl}
          ref={videoRef}
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <img
          src={imageUrl || "/placeholder.svg"}
          alt={title}
          className="w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <button
        type="button"
        onClick={onChangeBanner}
        className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1.5 rounded-full hover:bg-black/80 transition-colors"
      >
        <Pencil className="w-3 h-3" />
        Изменить
      </button>

      <div className="absolute bottom-2.5 left-3">
        <h2 className="text-[15px] font-black uppercase text-[#c8ff00] leading-tight tracking-wide drop-shadow-lg">
          {title}
        </h2>
        <p className="text-[11px] text-white/60 mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}
