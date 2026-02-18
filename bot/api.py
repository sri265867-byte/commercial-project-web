import json
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.requests import Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from loguru import logger
import asyncio
import os
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import Update

from config import get_settings
from database import Database, UserRepository
from handlers.start import router as start_router
from services.credit_expiry import start_credit_expiry_scheduler
from services.kling import (
    KlingGenerateRequest,
    KlingDuration,
    get_kling_client,
)
from services.veo import (
    VeoGenerateRequest,
    VeoModel,
    AspectRatio,
    get_veo_client,
)
from services.hailuo import (
    HailuoGenerateRequest,
    HailuoDuration,
    get_hailuo_client,
)
from services.upload import UploadClient
from services.yookassa import get_yookassa_client, PLANS
from models.task import TaskStatus


# Request/Response models
class GenerateRequest(BaseModel):
    prompt: Optional[str] = ""
    image_base64: str  # Base64 encoded image
    video_base64: Optional[str] = None # Base64 encoded video for Motion Control
    video_url: Optional[str] = None  # Direct video URL (library presets, skip upload)
    model: str = "veo3_fast"
    aspect_ratio: str = "Auto"
    duration: Optional[float] = None  # For Hailuo: 6 or 10 seconds. For Motion Control: video duration
    sound: bool = False  # For Kling
    character_orientation: Optional[str] = "video"


class GenerateResponse(BaseModel):
    task_id: str
    status: str
    credits_charged: int


class StatusResponse(BaseModel):
    task_id: str
    status: str
    result_urls: Optional[list[str]] = None
    error: Optional[str] = None


class UserResponse(BaseModel):
    user_id: int
    username: Optional[str]
    balance: int
    selected_model: str
    credits_expire_at: Optional[str] = None


class UpdateSettingsRequest(BaseModel):
    """Request to update user settings"""
    selected_model: Optional[str] = None


# Cost calculation
def calculate_cost(model: str, duration: Optional[int] = None, sound: bool = False) -> int:
    """Calculate generation cost based on model and parameters"""
    if model == "veo3_fast":
        return 60  # Updated price for Veo
        
    elif model == "minimax-hailuo":
        # Hailuo: 45 for 6s, 90 for 10s
        if duration == 10:
            return 90
        return 45
        
    elif model == "kling-2.6/image-to-video":
        # Kling pricing rule:
        # 5s no audio: 55
        # 10s no audio: 110
        # 5s with audio: 110
        # 10s with audio: 220
        base_cost = 55
        
        # Duration multiplier (10s = 2x)
        if duration == 10:
            base_cost *= 2
            
        # Sound multiplier (with sound = 2x)
        if sound:
            base_cost *= 2
            
        return base_cost

    elif model == "kling-2.6/motion-control":
        # Dynamic pricing: 6 credits per second
        # Minimum 3s -> 18 credits
        if duration:
             return int(duration) * 6
        return 100 # Fallback if duration missing (should not happen)
        
    # Default fallback
    return 15

# Global upload client
_upload_client: Optional[UploadClient] = None


def get_upload_client() -> UploadClient:
    """Get or create upload client singleton"""
    global _upload_client
    if _upload_client is None:
        settings = get_settings()
        _upload_client = UploadClient(settings.kie_api_key)
    return _upload_client


