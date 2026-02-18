---
trigger: always_on
---

# AGENTS.MD

<project_context>
**Project Name:** Video Generator (Telegram Mini App)
**Type:** AI Video Generation Service (SaaS)
**Primary Interface:** Telegram Web App (TWA)
**Key Features:**
- Text-to-Video & Image-to-Video generation.
- Motion Control (видео-референсы).
- Интеграция моделей: Veo 3.1, Minimax Hailuo, Kling 2.6.
- Платежная система: YooKassa (встроенный виджет).
</project_context>

<tech_stack>
**Frontend (Client):**
- **Framework:** Next.js 15 (App Router).
- **Language:** TypeScript.
- **Styling:** Tailwind CSS v4.
- **UI Components:** Shadcn/ui (Radix Primitives), Lucide React.
- **Telegram Integration:** `telegram-web-app.js`, кастомный `TelegramProvider`.
- **State Management:** React Hooks (`useState`, `useEffect`, `useContext`).
- **Data Fetching:** Native `fetch` wrapper (`api.ts`).

**Backend (Server - Python):**
- **Framework:** FastAPI.
- **Database:** MongoDB (Pymongo).
- **Validation:** Pydantic.
- **Logging:** Loguru.
</tech_stack>

<architecture>
**File Structure Map:**
- `src/app` -> Pages & Layouts (Next.js App Router).
- `src/components` -> Reusable UI components (Shadcn, Custom).
- `src/components/providers` -> Context Providers (`TelegramProvider`, `ThemeProvider`).
- `src/lib` -> Business Logic, API Clients, Utils.
- `src/lib/effects` -> Presets for video generation models.
- `backend/` (implied) -> FastAPI app (`main.py`, `api.py`, `services/`).

**Data Flow:**
1. **Frontend:** User selects params -> `api.ts` converts file to Base64 -> calls FastAPI.
2. **Backend:** Validates credits -> Uploads to Kie.ai CDN -> Calls AI Model API -> Saves Task to MongoDB.
3. **Callbacks:** AI Model calls Webhook -> Backend updates MongoDB -> Notifies user via Telegram Bot API.
</architecture>

<coding_rules>
**General:**
1. **Language:** English for code/comments, Russian for UI text/Strings.
2. **Path Alias:** Always use `@/` for imports (e.g., `import { cn } from "@/lib/utils"`).
3. **Icons:** Use `lucide-react`.

**Frontend (Next.js/React):**
1. **Telegram Viewport:** NEVER use `100vh`. Always use `var(--tg-viewport-stable-height)` or custom CSS variables from `globals.css` to prevent scroll issues on iOS.
2. **Safe Areas:** Respect Telegram safe areas. Use classes `pt-safe`, `pb-safe` (defined in global CSS).
3. **Client Components:** Add `"use client"` at the top of files using hooks.
4. **Shadcn:** Use the provided registry pattern. Do not reinvent UI components if Shadcn has them (Drawer, Button, Input).
5. **Images:** Use standard `<img>` or `<video>` tags where optimization isn't critical (local previews), or `Next/Image` for static assets.
6. **Error Handling:** Use `ErrorDialog` component for user feedback.

**Backend (FastAPI/Python):**
1. **Async:** All DB and API calls must be `async`.
2. **Models:** Use Pydantic schemas for all Request/Response bodies.
3. **Snake_case:** API responses usually use `snake_case` (e.g., `task_id`), match this in frontend interfaces.
4. **Credit Logic:** Always check `user.balance.credits` *before* initiating API calls to models.
</coding_rules>

<critical_workflows>
**1. Video Generation Process:**
   - Frontend: `fileToBase64` -> `generateVideo` API call.
   - Backend:
     1. Check Balance.
     2. Upload Base64 to `kie.ai` (File Stream API).
     3. Select Client (Veo/Hailuo/Kling).
     4. `createTask` on Model API.
     5. Charge Credits.
     6. Save to `users_queue` (MongoDB).

**2. Payments (YooKassa):**
   - Flow: `createPayment` (API) -> Get `confirmation_token` -> Initialize Widget JS -> Widget Success -> `verifyPayment` (API).
   - **Important:** Frontend must handle the Widget lifecycle correctly (destroy old instances).

**3. Model Specifics:**
   - **Veo:** `aspect_ratio` ("Auto", "16:9", etc), `mode` ("Fast").
   - **Hailuo:** `duration` (6s or 10s), `resolution` ("768p").
   - **Kling:** `duration` (5s or 10s), `sound` (boolean), `mode` ("Standard" implied).
</critical_workflows>

<agent_behavior>
**Thinking Process (Chain of Thought):**
Before writing code, you must:
1. **Plan:** Outline the files to be modified in `<thinking>` tags.
2. **Context Check:** Verify if you have the latest `api.ts` or component structure.
3. **Telegram Check:** Ask yourself "Will this break layout on iPhone inside Telegram?" (Viewport check).

**Output Style:**
- Provide full file content for small files.
- For large files, use `SEARCH/REPLACE` blocks or clear instructions on where to insert code.
- Always update `requirements.txt` or `package.json` if adding libs.
</agent_behavior>