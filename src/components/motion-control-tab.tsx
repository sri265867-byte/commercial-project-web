"use client"

import { useState, useCallback } from "react"
import { Video, Plus, Film, ImageIcon, Library } from "lucide-react"
import { GenerateButton } from "./generate-button"
import { PromptInput } from "./prompt-input"
import { UploadArea } from "./upload-area"
import { ErrorDialog } from "./error-dialog"
import { MotionLibrary } from "./motion-library"

export function MotionControlTab() {
  const [prompt, setPrompt] = useState("")
  const [orientation, setOrientation] = useState<"video" | "image">("image")

  // File state
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [libraryVideoUrl, setLibraryVideoUrl] = useState<string | null>(null) // CDN URL when from library
  const [isGenerating, setIsGenerating] = useState(false)

  // Error state
  const [errorOpen, setErrorOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [errorType, setErrorType] = useState<"insufficient_credits" | "upload_failed" | "generation_failed" | "unknown">("unknown")
  const [errorCredits, setErrorCredits] = useState({ need: 0, have: 0 })
  const [libraryOpen, setLibraryOpen] = useState(false)

  // Handle video selection from the Motion Library
  const handleLibraryVideoSelect = useCallback(async (video: { id: string; src: string }) => {
    // Use CDN URL directly for preview — no need to fetch blob
    const previewUrl = video.src

    // Measure duration with fallback (some CDNs block cross-origin metadata)
    let duration = 5 // sensible default
    try {
      duration = await new Promise<number>((resolve, reject) => {
        const vid = document.createElement("video")
        vid.preload = "metadata"
        vid.onloadedmetadata = () => resolve(vid.duration)
        vid.onerror = () => reject("Failed to load video metadata")
        vid.src = previewUrl
        // Timeout: if metadata doesn't load in 5s, use default
        setTimeout(() => resolve(5), 5000)
      })
    } catch {
      // Use default duration — video will still work
    }

    setVideoFile(null) // No File needed for library videos
    setVideoPreview(previewUrl)
    setLibraryVideoUrl(video.src) // Store CDN URL to send directly
    setVideoDuration(duration)
  }, [])

  const validateVideo = async (file: File, previewUrl: string): Promise<boolean> => {
    // 1. Check size (100MB)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      setErrorMessage("Размер видео не должен превышать 100 МБ")
      setErrorType("upload_failed")
      setErrorOpen(true)
      return false
    }

    // 2. Check duration (3-30s)
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const video = document.createElement("video")
        video.preload = "metadata"
        video.onloadedmetadata = () => {
          resolve(video.duration)
        }
        video.onerror = () => reject("Ошибка загрузки видео")
        video.src = previewUrl
      })

      if (duration < 3 || duration > 30) {
        setErrorMessage("Длительность видео должна быть от 3 до 30 секунд")
        setErrorType("upload_failed")
        setErrorOpen(true)
        return false
      }

      setVideoDuration(duration)
      return true
    } catch (e) {
      setErrorMessage("Не удалось проверить длительность видео")
      setErrorType("upload_failed")
      setErrorOpen(true)
      return false
    }
  }

  const handleVideoUpload = (file: File, previewUrl: string) => {
    setVideoFile(file)
    setVideoPreview(previewUrl)
    setLibraryVideoUrl(null) // User uploaded their own — clear library URL
  }

  const handleImageUpload = (file: File, previewUrl: string) => {
    setImageFile(file)
    setImagePreview(previewUrl)
  }

  const handleGenerate = async () => {
    if ((!videoFile && !libraryVideoUrl) || !imageFile) return

    setIsGenerating(true)
    try {
      const { fileToBase64, generateVideo, getUser } = await import("@/lib/api")

      // Pre-check balance before heavy file conversion
      const user = await getUser()
      if (user && user.balance < cost) {
        setErrorType("insufficient_credits")
        setErrorCredits({ need: cost, have: user.balance })
        setErrorOpen(true)
        setIsGenerating(false)
        return
      }

      // Only convert to base64 if user uploaded a file (not from library)
      const videoBase64 = videoFile ? await fileToBase64(videoFile) : undefined
      const imageBase64 = await fileToBase64(imageFile)

      const result = await generateVideo({
        prompt: prompt,
        imageBase64: imageBase64,
        videoBase64: videoBase64,
        videoUrl: libraryVideoUrl ?? undefined, // Direct CDN URL for library videos
        model: "kling-2.6/motion-control",
        aspectRatio: "16:9",
        duration: roundedDuration,
        characterOrientation: orientation,
      })

      if (result.success) {
        // Success! Reset or show status
        setVideoFile(null)
        setVideoPreview(null)
        setLibraryVideoUrl(null)
        setImageFile(null)
        setImagePreview(null)
        setPrompt("")
        setVideoDuration(0)
        // Ideally redirect to library or show success toast
      } else {
        if (result.error.error === "insufficient_credits") {
          setErrorType("insufficient_credits")
          setErrorCredits({
            need: result.error.need || 0,
            have: result.error.have || 0,
          })
        } else {
          setErrorType("generation_failed")
          setErrorMessage(result.error.error || "Не удалось создать задачу")
        }
        setErrorOpen(true)
      }
    } catch (e) {
      setErrorType("unknown")
      setErrorMessage("Произошла ошибка при отправке")
      setErrorOpen(true)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleError = (msg: string) => {
    setErrorMessage(msg)
    setErrorType("upload_failed")
    setErrorOpen(true)
  }

  // Calculate cost: 6 credits per second, round to nearest whole second
  const roundedDuration = videoDuration > 0 ? Math.round(videoDuration) : 0
  const cost = roundedDuration > 0 ? roundedDuration * 6 : 18

  return (
    <div className="flex flex-col gap-3 pb-6">
      {/* Hero Banner */}
      <div className="relative w-full h-[130px] rounded-2xl overflow-hidden bg-gradient-to-br from-[#222] to-[#111]">
        <video
          src="https://static.higgsfield.ai/v2-fnf-web-kmc-preset.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1.5 rounded-full hover:bg-black/80 transition-colors"
        >
          <Library className="w-3 h-3" />
          Открыть библиотеку
        </button>

        <div className="absolute bottom-2.5 left-3">
          <h2 className="text-[15px] font-black uppercase text-[#c8ff00] leading-tight tracking-wide drop-shadow-lg">
            MOTION CONTROL
          </h2>
          <p className="text-[11px] text-white/60 mt-0.5">Контролируйте движение с помощью референсов</p>
        </div>
      </div>

      {/* Upload Cards - Two columns */}
      <div className="grid grid-cols-2 gap-3">
        <UploadArea
          accept="video/mp4,video/quicktime,video/x-matroska,.mp4,.mov,.mkv"
          maxSizeMB={100}
          title="Референс видео"
          subtitle="3-30 секунд"
          icon={Video}
          onUpload={handleVideoUpload}
          validate={validateVideo}
          onClear={() => {
            setVideoFile(null)
            setVideoPreview(null)
            setLibraryVideoUrl(null)
            setVideoDuration(0)
          }}
          onError={handleError}
          externalPreview={videoPreview}
          externalFileType="video"
          className="h-[130px]"
        />

        <UploadArea
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          maxSizeMB={10}
          title="Персонаж"
          subtitle="Фото с лицом и телом"
          icon={Plus}
          onUpload={handleImageUpload}
          onClear={() => {
            setImageFile(null)
            setImagePreview(null)
          }}
          onError={handleError}
          className="h-[130px]"
        />
      </div>

      {/* Prompt */}
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        placeholder={'Опишите фон и детали сцены — например, "Корги бежит" или "Парк зимой". Движение контролируется видео-референсом'}
      />

      {/* Orientation */}
      <div className="px-1">
        <span className="text-[11px] text-white/35 mb-2.5 block">Ориентация</span>
        <div className="flex rounded-xl bg-[#161616] border border-white/[0.06] p-1">
          <button
            type="button"
            onClick={() => setOrientation("video")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-all ${orientation === "video"
              ? "bg-[#2a2a2a] text-white shadow-sm"
              : "text-white/35 hover:text-white/50"
              }`}
          >
            <Film className="w-3.5 h-3.5" />
            Видео
          </button>
          <button
            type="button"
            onClick={() => setOrientation("image")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-all ${orientation === "image"
              ? "bg-[#2a2a2a] text-white shadow-sm"
              : "text-white/35 hover:text-white/50"
              }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Фото
          </button>
        </div>
        <p className="text-[10px] text-white/25 mt-2.5 leading-relaxed">
          Когда ориентация персонажа совпадает с видео, сложные движения выполняются лучше; когда с фото — лучше поддерживаются движения камеры.
        </p>
      </div>

      {/* Generate Button */}
      <div className="mt-3">
        <GenerateButton
          cost={cost}
          onClick={handleGenerate}
          disabled={(!videoFile && !libraryVideoUrl) || !imageFile || isGenerating}
          loading={isGenerating}
        />
      </div>

      <ErrorDialog
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        type={errorType}
        message={errorMessage}
        creditsNeeded={errorCredits.need || cost}
        creditsHave={errorCredits.have}
      />

      <MotionLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelectVideo={handleLibraryVideoSelect}
      />
    </div>
  )
}
