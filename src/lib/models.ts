export type ModelId = "veo-3.1" | "minimax-hailuo" | "kling-2.6"

export interface ModelConfig {
  id: ModelId
  name: string
  icon: string
  generateCost: number
  durationOptions: number[]
  defaultDuration: number
  apiModel: string  // Backend API model name
  // For Kling
  aspectRatio?: string
  // For Minimax
  resolution?: string
  // For Veo
  mode?: string
}

export const models: Record<ModelId, ModelConfig> = {
  "veo-3.1": {
    id: "veo-3.1",
    name: "Veo 3.1",
    icon: "G",
    generateCost: 60,
    durationOptions: [],
    defaultDuration: 0,
    apiModel: "veo3_fast",
    mode: "Fast",
    aspectRatio: "Auto",
  },
  "minimax-hailuo": {
    id: "minimax-hailuo",
    name: "Minimax Hailuo",
    icon: "waveform",
    generateCost: 45,
    durationOptions: [6, 10],
    defaultDuration: 6,
    apiModel: "minimax-hailuo",
    resolution: "768p",
  },
  "kling-2.6": {
    id: "kling-2.6",
    name: "Kling 2.6",
    icon: "kling",
    generateCost: 55,
    durationOptions: [5, 10],
    defaultDuration: 5,
    apiModel: "kling-2.6/image-to-video",
    aspectRatio: "Auto",
  },
}

// Helper to calculate cost dynamically
export function calculateCost(modelId: ModelId, duration: number, sound: boolean): number {
  if (modelId === "veo-3.1") {
    return 60
  }

  if (modelId === "minimax-hailuo") {
    // 45 for 6s (default), 90 for 10s
    return duration === 10 ? 90 : 45
  }

  if (modelId === "kling-2.6") {
    // Base: 55 (5s no audio)
    // 10s = 2x
    // Audio = 2x
    let cost = 55
    if (duration === 10) cost *= 2
    if (sound) cost *= 2
    return cost
  }

  return 0
}

export const modelList: ModelId[] = ["veo-3.1", "minimax-hailuo", "kling-2.6"]
