import type { ModelId } from "../models"

export interface Effect {
    id: string
    name: string
    category: string
    videoUrl: string
    model: ModelId
    prompt: string
}

export type EffectCategory =
    | "All"
    | "Horror"
    | "Viral"
    | "Camera Control"
    | "Effects"
    | "UGC"
    | "Action Movement"
    | "Emotions"
    | "Commercial"

export const EFFECT_CATEGORIES: EffectCategory[] = [
    "All",
    "Horror",
    "Viral",
    "Camera Control",
    "Effects",
    "UGC",
    "Action Movement",
    "Emotions",
    "Commercial",
]