# Global bot/dp variables
bot: Optional[Bot] = None
dp: Optional[Dispatcher] = None
polling_task: Optional[asyncio.Task] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global bot, dp, polling_task
    
    # ── Database ──
    logger.info("Starting API server...")
    await Database.connect()
    logger.success("Database connected!")

    # ── Bot & Scheduler ──
    settings = get_settings()
    
    # Initialize Bot
    bot = Bot(token=settings.bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    
    # Register routers + startup/shutdown
    dp.include_router(start_router)

    # Start Credit Scheduler
    await start_credit_expiry_scheduler()
    
    # Start Polling (Background)
    # Note: For production with heavy load, use Webhooks.
    # For now (Amvera single container), polling is easiest.
    logger.info("Starting Bot Polling...")
    
    async def _polling():
        try:
            await dp.start_polling(bot, handle_signals=False)
        except asyncio.CancelledError:
            logger.info("Polling cancelled")
        except Exception as e:
            logger.error(f"Polling failed: {e}")

    polling_task = asyncio.create_task(_polling())

    yield
    
    # ── Shutdown ──
    # Stop polling
    if polling_task:
        polling_task.cancel()
        try:
            await polling_task
        except asyncio.CancelledError:
            pass
            
    if bot:
        await bot.session.close()

    await Database.disconnect()
    veo = get_veo_client()
    await veo.close()
    logger.info("API server stopped")


# Create FastAPI app
app = FastAPI(
    title="Video Generator API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for Mini App
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        body = await request.body()
        body_str = body.decode()
        data = json.loads(body_str)
        # Truncate for logs
        if "image_base64" in data:
            data["image_base64"] = "TRUNCATED"
        if "video_base64" in data:
            data["video_base64"] = "TRUNCATED"
        logger.error(f"Validation Error: {exc.errors()}")
        logger.error(f"Body: {json.dumps(data)}")
    except Exception as e:
        logger.error(f"Error handling validation exception: {e}")
    
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

async def get_current_user(x_telegram_user_id: int = Header(...)):
    """Get user from Telegram user ID header"""
    user = await UserRepository.get_by_id(x_telegram_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "video-generator-api"}


@app.get("/api/user")
async def get_user(user=Depends(get_current_user)) -> UserResponse:
    """Get current user info"""
    return UserResponse(
        user_id=user.user_id,
        username=user.username,
        balance=user.balance.credits,
        selected_model=user.selected_model,
        credits_expire_at=user.balance.expiration_date.isoformat() if user.balance.expiration_date else None,
    )


@app.patch("/api/user/settings")
async def update_user_settings(
    request: UpdateSettingsRequest,
    user=Depends(get_current_user),
):
    """Update user settings (model selection, model params)"""
    update_fields: dict = {"updated_at": datetime.utcnow()}
    
    if request.selected_model is not None:
        update_fields["selected_model"] = request.selected_model
    
    await Database.db["users"].update_one(
        {"_id": user.user_id},
        {"$set": update_fields},
    )
    
    logger.info(f"Settings updated for user {user.user_id}: {list(update_fields.keys())}")
    return {"status": "ok"}


@app.get("/api/user/has-pending")
async def has_pending_task(user=Depends(get_current_user)):
    """Check if user has any processing tasks in queue (created within last 30 mins)"""
    # Safety: if task is processing > 30 mins, assume it failed/stuck and allow new one
    cutoff = datetime.utcnow() - timedelta(minutes=30)
    
    pending = await Database.users_queue.find_one(
        {
            "user_id": user.user_id,
            "status": TaskStatus.PROCESSING.value,
            "created_at": {"$gte": cutoff},
        },
        {"_id": 1, "model": 1},
    )
    return {"has_pending": pending is not None}


@app.post("/api/generate")
async def generate_video(
    request: GenerateRequest,
    user=Depends(get_current_user),
) -> GenerateResponse:
    """Start video generation - routes to appropriate model API"""
    # Get cost for model - check balance FIRST
    cost = calculate_cost(request.model, request.duration, request.sound)
    
    if user.balance.credits < cost:
        logger.warning(f"Insufficient credits: user={user.user_id}, have={user.balance.credits}, need={cost}")
        raise HTTPException(
            status_code=402,
            detail={
                "error": "insufficient_credits",
                "need": cost,
                "have": user.balance.credits,
            },
        )
    
    # Balance OK - proceed with generation
    logger.info(f"=== GENERATE REQUEST ===")
    logger.info(f"User: {user.user_id}, Balance: {user.balance.credits}")
    logger.info(f"Model: {request.model}, Aspect: {request.aspect_ratio}, Duration: {request.duration}")
    logger.info(f"Prompt: {request.prompt[:100]}...")
    logger.info(f"Image base64 length: {len(request.image_base64)}")
    
    settings = get_settings()
    upload_client = get_upload_client()
    
    # Upload image to kie.ai
    logger.info(f"Uploading image for user {user.user_id}...")
    try:
        image_url = await upload_client.upload_file(
            request.image_base64,
            user.user_id,
        )
    except Exception as e:
        logger.error(f"Image upload failed: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "upload_failed", "message": str(e)},
        )
    
    if not image_url:
        raise HTTPException(
            status_code=500,
            detail={"error": "upload_failed"},
        )

    # Upload video if present (Motion Control)
    video_url = None
    if request.video_url:
        # Direct URL provided (library preset) — skip upload
        video_url = request.video_url
        logger.info(f"Using direct video URL for user {user.user_id}: {video_url[:80]}...")
    elif request.video_base64:
        logger.info(f"Uploading video for user {user.user_id}...")
        try:
            video_url = await upload_client.upload_file(
                request.video_base64,
                user.user_id,
            )
        except Exception as e:
            logger.error(f"Video upload failed: {e}")
            raise HTTPException(
                status_code=500,
                detail={"error": "upload_failed", "message": f"Video upload failed: {str(e)}"},
            )
        
        if not video_url:
            raise HTTPException(
                status_code=500,
                detail={"error": "upload_failed", "message": "Video upload returned no URL"},
            )
    
    try:
        # Route to appropriate model
        if request.model == "minimax-hailuo":
            # Hailuo Image-to-Video Pro
            hailuo = get_hailuo_client()
            
            # Determine duration: 6 or 10 seconds
            duration = HailuoDuration.LONG if request.duration == 10 else HailuoDuration.SHORT
            
            hailuo_request = HailuoGenerateRequest(
                prompt=request.prompt,
                image_url=image_url,
                duration=duration,
                callback_url=f"{settings.api_public_url}/api/callback/hailuo",
            )
            
            task_id = await hailuo.generate(hailuo_request)
            
        elif request.model == "kling-2.6/image-to-video":
            # Kling Image-to-Video
            kling = get_kling_client()
            
            # Determine duration: 5 or 10 seconds
            duration = KlingDuration.LONG if request.duration == 10 else KlingDuration.SHORT
            
            kling_request = KlingGenerateRequest(
                prompt=request.prompt,
                image_url=image_url,
                duration=duration,
                sound=request.sound,
                callback_url=f"{settings.api_public_url}/api/callback/kling",
            )
            
            task_id = await kling.generate(kling_request)

        elif request.model == "kling-2.6/motion-control":
            # Kling Motion Control
            from services.kling_motion import get_kling_motion_client, KlingMotionRequest
            kling_motion = get_kling_motion_client()
            
            if not video_url:
                 raise ValueError("Motion Control requires a video file")

            motion_request = KlingMotionRequest(
                prompt=request.prompt,
                input_urls=[image_url],
                video_urls=[video_url],
                character_orientation=request.character_orientation or "video",
                mode="720p",
                callback_url=f"{settings.api_public_url}/api/callback/kling",
            )
            
            task_id = await kling_motion.generate(motion_request)
            
        else:
            # Default: Veo API
            veo = get_veo_client()
            
            veo_request = VeoGenerateRequest(
                prompt=request.prompt,
                image_urls=[image_url],
                model=VeoModel(request.model),
                aspect_ratio=AspectRatio(request.aspect_ratio),
                callback_url=f"{settings.api_public_url}/api/callback/veo",
            )
            
            task_id = await veo.generate(veo_request)
        
        # Deduct credits
        user.balance.credits -= cost
        await UserRepository.update(user)
        
        # Save to users_queue — only model-relevant fields
        queue_item = {
            "_id": task_id,
            "user_id": user.user_id,
            "model": request.model,
            "prompt": request.prompt,
            "image_url": image_url,
            "status": TaskStatus.PROCESSING.value,
            "credits_charged": cost,
            "created_at": datetime.utcnow(),
            "completed_at": None,
            "result_url": None,
        }
        
        # Add model-specific fields
        if request.model == "minimax-hailuo":
            queue_item["duration"] = request.duration
        elif request.model == "kling-2.6/image-to-video":
            queue_item["duration"] = request.duration
            queue_item["sound"] = request.sound
        elif request.model == "kling-2.6/motion-control":
            queue_item["video_url"] = video_url
            queue_item["duration"] = request.duration
            queue_item["character_orientation"] = request.character_orientation
        # Veo: no extra fields needed (no sound, duration, video_url, character_orientation)
        
        await Database.users_queue.insert_one(queue_item)
        
        # ── Send Telegram notification about task in queue ──
        try:
            from services.notifications import get_notifier
            notifier = get_notifier()

            model_display = {
                "minimax-hailuo": "Hailuo",
                "kling-2.6/image-to-video": "Kling",
                "kling-2.6/motion-control": "Kling Motion Control",
                "veo3_fast": "Veo 3.1",
            }.get(request.model, request.model)

            # Queue position
            total_in_queue = await Database.users_queue.count_documents(
                {"status": TaskStatus.PROCESSING.value}
            )
            user_position = total_in_queue  # latest added = last in queue

            remaining = user.balance.credits
            queue_text = (
                "📋 <b>Задача добавлена в очередь</b>\n\n"
                f"🎬 Модель: {model_display}\n"
                f"📍 Позиция в очереди: #{user_position} из {total_in_queue}\n"
                f"💎 Списано: {cost} кредитов (баланс: {remaining})\n\n"
                "Вы получите уведомление, когда видео будет готово."
            )
            await notifier.send_message(user.user_id, queue_text)
        except Exception as e:
            logger.warning(f"Failed to send queue notification: {e}")
        
        # Save global prompt and image_url
        global_update: dict = {
            "updated_at": datetime.utcnow(),
        }
        
        await Database.db["users"].update_one(
            {"_id": user.user_id},
            {"$set": global_update},
        )
        
        logger.success(f"Task {task_id} started for user {user.user_id}")
        
        return GenerateResponse(
            task_id=task_id,
            status="processing",
            credits_charged=cost,
        )
        
    except ValueError as e:
        logger.error(f"Generation ValueError: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception(f"Unexpected error during generation: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@app.get("/api/status/{task_id}")
async def get_status(
    task_id: str,
    user=Depends(get_current_user),
) -> StatusResponse:
    """Check generation status - routes to appropriate model API"""
    try:
        # Get task from queue to determine model
        queue_item = await Database.db["users_queue"].find_one({"_id": task_id})
        
        if not queue_item:
            raise HTTPException(status_code=404, detail="Task not found")
        
        model = queue_item.get("model", "")
        
        if model == "minimax-hailuo":
            # Hailuo API
            hailuo = get_hailuo_client()
            status = await hailuo.get_status(task_id)
        else:
            # Default: Veo API
            veo = get_veo_client()
            status = await veo.get_status(task_id)
        
        if status.success_flag == 0:
            return StatusResponse(task_id=task_id, status="processing")
        elif status.success_flag == 1:
            return StatusResponse(
                task_id=task_id,
                status="completed",
                result_urls=status.result_urls,
            )
        else:
            return StatusResponse(
                task_id=task_id,
                status="failed",
                error=status.error_message,
            )
            
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/callback/veo")
async def veo_callback(data: dict):
    """Handle Veo API callback"""
    from services.notifications import get_notifier
    
    logger.info(f"Received Veo callback: {data}")
    
    code = data.get("code")
    task_data = data.get("data", {})
    task_id = task_data.get("taskId")
    
    if not task_id:
        return {"status": "ignored"}
    
    # Get task from queue
    queue_item = await Database.users_queue.find_one({"_id": task_id})
    
    if not queue_item:
        logger.warning(f"Task {task_id} not found in queue")
        return {"status": "not_found"}
    
    user_id = queue_item.get("user_id")
    credits_charged = queue_item.get("credits_charged", 0)
    notifier = get_notifier()
    
    # Update queue and notify user
    if code == 200:
        import json
        
        # Try to parse result from resultJson (new format) or info (old format)
        result_urls = []
        if task_data.get("resultJson"):
            try:
                result_json = json.loads(task_data.get("resultJson"))
                result_urls = result_json.get("resultUrls", [])
            except json.JSONDecodeError:
                logger.error(f"Failed to parse resultJson: {task_data.get('resultJson')}")
        elif task_data.get("info"):
             info = task_data.get("info", {})
             raw_urls = info.get("resultUrls", [])
             if isinstance(raw_urls, str):
                 try:
                     result_urls = json.loads(raw_urls)
                 except json.JSONDecodeError:
                     result_urls = []
             else:
                 result_urls = raw_urls
             
        result_url = result_urls[0] if result_urls else None
        
        await Database.users_queue.update_one(
            {"_id": task_id},
            {
                "$set": {
                    "status": TaskStatus.COMPLETED.value,
                    "result_url": result_url,
                    "completed_at": datetime.utcnow(),
                }
            },
        )
        
        # Send video to user
        if result_url and user_id:
            await notifier.notify_generation_complete(
                user_id=user_id,
                video_url=result_url,
                model=queue_item.get("model", ""),
                prompt=queue_item.get("prompt", ""),
            )
        
        logger.success(f"Task {task_id} completed, video sent to user {user_id}")
        
    else:
        # Generation failed - refund credits
        await Database.users_queue.update_one(
            {"_id": task_id},
            {
                "$set": {
                    "status": TaskStatus.FAILED.value,
                    "error_message": data.get("msg"),
                    "completed_at": datetime.utcnow(),
                }
            },
        )
        
        # Refund credits
        if user_id and credits_charged > 0:
            await Database.users.update_one(
                {"_id": user_id},
                {"$inc": {"balance.credits": credits_charged}}
            )
            logger.info(f"Refunded {credits_charged} credits to user {user_id}")
        
        # Notify user about failure
        if user_id:
            await notifier.notify_generation_failed(
                user_id=user_id,
                error=data.get("msg", "Unknown error"),
                credits_refunded=credits_charged,
            )
        
        logger.error(f"Task {task_id} failed: {data.get('msg')}")
    
    return {"status": "received"}


@app.post("/api/callback/hailuo")
async def hailuo_callback(data: dict):
    """Handle Hailuo API callback"""
    from services.notifications import get_notifier
    
    logger.info(f"Received Hailuo callback: {data}")
    
    code = data.get("code")
    task_data = data.get("data", {})
    task_id = task_data.get("taskId")
    
    if not task_id:
        return {"status": "ignored"}
    
    # Get task from queue
    queue_item = await Database.users_queue.find_one({"_id": task_id})
    
    if not queue_item:
        logger.warning(f"[Hailuo] Task {task_id} not found in queue")
        return {"status": "not_found"}
    
    user_id = queue_item.get("user_id")
    credits_charged = queue_item.get("credits_charged", 0)
    notifier = get_notifier()
    
    # Update queue and notify user
    if code == 200:
        import json
        
        # Try to parse result from resultJson (new format) or info (old format)
        result_urls = []
        if task_data.get("resultJson"):
            try:
                result_json = json.loads(task_data.get("resultJson"))
                result_urls = result_json.get("resultUrls", [])
            except json.JSONDecodeError:
                logger.error(f"[Hailuo] Failed to parse resultJson: {task_data.get('resultJson')}")
        elif task_data.get("info"):
             info = task_data.get("info", {})
             result_urls = json.loads(info.get("resultUrls", "[]")) if info.get("resultUrls") else []
             
        result_url = result_urls[0] if result_urls else None
        
        await Database.users_queue.update_one(
            {"_id": task_id},
            {
                "$set": {
                    "status": TaskStatus.COMPLETED.value,
                    "result_url": result_url,
                    "completed_at": datetime.utcnow(),
                }
            },
        )
        
        # Send video to user
        if result_url and user_id:
            await notifier.notify_generation_complete(
                user_id=user_id,
                video_url=result_url,
                model=queue_item.get("model", ""),
                prompt=queue_item.get("prompt", ""),
            )
            logger.success(f"[Hailuo] Task {task_id} completed, video sent to user {user_id}")
        else:
            logger.warning(f"[Hailuo] Task {task_id} completed but no video URL found or user_id missing")
        
    else:
        # Generation failed - refund credits
        await Database.users_queue.update_one(
            {"_id": task_id},
            {
                "$set": {
                    "status": TaskStatus.FAILED.value,
                    "error_message": data.get("msg"),
                    "completed_at": datetime.utcnow(),
                }
            },
        )
        
        # Refund credits
        if user_id and credits_charged > 0:
            await Database.users.update_one(
                {"_id": user_id},
                {"$inc": {"balance.credits": credits_charged}}
            )
            logger.info(f"[Hailuo] Refunded {credits_charged} credits to user {user_id}")
        
        # Notify user about failure
        if user_id:
            await notifier.notify_generation_failed(
                user_id=user_id,
                error=data.get("msg", "Unknown error"),
                credits_refunded=credits_charged,
            )
        
        logger.error(f"[Hailuo] Task {task_id} failed: {data.get('msg')}")
    
    return {"status": "received"}


@app.post("/api/callback/kling")
async def kling_callback(data: dict):
    """Handle Kling API callback"""
    from services.notifications import get_notifier
    
    logger.info(f"[Kling] Received callback: {data}")
    
    code = data.get("code")
    task_data = data.get("data", {})
    task_id = task_data.get("taskId")
    
    if not task_id:
        return {"status": "ignored"}
    
    # Get task from queue
    queue_item = await Database.users_queue.find_one({"_id": task_id})
    
    if not queue_item:
        logger.warning(f"[Kling] Task {task_id} not found in queue")
        return {"status": "not_found"}
    
    user_id = queue_item.get("user_id")
    credits_charged = queue_item.get("credits_charged", 0)
    notifier = get_notifier()
    
    # Update queue and notify user
    if code == 200:
        import json
        
        # Try to parse result from resultJson (new format) or info (old format)
        result_urls = []
        if task_data.get("resultJson"):
            try:
                result_json = json.loads(task_data.get("resultJson"))
                result_urls = result_json.get("resultUrls", [])
            except json.JSONDecodeError:
                logger.error(f"[Kling] Failed to parse resultJson: {task_data.get('resultJson')}")
        elif task_data.get("info"):
             info = task_data.get("info", {})
             result_urls = json.loads(info.get("resultUrls", "[]")) if info.get("resultUrls") else []
             
        result_url = result_urls[0] if result_urls else None
        
        await Database.users_queue.update_one(
            {"_id": task_id},
            {
                "$set": {
                    "status": TaskStatus.COMPLETED.value,
                    "result_url": result_url,
                    "completed_at": datetime.utcnow(),
                }
            },
        )
        
        # Send video to user
        if result_url and user_id:
            await notifier.notify_generation_complete(
                user_id=user_id,
                video_url=result_url,
                model=queue_item.get("model", ""),
                prompt=queue_item.get("prompt", ""),
            )
            logger.success(f"[Kling] Task {task_id} completed, video sent to user {user_id}")
        else:
            logger.warning(f"[Kling] Task {task_id} completed but no video URL found or user_id missing")
        
    else:
        # Generation failed - refund credits
        await Database.users_queue.update_one(
            {"_id": task_id},
            {
                "$set": {
                    "status": TaskStatus.FAILED.value,
                    "error_message": data.get("msg"),
                    "completed_at": datetime.utcnow(),
                }
            },
        )
        
        # Refund credits
        if user_id and credits_charged > 0:
            await Database.users.update_one(
                {"_id": user_id},
                {"$inc": {"balance.credits": credits_charged}}
            )
            logger.info(f"[Kling] Refunded {credits_charged} credits to user {user_id}")
        
        # Notify user about failure
        if user_id:
            await notifier.notify_generation_failed(
                user_id=user_id,
                error=data.get("msg", "Unknown error"),
                credits_refunded=credits_charged,
            )
        
        logger.error(f"[Kling] Task {task_id} failed: {data.get('msg')}")
    
    return {"status": "received"}


# ── Payment Endpoints ──────────────────────────────────────

class CreatePaymentRequest(BaseModel):
    plan_id: str  # "starter", "creator", "pro"


@app.post("/api/payment/create")
async def create_payment(
    request: CreatePaymentRequest,
    user=Depends(get_current_user),
):
    """Create a YooKassa payment and return confirmation_token for widget.
    
    Reuses existing pending payment for the same plan if still valid.
    Cancels orphaned pending payments for other plans.
    """
    plan = PLANS.get(request.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail={"error": "invalid_plan", "message": "Unknown plan ID"})

    yookassa = get_yookassa_client()

    # ── 1. Check for existing pending payment on the SAME plan ──
    existing = await Database.db.payments.find_one({
        "user_id": user.user_id,
        "plan_id": request.plan_id,
        "status": "pending",
    })

    if existing and existing.get("confirmation_token"):
        # Verify it's still pending at YooKassa (payments expire after ~10 min)
        try:
            yookassa_payment = await yookassa.get_payment(existing["_id"])
            yookassa_status = yookassa_payment.get("status")
        except Exception as e:
            logger.warning(f"[Payment] Failed to check existing payment {existing['_id']}: {e}")
            yookassa_status = None

        if yookassa_status == "pending":
            # Still valid — reuse it
            logger.info(
                f"[Payment] Reusing pending payment {existing['_id']} "
                f"for user {user.user_id}, plan={request.plan_id}"
            )
            return {
                "payment_id": existing["_id"],
                "confirmation_token": existing["confirmation_token"],
            }
        else:
            # Expired or canceled — update our DB record
            await Database.db.payments.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "status": yookassa_status or "canceled",
                    "completed_at": datetime.utcnow(),
                }},
            )
            logger.info(
                f"[Payment] Existing payment {existing['_id']} is {yookassa_status}, "
                f"will create new one"
            )

    # ── 2. Cancel orphaned pending payments for OTHER plans ──
    await Database.db.payments.update_many(
        {
            "user_id": user.user_id,
            "status": "pending",
            "plan_id": {"$ne": request.plan_id},
        },
        {"$set": {
            "status": "canceled",
            "completed_at": datetime.utcnow(),
        }},
    )

    # ── 3. Create new payment via YooKassa ──
    try:
        payment = await yookassa.create_payment(
            amount=plan["amount"],
            currency=plan["currency"],
            description=f"Покупка {plan['credits']} кредитов — {plan['name']}",
            metadata={
                "user_id": str(user.user_id),
                "plan_id": request.plan_id,
                "credits": str(plan["credits"]),
            },
        )
    except Exception as e:
        logger.error(f"[Payment] Failed to create payment: {e}")
        raise HTTPException(status_code=500, detail={"error": "payment_creation_failed"})

    confirmation_token = payment.get("confirmation", {}).get("confirmation_token")
    if not confirmation_token:
        logger.error(f"[Payment] No confirmation_token in response: {payment}")
        raise HTTPException(status_code=500, detail={"error": "no_confirmation_token"})

    # Save payment record to DB (with token for reuse)
    await Database.db.payments.insert_one({
        "_id": payment["id"],
        "user_id": user.user_id,
        "plan_id": request.plan_id,
        "credits": plan["credits"],
        "amount": plan["amount"],
        "currency": plan["currency"],
        "status": "pending",
        "confirmation_token": confirmation_token,
        "created_at": datetime.utcnow(),
        "completed_at": None,
    })

    logger.info(f"[Payment] Created payment {payment['id']} for user {user.user_id}, plan={request.plan_id}")

    return {
        "payment_id": payment["id"],
        "confirmation_token": confirmation_token,
    }


