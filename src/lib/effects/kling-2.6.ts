import type { Effect } from "./types"

export const KLING_EFFECTS: Effect[] = [
    {
        id: "k-general",
        name: "GENERAL",
        category: "All",
        videoUrl: "https://cdn.higgsfield.ai/kling_motion/b0d130e1-efc6-494a-a2e8-42d56a589002.mp4",
        model: "kling-2.6",
        prompt: "Bring this image to life",
    },
    {
        id: "k-1",
        name: "ANIMIALIZATION",
        category: "Effects",
        videoUrl: "https://cdn.higgsfield.ai/kling_motion/3979e522-6d4c-4a6f-86a9-adde18d3ea22.mp4",
        model: "kling-2.6",
        prompt: "Cinematic, photorealistic, 8k. Based on the input image, the camera remains completely static. Suddenly, a bright, glowing, crackling magical energy ring appears around the subject. The luminous ring sweeps swiftly across the subject's body. As the glowing light passes over them, a seamless and beautiful magical transformation occurs: the human subject instantly morphs into a realistic [BROWN DOG]. The transition is fluid, hidden by the bright VFX energy. The newly transformed animal lands gracefully on all fours in the exact same spot. High-end visual effects, dynamic lighting from the magical ring, highly detailed animal fur and physics.",
    }
]
