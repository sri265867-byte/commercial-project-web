"use client"

import { useState, useCallback, useReducer, useEffect } from "react"
import dynamic from "next/dynamic"
import { Video, Plus, Film, ImageIcon, Library } from "lucide-react"
import { GenerateButton } from "./generate-button"
import { PromptInput } from "./prompt-input"
import { UploadArea } from "./upload-area"
import { ErrorDialog } from "./error-dialog"
import { fileToBase64, generateVideo, getUser, checkHasPending } from "@/lib/api"

const MotionLibrary = dynamic(
  () => import("./motion-library").then(m => ({ default: m.MotionLibrary })),
  { ssr: false }
)

type ErrorState = {
  open: boolean
  type: "insufficient_credits" | "upload_failed" | "generation_failed" | "unknown"
  message: string
  credits: { need: number; have: number }
}

type ErrorAction =
  | { type: "SHOW"; errorType: ErrorState["type"]; message?: string; credits?: { need: number; have: number } }
  | { type: "CLOSE" }

function motionErrorReducer(state: ErrorState, action: ErrorAction): ErrorState {
  switch (action.type) {
    case "SHOW":
      return {
        open: true,
        type: action.errorType,
        message: action.message ?? "",
        credits: action.credits ?? { need: 0, have: 0 },
      }
    case "CLOSE":
      return { ...state, open: false }
  }
}

type VideoRefState = {
  file: File | null
  preview: string | null
  duration: number
  libraryUrl: string | null
}

type VideoRefAction =
  | { type: "UPLOAD"; file: File; preview: string }
  | { type: "SET_LIBRARY"; preview: string; libraryUrl: string; duration: number }
  | { type: "SET_DURATION"; duration: number }
  | { type: "CLEAR" }
  | { type: "CLEAR_ALL_FORM" }

function videoRefReducer(state: VideoRefState, action: VideoRefAction): VideoRefState {
  switch (action.type) {
    case "UPLOAD":
      return { file: action.file, preview: action.preview, duration: state.duration, libraryUrl: null }
    case "SET_LIBRARY":
      return { file: null, preview: action.preview, libraryUrl: action.libraryUrl, duration: action.duration }
    case "SET_DURATION":
      return { ...state, duration: action.duration }
    case "CLEAR":
      return { file: null, preview: null, duration: 0, libraryUrl: null }
    case "CLEAR_ALL_FORM":
      return { file: null, preview: null, duration: 0, libraryUrl: null }
  }
}