async def _record_revenue_event(payment_id: str, user_id: int, amount: str):
    """Record a revenue event in ref_events (idempotent by payment_id).

    Called from both payment_webhook and verify_payment to ensure
    revenue is always attributed regardless of which path fires first.
    """
    try:
        paying_user = await Database._db["users"].find_one(
            {"_id": user_id},
            {"referred_by_user_id": 1, "referred_by_tag": 1},
        )
        ref_user_id = paying_user.get("referred_by_user_id") if paying_user else None
        ref_tag = paying_user.get("referred_by_tag") if paying_user else None

        now = datetime.utcnow()
        await Database._db["ref_events"].update_one(
            {"type": "revenue", "payment_id": payment_id},
            {"$setOnInsert": {
                "type": "revenue",
                "referrer_user_id": ref_user_id,
                "tag": ref_tag,
                "triggered_user_id": user_id,
                "is_new_user": False,
                "payment_id": payment_id,
                "amount": int(float(amount)),
                "created_at": now,
                "date": now.strftime("%Y-%m-%d"),
            }},
            upsert=True,
        )
        if ref_tag:
            logger.info(
                f"[Referral Revenue] Payment {payment_id}: "
                f"{amount} RUB → referrer {ref_user_id} tag '{ref_tag}'"
            )
        else:
            logger.info(
                f"[Organic Revenue] Payment {payment_id}: "
                f"{amount} RUB from organic user {user_id}"
            )
    except Exception as e:
        logger.error(f"[Revenue Attribution] Failed for payment {payment_id}: {e}")


