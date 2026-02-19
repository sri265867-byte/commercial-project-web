"""
Telegram notification service for sending results to users
"""
import aiohttp
from loguru import logger
from config import get_settings


class TelegramNotifier:
    """Send notifications to users via Telegram Bot API"""
    
    def __init__(self):
        settings = get_settings()
        self.bot_token = settings.bot_token
        self.api_base = f"https://api.telegram.org/bot{self.bot_token}"
    
    async def send_video(
        self,
        user_id: int,
        video_url: str,
        caption: str = "🎬 Your video is ready!",
    ) -> bool:
        """
        Send video to user
        
        Args:
            user_id: Telegram user ID
            video_url: URL of the video file
            caption: Message caption
            
        Returns:
            True if sent successfully
        """
        try:
            async with aiohttp.ClientSession() as session:
                # Try sending as video first
                async with session.post(
                    f"{self.api_base}/sendVideo",
                    json={
                        "chat_id": user_id,
                        "video": video_url,
                        "caption": caption,
                        "parse_mode": "HTML",
                    }
                ) as response:
                    data = await response.json()
                    
                    if data.get("ok"):
                        logger.success(f"Video sent to user {user_id}")
                        return True
                    else:
                        # If video fails, try as document
                        logger.warning(f"sendVideo failed: {data}, trying sendDocument...")
                        
            # Fallback to document
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_base}/sendDocument",
                    json={
                        "chat_id": user_id,
                        "document": video_url,
                        "caption": caption,
                        "parse_mode": "HTML",
                    }
                ) as response:
                    data = await response.json()
                    
                    if data.get("ok"):
                        logger.success(f"Document sent to user {user_id}")
                        return True
                    else:
                        logger.error(f"sendDocument failed: {data}")
                        return False
                        
        except Exception as e:
            logger.error(f"Failed to send video to user {user_id}: {e}")
            return False
    
    async def send_message(
        self,
        user_id: int,
        text: str,
    ) -> bool:
        """Send text message to user"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_base}/sendMessage",
                    json={
                        "chat_id": user_id,
                        "text": text,
                        "parse_mode": "HTML",
                    }
                ) as response:
                    data = await response.json()
                    
                    if data.get("ok"):
                        logger.success(f"Message sent to user {user_id}")
                        return True
                    else:
                        logger.error(f"sendMessage failed: {data}")
                        return False
                        
        except Exception as e:
            logger.error(f"Failed to send message to user {user_id}: {e}")
            return False

    async def notify_admins(self, text: str) -> None:
        """Send log notification to all admin users"""
        settings = get_settings()
        for admin_id in settings.admin_ids:
            try:
                await self.send_message(admin_id, text)
            except Exception as e:
                logger.warning(f"Failed to notify admin {admin_id}: {e}")

    async def notify_generation_complete(
        self,
        user_id: int,
        video_url: str,
        model: str,
        prompt: str,
    ) -> bool:
        """Send generation complete notification with video"""
        model_names = {
            "veo3_fast": "Veo 3.1",
            "minimax-hailuo": "Minimax Hailuo",
            "kling-2.6/image-to-video": "Kling 2.6",
            "kling-2.6/motion-control": "Kling Motion Control",
        }
        model_name = model_names.get(model, model)
        
        caption = (
            f"✅ <b>ВИДЕО СГЕНЕРИРОВАНО</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n\n"
            f"🤖 Модель: {model_name}\n"
            f"💬 Промпт: <i>{prompt[:100]}{'...' if len(prompt) > 100 else ''}</i>"
        )
        
        return await self.send_video(user_id, video_url, caption)

    async def notify_generation_failed(
        self,
        user_id: int,
        error: str,
        credits_refunded: int,
    ) -> bool:
        """Send generation failed notification"""
        logger.error(f"[Generation Failed] user={user_id}, error={error}")
        
        text = (
            f"❌ <b>ОШИБКА ГЕНЕРАЦИИ</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n\n"
            f"К сожалению, генерация не удалась.\n"
            f"💎 <b>{credits_refunded} кредитов</b> возвращены на ваш баланс.\n\n"
            f"Если проблема повторяется, напишите: @kalomaze"
        )
        
        return await self.send_message(user_id, text)


# Singleton
_notifier = None

def get_notifier() -> TelegramNotifier:
    global _notifier
    if _notifier is None:
        _notifier = TelegramNotifier()
    return _notifier