export function MotionControlTab({ onGoToShop }: { onGoToShop?: () => void }) {
  const [prompt, setPrompt] = useState("")
  const [orientation, setOrientation] = useState<"video" | "image">("image")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasPending, setHasPending] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)

  const [videoRef, dispatchVideoRef] = useReducer(videoRefReducer, {
    file: null,
    preview: null,
    duration: 0,
    libraryUrl: null,
  })

  const [errorState, dispatchError] = useReducer(motionErrorReducer, {
    open: false,
    type: "unknown" as const,
    message: "",
    credits: { need: 0, have: 0 },
  })

  // Check pending on mount
  useEffect(() => {
    checkHasPending().then(pending => setHasPending(pending))
  }, [])

  const handleLibraryVideoSelect = useCallback(async (video: { id: string; src: string }) => {
    const previewUrl = video.src

    let duration = 5
    try {
      duration = await new Promise<number>((resolve, reject) => {
        const vid = document.createElement("video")
        vid.preload = "metadata"
        vid.onloadedmetadata = () => resolve(vid.duration)
        vid.onerror = () => reject("Failed to load video metadata")
        vid.src = previewUrl
        setTimeout(() => resolve(5), 5000)
      })
    } catch {
    }

    dispatchVideoRef({ type: "SET_LIBRARY", preview: previewUrl, libraryUrl: video.src, duration })
  }, [])

  const validateVideo = async (file: File, previewUrl: string): Promise<boolean> => {
    const maxSize = 100 * 1024 * 1024
    if (file.size > maxSize) {
      dispatchError({ type: "SHOW", errorType: "upload_failed", message: "Размер видео не должен превышать 100 МБ" })
      return false
    }

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

      if (duration < 3) {
        dispatchError({ type: "SHOW", errorType: "upload_failed", message: "Длительность видео должна быть от 3 до 30 секунд" })
        return false
      }
      if (duration > 30) {
        dispatchError({ type: "SHOW", errorType: "upload_failed", message: "Длительность видео должна быть от 3 до 30 секунд" })
        return false
      }

      dispatchVideoRef({ type: "SET_DURATION", duration })
      return true
    } catch (e) {
      dispatchError({ type: "SHOW", errorType: "upload_failed", message: "Не удалось проверить длительность видео" })
      return false
    }
  }

  const handleVideoUpload = (file: File, previewUrl: string) => {
    dispatchVideoRef({ type: "UPLOAD", file, preview: previewUrl })
  }

  const handleImageUpload = (file: File, previewUrl: string) => {
    setImageFile(file)
    setImagePreview(previewUrl)
  }

  const handleGenerate = async () => {
    if ((!videoRef.file && !videoRef.libraryUrl) || !imageFile) return

    setIsGenerating(true)

    let videoUrl: string | undefined
    if (videoRef.libraryUrl !== null) {
      videoUrl = videoRef.libraryUrl
    }

    try {
      const user = await getUser()
      if (user) {
        if (user.balance < cost) {
          dispatchError({ type: "SHOW", errorType: "insufficient_credits", credits: { need: cost, have: user.balance } })
          setIsGenerating(false)
          return
        }
      }

      let videoBase64: string | undefined
      if (videoRef.file) {
        videoBase64 = await fileToBase64(videoRef.file)
      }
      const imageBase64 = await fileToBase64(imageFile)

      const result = await generateVideo({
        prompt: prompt,
        imageBase64: imageBase64,
        videoBase64: videoBase64,
        videoUrl: videoUrl,
        model: "kling-2.6/motion-control",
        aspectRatio: "16:9",
        duration: roundedDuration,
        characterOrientation: orientation,
      })

      if (result.success) {
        dispatchVideoRef({ type: "CLEAR_ALL_FORM" })
        setImageFile(null)
        setImagePreview(null)
        setPrompt("")

        // Success! Close mini app
        // @ts-ignore - Telegram WebApp
        window.Telegram?.WebApp?.close()
      } else {
        if (result.error.error === "insufficient_credits") {
          let need = result.error.need
          if (!need) need = 0
          let have = result.error.have
          if (!have) have = 0
          dispatchError({ type: "SHOW", errorType: "insufficient_credits", credits: { need, have } })
        } else {
          let errorMsg = result.error.error
          if (!errorMsg) errorMsg = "Не удалось создать задачу"
          dispatchError({ type: "SHOW", errorType: "generation_failed", message: errorMsg })
        }
      }
      setIsGenerating(false)
    } catch (e) {
      dispatchError({ type: "SHOW", errorType: "unknown", message: "Произошла ошибка при отправке" })
      setIsGenerating(false)
    }
  }

  const handleError = (msg: string) => {
    dispatchError({ type: "SHOW", errorType: "upload_failed", message: msg })
  }

  const roundedDuration = videoRef.duration > 0 ? Math.round(videoRef.duration) : 0
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
            dispatchVideoRef({ type: "CLEAR" })
          }}
          onError={handleError}
          externalPreview={videoRef.preview}
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
        placeholder={'A snowy park with winter trees, soft light...'}
        hint="✏️ Необязательно · Опишите фон сцены на английском"
      />

      {/* Orientation */}
      <div className="px-1">
        <span className="text-[11px] text-white/35 mb-2.5 block">Ориентация</span>
        <div className="flex rounded-xl bg-[#161616] border border-white/[0.06] p-1">
          <button
            type="button"
            onClick={() => setOrientation("video")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-[background-color,color] ${orientation === "video"
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
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-[background-color,color] ${orientation === "image"
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
          disabled={(!videoRef.file && !videoRef.libraryUrl) || !imageFile || isGenerating || hasPending}
          loading={isGenerating}
        />
      </div>

      <ErrorDialog
        open={errorState.open}
        onClose={() => dispatchError({ type: "CLOSE" })}
        type={errorState.type}
        message={errorState.message}
        creditsNeeded={errorState.credits.need || cost}
        creditsHave={errorState.credits.have}
        onGoToShop={onGoToShop}
      />

      <MotionLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelectVideo={handleLibraryVideoSelect}
      />
    </div>
  )
}