@app.post("/api/payment/webhook")
async def payment_webhook(request: Request):
    """Handle YooKassa payment webhook notifications"""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = data.get("event")
    obj = data.get("object", {})
    payment_id = obj.get("id")

    logger.info(f"[Payment Webhook] event={event}, payment_id={payment_id}")

    if not payment_id:
        return {"status": "ignored"}

    # Find payment in our DB
    payment_record = await Database.db.payments.find_one({"_id": payment_id})
    if not payment_record:
        logger.warning(f"[Payment Webhook] Payment {payment_id} not found in DB")
        return {"status": "not_found"}

    if event == "payment.succeeded":
        # Already processed?
        if payment_record["status"] == "succeeded":
            logger.info(f"[Payment Webhook] Payment {payment_id} already processed")
            return {"status": "already_processed"}

        credits_to_add = payment_record["credits"]
        user_id = payment_record["user_id"]

        # Add credits to user + set expiration to 30 days from now
        expiration = datetime.utcnow() + timedelta(days=30)
        await Database.users.update_one(
            {"_id": user_id},
            {
                "$inc": {"balance.credits": credits_to_add},
                "$set": {
                    "balance.expiration_date": expiration,
                    "balance.expiry_warned": False,
                },
            },
        )

        # Update payment status
        await Database.db.payments.update_one(
            {"_id": payment_id},
            {"$set": {
                "status": "succeeded",
                "completed_at": datetime.utcnow(),
            }},
        )

        # ── Revenue event (idempotent helper) ──
        await _record_revenue_event(payment_id, user_id, payment_record["amount"])

        logger.info(
            f"[Payment Webhook] Payment {payment_id} succeeded: "
            f"+{credits_to_add} credits to user {user_id}"
        )

    elif event == "payment.canceled":
        await Database.db.payments.update_one(
            {"_id": payment_id},
            {"$set": {
                "status": "canceled",
                "completed_at": datetime.utcnow(),
            }},
        )
        logger.info(f"[Payment Webhook] Payment {payment_id} canceled")

    return {"status": "ok"}


