"use client"

import { useState, useEffect, useCallback, useReducer } from "react"
import dynamic from "next/dynamic"
import { type ModelId, models, calculateCost } from "@/lib/models"
import { generateVideo, fileToBase64, getUser, updateUserSettings, checkHasPending, type UserResponse } from "@/lib/api"
import { type Effect, getDefaultEffect } from "@/lib/effects/index"
import { HeroBanner } from "./hero-banner"
import { UploadArea } from "./upload-area"
import { PromptInput } from "./prompt-input"
import { ModelSelector } from "./model-selector"
import { SettingRow } from "./setting-row"
import { GenerateButton } from "./generate-button"
import { ErrorDialog } from "./error-dialog"
import { Switch } from "@/components/ui/switch"

const EffectsLibrary = dynamic(
  () => import("./effects-library").then(m => ({ default: m.EffectsLibrary })),
  { ssr: false }
)


const bannerImages: Record<ModelId, string> = {
  "veo-3.1": "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=600&h=300&fit=crop",
  "minimax-hailuo": "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=300&fit=crop",
  "kling-2.6": "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=300&fit=crop",
}

// Map backend selected_model to frontend ModelId
function backendModelToFrontend(backendModel: string): ModelId {
  const map: Record<string, ModelId> = {
    hailuo: "minimax-hailuo",
    kling: "kling-2.6",
    veo: "veo-3.1",
  }
  return map[backendModel] || "veo-3.1"
}

// Map frontend ModelId to backend selected_model
function frontendModelToBackend(modelId: ModelId): string {
  const map: Record<ModelId, string> = {
    "minimax-hailuo": "hailuo",
    "kling-2.6": "kling",
    "veo-3.1": "veo",
  }
  return map[modelId]
}

type ErrorState = {
  open: boolean
  type: "insufficient_credits" | "upload_failed" | "generation_failed" | "unknown"
  message: string
  credits: { need: number; have: number }
}

type ErrorAction =
  | { type: "SHOW"; errorType: ErrorState["type"]; message?: string; credits?: { need: number; have: number } }
  | { type: "CLOSE" }

const initialErrorState: ErrorState = {
  open: false,
  type: "unknown",
  message: "",
  credits: { need: 0, have: 0 },
}

