import type { ModelId } from "../models"
import type { Effect } from "./types"
import { MINIMAX_HAILUO_EFFECTS } from "./minimax-hailuo"
import { KLING_EFFECTS } from "./kling-2.6"
import { VEO_EFFECTS } from "./veo-3.1"

export type { Effect }

const EFFECTS_DATA: Effect[] = [
    ...MINIMAX_HAILUO_EFFECTS,
    ...KLING_EFFECTS,
    ...VEO_EFFECTS,
]

export function getEffectsForModel(modelId: ModelId): Effect[] {
    return EFFECTS_DATA.filter((e) => e.model === modelId)
}

/** Returns the GENERAL (default) effect for a model — always the first in the list */
export function getDefaultEffect(modelId: ModelId): Effect {
    return getEffectsForModel(modelId)[0]
}