class VerifyPaymentRequest(BaseModel):
    payment_id: str


@app.post("/api/payment/verify")
async def verify_payment(
    request: VerifyPaymentRequest,
    user=Depends(get_current_user),
):
    """
    Verify a payment after widget success event (fallback for webhook).
    Checks payment status with YooKassa API and credits user if succeeded.
    """
    # Find payment in our DB
    payment_record = await Database.db.payments.find_one({"_id": request.payment_id})
    if not payment_record:
        raise HTTPException(status_code=404, detail={"error": "payment_not_found"})

    # Check that payment belongs to this user
    if payment_record["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail={"error": "forbidden"})

    # Already processed?
    if payment_record["status"] == "succeeded":
        logger.info(f"[Payment Verify] Payment {request.payment_id} already processed")
        return {"status": "already_processed", "credits": payment_record["credits"]}

    # Check payment status with YooKassa
    yookassa = get_yookassa_client()
    try:
        yookassa_payment = await yookassa.get_payment(request.payment_id)
    except Exception as e:
        logger.error(f"[Payment Verify] Failed to check payment: {e}")
        raise HTTPException(status_code=500, detail={"error": "verification_failed"})

    yookassa_status = yookassa_payment.get("status")
    logger.info(f"[Payment Verify] Payment {request.payment_id} YooKassa status: {yookassa_status}")

    if yookassa_status == "succeeded":
        credits_to_add = payment_record["credits"]

        # Add credits to user + set expiration to 30 days from now
        expiration = datetime.utcnow() + timedelta(days=30)
        await Database.users.update_one(
            {"_id": user.user_id},
            {
                "$inc": {"balance.credits": credits_to_add},
                "$set": {
                    "balance.expiration_date": expiration,
                    "balance.expiry_warned": False,
                },
            },
        )

        # Update payment status
        await Database.db.payments.update_one(
            {"_id": request.payment_id},
            {"$set": {
                "status": "succeeded",
                "completed_at": datetime.utcnow(),
            }},
        )

        # ── Revenue event (idempotent helper) ──
        await _record_revenue_event(
            request.payment_id, user.user_id, payment_record["amount"]
        )

        logger.info(
            f"[Payment Verify] Payment {request.payment_id} verified: "
            f"+{credits_to_add} credits to user {user.user_id}"
        )

        return {"status": "succeeded", "credits": credits_to_add}

    elif yookassa_status == "canceled":
        await Database.db.payments.update_one(
            {"_id": request.payment_id},
            {"$set": {
                "status": "canceled",
                "completed_at": datetime.utcnow(),
            }},
        )
        return {"status": "canceled"}

    # Still pending or waiting_for_capture
    return {"status": yookassa_status}


# ── Referral Tag Endpoints ──────────────────────────────────────

class CreateRefTagRequest(BaseModel):
    name: str


@app.post("/api/ref-tags")
async def create_ref_tag(
    request: CreateRefTagRequest,
    user=Depends(get_current_user),
):
    """Create a new referral tag for the current user"""
    import re
    name = request.name.strip().lower()

    if not name:
        raise HTTPException(status_code=400, detail={"error": "empty_name"})
    if not re.match(r'^[a-zA-Z0-9_-]+$', name):
        raise HTTPException(status_code=400, detail={"error": "invalid_characters"})

    # Check if this user already has this tag
    if any(t.name == name for t in user.ref_tags):
        raise HTTPException(status_code=409, detail={"error": "tag_exists"})

    # Check global uniqueness (no two users can own the same tag)
    existing_owner = await Database.users.find_one(
        {"ref_tags.name": name},
        {"_id": 1},
    )
    if existing_owner:
        raise HTTPException(status_code=409, detail={"error": "tag_taken"})

    now = datetime.utcnow()
    await Database.users.update_one(
        {"_id": user.user_id},
        {"$push": {"ref_tags": {"name": name, "created_at": now}}},
    )

    logger.info(f"[RefTag] User {user.user_id} created tag '{name}'")
    return {"status": "ok", "name": name, "created_at": now.isoformat()}


@app.delete("/api/ref-tags/{tag_name}")
async def delete_ref_tag(
    tag_name: str,
    user=Depends(get_current_user),
):
    """Delete a referral tag owned by the current user"""
    tag_name = tag_name.strip().lower()

    # Check ownership
    if not any(t.name == tag_name for t in user.ref_tags):
        raise HTTPException(status_code=404, detail={"error": "tag_not_found"})

    await Database.users.update_one(
        {"_id": user.user_id},
        {"$pull": {"ref_tags": {"name": tag_name}}},
    )

    # Clean up associated events so stats don't persist on re-creation
    await Database._db["ref_events"].delete_many({
        "referrer_user_id": user.user_id,
        "tag": tag_name,
    })

    logger.info(f"[RefTag] User {user.user_id} deleted tag '{tag_name}' + cleaned ref_events")
    return {"status": "ok"}


async def _build_tag_stats(
    match_filter: dict,
    days: int = 7,
) -> dict:
    """Build TagStats (users, buyers, totalRevenue, dailyData) from ref_events.

    `match_filter` is used to scope the aggregation (e.g. by tag, by user, or global).
    """
    from datetime import timedelta

    now = datetime.utcnow()
    cutoff = (now - timedelta(days=days)).strftime("%Y-%m-%d")

    # ── Totals (all-time) ──
    totals_pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": "$type",
            "count": {"$sum": 1},
            "total_amount": {"$sum": {"$ifNull": ["$amount", 0]}},
            "unique_payers": {"$addToSet": {
                "$cond": [{"$eq": ["$type", "revenue"]}, "$triggered_user_id", None]
            }},
        }},
    ]
    totals = {}
    cursor = await Database._db["ref_events"].aggregate(totals_pipeline)
    async for doc in cursor:
        totals[doc["_id"]] = doc

    click_total = totals.get("click", {}).get("count", 0)
    revenue_total = totals.get("revenue", {}).get("total_amount", 0)
    # Count unique paying users (exclude None from the set)
    revenue_payers = totals.get("revenue", {}).get("unique_payers", [])
    buyers_total = len([p for p in revenue_payers if p is not None])

    # ── Daily breakdown (last N days) ──
    daily_match = {**match_filter, "date": {"$gte": cutoff}}
    daily_pipeline = [
        {"$match": daily_match},
        {"$group": {
            "_id": {"date": "$date", "type": "$type"},
            "count": {"$sum": 1},
            "unique_payers": {"$addToSet": {
                "$cond": [{"$eq": ["$type", "revenue"]}, "$triggered_user_id", None]
            }},
        }},
    ]

    daily_map: dict[str, dict] = {}
    # Pre-fill all days
    for i in range(days, -1, -1):
        d = now - timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        # Format label in Russian-style short date
        day_num = d.day
        month_names = ["", "янв.", "фев.", "мар.", "апр.", "мая", "июн.",
                       "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."]
        label = f"{day_num} {month_names[d.month]}"
        daily_map[date_str] = {"date": date_str, "label": label, "users": 0, "buyers": 0}

    daily_cursor = await Database._db["ref_events"].aggregate(daily_pipeline)
    async for doc in daily_cursor:
        date_str = doc["_id"]["date"]
        event_type = doc["_id"]["type"]
        if date_str not in daily_map:
            continue
        if event_type == "click":
            daily_map[date_str]["users"] += doc["count"]
        elif event_type == "revenue":
            payers = [p for p in doc.get("unique_payers", []) if p is not None]
            daily_map[date_str]["buyers"] += len(payers)

    daily_data = sorted(daily_map.values(), key=lambda x: x["date"])

    return {
        "users": click_total,
        "buyers": buyers_total,
        "total_revenue": revenue_total,
        "daily_data": daily_data,
    }


