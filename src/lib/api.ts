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
    credits_expire_at?: string;
}

interface ApiError {
    error: string;
    need?: number;
    have?: number;
}

interface UpdateSettingsParams {
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
 * Check if user has any pending generation tasks
 */
export async function checkHasPending(): Promise<boolean> {
    const userId = getUserId();
    if (!userId) return false;

    try {
        const res = await fetch(`${API_BASE}/api/user/has-pending`, {
            headers: {
                "X-Telegram-User-ID": String(userId),
                "ngrok-skip-browser-warning": "1",
            },
        });

        if (!res.ok) return false;
        const data = await res.json();
        return data.has_pending === true;
    } catch {
        return false;
    }
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
 * Payment
 */
interface PaymentResponse {
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

interface VerifyPaymentResponse {
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

/**
 * Referral Tags
 */

export interface DailyDataPoint {
    date: string;
    label: string;
    users: number;
    buyers: number;
}

export interface TagStats {
    users: number;
    buyers: number;
    total_revenue: number;
    daily_data: DailyDataPoint[];
}

export interface TagItem {
    name: string;
    created_at: string;
    stats: TagStats;
}

interface RefTagsResponse {
    tags: TagItem[];
    global_tag_count: number;
}

export async function createRefTag(name: string): Promise<{ status: string; name: string; created_at: string } | null> {
    const userId = getUserId();
    if (!userId) return null;

    try {
        const res = await fetch(`${API_BASE}/api/ref-tags`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Telegram-User-ID": String(userId),
                "ngrok-skip-browser-warning": "1",
            },
            body: JSON.stringify({ name }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail?.error || "create_failed");
        }
        return res.json();
    } catch (e) {
        throw e;
    }
}

export async function getRefTags(): Promise<RefTagsResponse | null> {
    const userId = getUserId();
    if (!userId) return null;

    try {
        const res = await fetch(`${API_BASE}/api/ref-tags`, {
            headers: {
                "X-Telegram-User-ID": String(userId),
                "ngrok-skip-browser-warning": "1",
            },
        });

        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export async function deleteRefTag(name: string): Promise<boolean> {
    const userId = getUserId();
    if (!userId) return false;

    try {
        const res = await fetch(`${API_BASE}/api/ref-tags/${encodeURIComponent(name)}`, {
            method: "DELETE",
            headers: {
                "X-Telegram-User-ID": String(userId),
                "ngrok-skip-browser-warning": "1",
            },
        });

        return res.ok;
    } catch {
        return false;
    }
}

export async function getRefTagsSummary(): Promise<TagStats | null> {
    const userId = getUserId();
    if (!userId) return null;

    try {
        const res = await fetch(`${API_BASE}/api/ref-tags/summary`, {
            headers: {
                "X-Telegram-User-ID": String(userId),
                "ngrok-skip-browser-warning": "1",
            },
        });

        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export async function getBotStats(): Promise<TagStats | null> {
    const userId = getUserId();
    if (!userId) return null;

    try {
        const res = await fetch(`${API_BASE}/api/bot-stats`, {
            headers: {
                "X-Telegram-User-ID": String(userId),
                "ngrok-skip-browser-warning": "1",
            },
        });

        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}
