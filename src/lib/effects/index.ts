import type { ModelId } from "../models"
import type { Effect, EffectCategory } from "./types"
import { EFFECT_CATEGORIES } from "./types"
import { MINIMAX_HAILUO_EFFECTS } from "./minimax-hailuo"
import { KLING_EFFECTS } from "./kling-2.6"
import { VEO_EFFECTS } from "./veo-3.1"

// Re-export types for consumers
export type { Effect, EffectCategory }
export { EFFECT_CATEGORIES }

// Combined array from all model files
const EFFECTS_DATA: Effect[] = [
    ...MINIMAX_HAILUO_EFFECTS,
    ...KLING_EFFECTS,
    ...VEO_EFFECTS,
]

export function getEffectsForModel(modelId: ModelId): Effect[] {
    return EFFECTS_DATA.filter((e) => e.model === modelId)
}

export function getEffectsForModelAndCategory(
    modelId: ModelId,
    category: EffectCategory
): Effect[] {
    const effects = getEffectsForModel(modelId)
    if (category === "All") return effects
    return effects.filter((e) => e.category === category)
}

export function getCategoriesForModel(modelId: ModelId): EffectCategory[] {
    const effects = getEffectsForModel(modelId)
    const cats = new Set(effects.map((e) => e.category))
    return ["All", ...EFFECT_CATEGORIES.filter((c) => c !== "All" && cats.has(c))]
}

/** Returns the GENERAL (default) effect for a model — always the first in the list */
export function getDefaultEffect(modelId: ModelId): Effect {
    return getEffectsForModel(modelId)[0]
}
