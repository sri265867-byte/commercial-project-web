/**
 * API client for video generator backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface GenerateParams {
    prompt: string;
    imageBase64: string;
    videoBase64?: string;
    videoUrl?: string;  // Direct URL for library videos (skip re-upload)
    model?: string;
    aspectRatio?: string;
    duration?: number;  // For Hailuo: 6 or 10. For Motion Control: video duration
    sound?: boolean;    // For Kling: true/false
    characterOrientation?: "video" | "image";
}

interface GenerateResponse {
    task_id: string;
    status: string;
    credits_charged: number;
}

export interface UserResponse {
    user_id: number;
    username: string | null;
    balance: number;
    selected_model: string;
}

interface StatusResponse {
    task_id: string;
    status: "processing" | "completed" | "failed";
    result_urls?: string[];
    error?: string;
}

interface ApiError {
    error: string;
    need?: number;
    have?: number;
}

export interface UpdateSettingsParams {
    selected_model?: string;
}

/**
 * Get Telegram user ID from WebApp
 */
function getUserId(): number | null {
    if (typeof window === "undefined") return null;
    // @ts-ignore - Telegram WebApp
    return window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null;
}

/**
 * Get user info
 */
export async function getUser(): Promise<UserResponse | null> {
    const userId = getUserId();
    if (!userId) return null;

    const res = await fetch(`${API_BASE}/api/user`, {
        headers: {
            "X-Telegram-User-ID": String(userId),
            "ngrok-skip-browser-warning": "1",
        },
    });

    if (!res.ok) return null;
    return res.json();
}

/**
 * Update user settings (prompt, image_url, model selection, model params)
 */
export async function updateUserSettings(params: UpdateSettingsParams): Promise<boolean> {
    const userId = getUserId();
    if (!userId) return false;

    try {
        const res = await fetch(`${API_BASE}/api/user/settings`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-Telegram-User-ID": String(userId),
                "ngrok-skip-browser-warning": "1",
            },
            body: JSON.stringify(params),
        });

        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Generate video
 */
export async function generateVideo(
    params: GenerateParams
): Promise<{ success: true; data: GenerateResponse } | { success: false; error: ApiError }> {
    const userId = getUserId();
    if (!userId) {
        return { success: false, error: { error: "not_authenticated" } };
    }

    const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Telegram-User-ID": String(userId),
            "ngrok-skip-browser-warning": "1",
        },
        body: JSON.stringify({
            prompt: params.prompt,
            image_base64: params.imageBase64,
            video_base64: params.videoBase64,
            video_url: params.videoUrl,
            model: params.model || "veo3_fast",
            aspect_ratio: params.aspectRatio || "Auto",
            duration: params.duration,
            sound: params.sound || false,
            character_orientation: params.characterOrientation,
        }),
    });

    if (!res.ok) {
        const error = await res.json();
        return { success: false, error: error.detail || { error: "unknown_error" } };
    }

    const data = await res.json();
    return { success: true, data };
}

/**
 * Check task status
 */
export async function getTaskStatus(taskId: string): Promise<StatusResponse | null> {
    const userId = getUserId();
    if (!userId) return null;

    const res = await fetch(`${API_BASE}/api/status/${taskId}`, {
        headers: {
            "X-Telegram-User-ID": String(userId),
            "ngrok-skip-browser-warning": "1",
        },
    });

    if (!res.ok) return null;
    return res.json();
}

/**
 * Payment
 */
export interface PaymentResponse {
    payment_id: string;
    confirmation_token: string;
}

export async function createPayment(planId: string): Promise<PaymentResponse | null> {
    const userId = getUserId();
    if (!userId) return null;

    try {
        const res = await fetch(`${API_BASE}/api/payment/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Telegram-User-ID": String(userId),
                "ngrok-skip-browser-warning": "1",
            },
            body: JSON.stringify({ plan_id: planId }),
        });

        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export interface VerifyPaymentResponse {
    status: string;
    credits?: number;
}

export async function verifyPayment(paymentId: string): Promise<VerifyPaymentResponse | null> {
    const userId = getUserId();
    if (!userId) return null;

    try {
        const res = await fetch(`${API_BASE}/api/payment/verify`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Telegram-User-ID": String(userId),
                "ngrok-skip-browser-warning": "1",
            },
            body: JSON.stringify({ payment_id: paymentId }),
        });

        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

/**
 * Convert File to base64
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