@app.get("/api/ref-tags")
async def list_ref_tags(
    user=Depends(get_current_user),
):
    """List user's referral tags with stats"""
    import asyncio

    # Build stats for all tags in parallel instead of sequentially
    async def build_one(tag):
        stats = await _build_tag_stats({
            "referrer_user_id": user.user_id,
            "tag": tag.name,
        })
        return {
            "name": tag.name,
            "created_at": tag.created_at.isoformat(),
            "stats": stats,
        }

    tags_out = await asyncio.gather(*(build_one(tag) for tag in user.ref_tags))

    # Global tag count (across all users)
    global_count_pipeline = [
        {"$unwind": "$ref_tags"},
        {"$count": "total"},
    ]
    count_cursor = await Database._db["users"].aggregate(global_count_pipeline)
    count_result = await count_cursor.to_list(1)
    global_tag_count = count_result[0]["total"] if count_result else 0

    return {"tags": list(tags_out), "global_tag_count": global_tag_count}


@app.get("/api/ref-tags/summary")
async def ref_tags_summary(
    user=Depends(get_current_user),
):
    """Get aggregated stats across all of the current user's tags"""
    tag_names = [t.name for t in user.ref_tags]
    if not tag_names:
        return {"users": 0, "buyers": 0, "total_revenue": 0, "daily_data": []}

    stats = await _build_tag_stats({
        "referrer_user_id": user.user_id,
        "tag": {"$in": tag_names},
    })
    return stats


