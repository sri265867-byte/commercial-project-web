import type { ModelId } from "../models"

export interface Effect {
    id: string
    name: string
    category: string
    videoUrl: string
    model: ModelId
    prompt: string
}

type EffectCategory =
    | "All"
    | "Horror"
    | "Viral"
    | "Camera Control"
    | "Effects"
    | "UGC"
    | "Action Movement"
    | "Emotions"
    | "Commercial"

const EFFECT_CATEGORIES: EffectCategory[] = [
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