function errorReducer(state: ErrorState, action: ErrorAction): ErrorState {
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

type EffectState = {
  libraryOpen: boolean
  videoUrl: string | null
  name: string
}

type EffectAction =
  | { type: "OPEN_LIBRARY" }
  | { type: "CLOSE_LIBRARY" }
  | { type: "SELECT"; videoUrl: string | null; name: string }
  | { type: "RESET"; videoUrl: string | null; name: string }

function effectReducer(state: EffectState, action: EffectAction): EffectState {
  switch (action.type) {
    case "OPEN_LIBRARY":
      return { ...state, libraryOpen: true }
    case "CLOSE_LIBRARY":
      return { ...state, libraryOpen: false }
    case "SELECT":
      return { libraryOpen: false, videoUrl: action.videoUrl, name: action.name }
    case "RESET":
      return { ...state, videoUrl: action.videoUrl, name: action.name }
  }
}

export function CreateVideoTab({ onGoToShop }: { onGoToShop?: () => void }) {
  const [selectedModel, setSelectedModel] = useState<ModelId>("veo-3.1")
  const [duration, setDuration] = useState<string>("6s")
  const [audioEnabled, setAudioEnabled] = useState(false)

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasPending, setHasPending] = useState(false)

  // Settings loaded flag 
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // Error dialog state
  const [errorState, dispatchError] = useReducer(errorReducer, initialErrorState)

  // Effects library
  const [effectState, dispatchEffect] = useReducer(effectReducer, {
    libraryOpen: false,
    videoUrl: getDefaultEffect("veo-3.1").videoUrl,
    name: getDefaultEffect("veo-3.1").name,
  })

  // Initialize prompt with default effect
  const [prompt, setPrompt] = useState(() => getDefaultEffect("veo-3.1").prompt)

  const model = models[selectedModel]

  // Calculate cost
  const durationNum = model.durationOptions.length > 0 ? parseInt(duration) : 0
  const generationCost = calculateCost(selectedModel, durationNum, audioEnabled)

  // --- Load settings from backend on mount ---
  useEffect(() => {
    const loadSettings = async () => {
      const user = await getUser()
      if (!user) {
        setSettingsLoaded(true)
        return
      }

      // Load selected model
      const frontendModel = backendModelToFrontend(user.selected_model)
      setSelectedModel(frontendModel)

      // Set default duration for the loaded model
      const newModel = models[frontendModel]
      if (newModel.durationOptions.length > 0) {
        setDuration(`${newModel.defaultDuration}s`)
      }

      // Reset effect to GENERAL for the loaded model
      const defaultEffect = getDefaultEffect(frontendModel)
      setPrompt(defaultEffect.prompt)
      dispatchEffect({ type: "RESET", videoUrl: defaultEffect.videoUrl, name: defaultEffect.name })

      setSettingsLoaded(true)
    }

    loadSettings()

    // Check for pending generation
    checkHasPending().then(pending => setHasPending(pending))
  }, [])

  const handleModelChange = (modelId: ModelId) => {
    setSelectedModel(modelId)
    const newModel = models[modelId]

    // Load saved duration for this model
    if (newModel.durationOptions.length > 0) {
      setDuration(`${newModel.defaultDuration}s`)
    }

    // Reset effect to GENERAL for this model
    const defaultEffect = getDefaultEffect(modelId)
    setPrompt(defaultEffect.prompt)
    dispatchEffect({ type: "RESET", videoUrl: defaultEffect.videoUrl, name: defaultEffect.name })

    // Save selected model immediately
    updateUserSettings({ selected_model: frontendModelToBackend(modelId) })
  }

  const handleImageUpload = (file: File, previewUrl: string) => {
    setImageFile(file)
    setImagePreview(previewUrl)
  }

  const handleImageClear = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleGenerate = async () => {
    // Validate
    if (!imageFile) {
      dispatchError({ type: "SHOW", errorType: "upload_failed", message: "Загрузите изображение перед генерацией" })
      return
    }

    if (!prompt.trim()) {
      return // TODO: Show prompt required error
    }

    setIsGenerating(true)

    const aspectRatio = model.aspectRatio || "Auto"
    const durationValue = model.durationOptions.length > 0 ? parseInt(duration) : undefined
    const trimmedPrompt = prompt.trim()

    try {
      // Pre-check balance before heavy file conversion
      const user = await getUser()
      if (user) {
        if (user.balance < generationCost) {
          dispatchError({ type: "SHOW", errorType: "insufficient_credits", credits: { need: generationCost, have: user.balance } })
          setIsGenerating(false)
          return
        }
      }

      // Convert image to base64
      const imageBase64 = await fileToBase64(imageFile)

      // Call API
      const result = await generateVideo({
        prompt: trimmedPrompt,
        imageBase64,
        model: model.apiModel,
        aspectRatio,
        duration: durationValue,
        sound: audioEnabled,
      })

      if (!result.success) {
        if (result.error.error === "insufficient_credits") {
          let need = result.error.need
          if (!need) need = 0
          let have = result.error.have
          if (!have) have = 0
          dispatchError({ type: "SHOW", errorType: "insufficient_credits", credits: { need, have } })
        } else {
          dispatchError({ type: "SHOW", errorType: "generation_failed" })
        }
        setIsGenerating(false)
        return
      }

      // Success! Clear form
      setPrompt("")
      setImageFile(null)
      setImagePreview(null)

      // TODO: Show success message and redirect to status page
      setIsGenerating(false)
      // Success! Close mini app
      // @ts-ignore - Telegram WebApp
      window.Telegram?.WebApp?.close()
    } catch (error) {
      dispatchError({ type: "SHOW", errorType: "unknown" })
      setIsGenerating(false)
    }
  }

  // Check if can generate (image + prompt required)
  const canGenerate = imageFile !== null && prompt.trim().length > 0 && !hasPending

  // --- Loading skeleton ---
  if (!settingsLoaded) {
    return (
      <div className="flex flex-col gap-3 pb-6 animate-pulse">
        {/* Banner skeleton */}
        <div className="h-[140px] rounded-2xl bg-white/[0.06]" />
        {/* Upload skeleton */}
        <div className="h-[120px] rounded-2xl bg-white/[0.06]" />
        {/* Prompt skeleton */}
        <div className="h-[100px] rounded-2xl bg-white/[0.06]" />
        {/* Model selector skeleton */}
        <div className="h-[56px] rounded-2xl bg-white/[0.06]" />
        {/* Settings skeleton */}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-[56px] rounded-2xl bg-white/[0.06]" />
          <div className="h-[56px] rounded-2xl bg-white/[0.06]" />
        </div>
        {/* Button skeleton */}
        <div className="h-[52px] rounded-2xl bg-white/[0.06] mt-3" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pb-6">
      {/* Hero Banner */}
      <HeroBanner
        title={effectState.name}
        subtitle={model.name}
        imageUrl={bannerImages[selectedModel]}
        videoUrl={effectState.videoUrl ?? undefined}
        onChangeBanner={() => dispatchEffect({ type: "OPEN_LIBRARY" })}
      />

      {/* Upload Area */}
      <UploadArea
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        maxSizeMB={10}
        onUpload={handleImageUpload}
        onClear={handleImageClear}
        onError={(msg) => {
          dispatchError({ type: "SHOW", errorType: "upload_failed", message: msg })
        }}
        className="h-[130px]"
      />

      {/* Prompt */}
      <PromptInput value={prompt} onChange={setPrompt} />

      {/* Audio toggle for Kling 2.6 */}
      {/* Audio toggle for Kling 2.6 */}
      {selectedModel === "kling-2.6" && (
        <div className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-[#161616] border border-white/[0.06]">
          <span className="text-sm font-semibold text-white">Звук</span>
          <Switch
            checked={audioEnabled}
            onCheckedChange={setAudioEnabled}
            className="data-[state=checked]:bg-[#c8ff00] data-[state=unchecked]:bg-[#333]"
          />
        </div>
      )}

      {/* Model Selector */}
      <ModelSelector
        selectedModel={selectedModel}
        onSelectModel={handleModelChange}
      />

      {/* Model-specific settings - two column grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Duration - for Kling and Minimax */}
        {(selectedModel === "kling-2.6" || selectedModel === "minimax-hailuo") && (
          <SettingRow
            label="Длительность"
            value={duration}
            options={model.durationOptions.map((d) => `${d}s`)}
            onSelect={setDuration}
          />
        )}

        {/* Mode - for Veo (read only, always Fast) */}
        {selectedModel === "veo-3.1" && (
          <SettingRow
            label="Режим"
            value="Быстрый"
            readOnly
          />
        )}

        {/* Aspect Ratio - for Kling and Veo */}
        {(selectedModel === "kling-2.6" || selectedModel === "veo-3.1") && (
          <SettingRow
            label="Соотношение"
            value={model.aspectRatio === "Auto" ? "Авто" : model.aspectRatio || "Авто"}
            readOnly
          />
        )}

        {/* Resolution - for Minimax */}
        {selectedModel === "minimax-hailuo" && (
          <SettingRow
            label="Разрешение"
            value={model.resolution || "768p"}
            readOnly
          />
        )}
      </div>

      {/* Generate Button */}
      <div className="mt-3">
        <GenerateButton
          cost={generationCost}
          onClick={handleGenerate}
          disabled={!canGenerate}
          loading={isGenerating}
        />
      </div>

      {/* Error Dialog */}
      <ErrorDialog
        open={errorState.open}
        onClose={() => dispatchError({ type: "CLOSE" })}
        type={errorState.type}
        message={errorState.message}
        creditsNeeded={errorState.credits.need}
        creditsHave={errorState.credits.have}
        onGoToShop={onGoToShop}
      />

      {/* Effects Library */}
      <EffectsLibrary
        open={effectState.libraryOpen}
        onClose={() => dispatchEffect({ type: "CLOSE_LIBRARY" })}
        currentModel={selectedModel}
        onSelectEffect={(effect) => {
          setPrompt(effect.prompt)
          dispatchEffect({ type: "SELECT", videoUrl: effect.videoUrl, name: effect.name })
        }}
      />
    </div>
  )
}