@app.get("/api/ref-tags/global")
async def ref_tags_global(
    user=Depends(get_current_user),
):
    """Get global stats across ALL ref_events (all users, all tags)"""
    stats = await _build_tag_stats({})  # No filter = everything
    return stats


@app.get("/api/bot-stats")
async def bot_stats(
    user=Depends(get_current_user),
):
    """Get bot-wide statistics from users and payments collections."""
    from datetime import timedelta

    now = datetime.utcnow()
    days = 7
    cutoff = now - timedelta(days=days)

    # ── Totals ──
    total_users = await Database.users.count_documents({})

    # Buyers & revenue from payments
    payments_pipeline = [
        {"$match": {"status": "succeeded"}},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": {"$toDouble": "$amount"}},
            "unique_buyers": {"$addToSet": "$user_id"},
        }},
    ]
    pay_cursor = await Database.db.payments.aggregate(payments_pipeline)
    pay_result = await pay_cursor.to_list(1)
    total_revenue = pay_result[0]["total_revenue"] if pay_result else 0
    total_buyers = len(pay_result[0]["unique_buyers"]) if pay_result else 0

    # ── Daily breakdown ──
    month_names = ["", "янв.", "фев.", "мар.", "апр.", "мая", "июн.",
                   "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."]

    daily_map: dict[str, dict] = {}
    for i in range(days, -1, -1):
        d = now - timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        label = f"{d.day} {month_names[d.month]}"
        daily_map[date_str] = {"date": date_str, "label": label, "users": 0, "buyers": 0}

    # Daily new users
    users_daily = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1},
        }},
    ]
    async for doc in await Database.users.aggregate(users_daily):
        if doc["_id"] in daily_map:
            daily_map[doc["_id"]]["users"] = doc["count"]

    # Daily buyers
    payments_daily = [
        {"$match": {"status": "succeeded", "completed_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$completed_at"}},
            "unique_buyers": {"$addToSet": "$user_id"},
        }},
    ]
    async for doc in await Database.db.payments.aggregate(payments_daily):
        if doc["_id"] in daily_map:
            daily_map[doc["_id"]]["buyers"] = len(doc["unique_buyers"])

    daily_data = sorted(daily_map.values(), key=lambda x: x["date"])

    return {
        "users": total_users,
        "buyers": total_buyers,
        "total_revenue": total_revenue,
        "daily_data": daily_data,
    }


@app.get("/api/ref-tags/{tag_name}/stats")
async def ref_tag_detail_stats(
    tag_name: str,
    user=Depends(get_current_user),
):
    """Get 7-day stats for a single tag owned by the current user"""
    tag_name = tag_name.strip().lower()

    if not any(t.name == tag_name for t in user.ref_tags):
        raise HTTPException(status_code=404, detail={"error": "tag_not_found"})

    stats = await _build_tag_stats({
        "referrer_user_id": user.user_id,
        "tag": tag_name,
    })
    return stats


# ── Static Files (Frontend) ──
# This allows serving the frontend from the same container
static_dir = "/app/static"
if os.path.exists(static_dir):
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    # Mount Next.js static assets checks
    if os.path.exists(os.path.join(static_dir, "_next")):
        app.mount("/_next", StaticFiles(directory=os.path.join(static_dir, "_next")), name="next")
    
    # Mount other static assets
    if os.path.exists(os.path.join(static_dir, "images")):
        app.mount("/images", StaticFiles(directory=os.path.join(static_dir, "images")), name="images")

    # Catch-all for SPA routing (must be last)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # API routes are already handled above by precedence
        if full_path.startswith("api/"):
            raise HTTPException(404, "API route not found")
        
        # Try to serve file if exists
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Fallback to index.html for SPA
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        
        raise HTTPException(404, "Not found")
