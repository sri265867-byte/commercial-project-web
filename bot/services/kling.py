from typing import Optional
from enum import Enum
import aiohttp
from pydantic import BaseModel
from loguru import logger

from config import get_settings

class KlingModel(str, Enum):
    IMAGE_TO_VIDEO = "kling-2.6/image-to-video"

class KlingDuration(str, Enum):
    SHORT = "5"
    LONG = "10"

class KlingGenerateRequest(BaseModel):
    """Request model for Kling-2.6 video generation"""
    prompt: Optional[str] = None
    image_url: str  # We take single URL but send as list
    duration: KlingDuration = KlingDuration.SHORT
    sound: bool = False
    callback_url: Optional[str] = None

class KlingClient:
    """Async client for Kling API (kie.ai)"""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key or settings.kie_api_key
        # Use market API base endpoint
        self.base_url = base_url or settings.kie_api_base
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
            )
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()


    async def generate(self, request: KlingGenerateRequest) -> str:
        """
        Start video generation task.
        Returns task_id on success.
        """
        session = await self._get_session()
        
        # Image to Video
        payload = {
            "model": KlingModel.IMAGE_TO_VIDEO.value,
            "input": {
                "prompt": request.prompt,
                "image_urls": [request.image_url],  # Kling expects a list
                "duration": request.duration.value,
                "sound": request.sound,
            }
        }

        if request.callback_url:
            payload["callBackUrl"] = request.callback_url

        logger.info(f"[Kling] Generating video with prompt: {request.prompt[:50]}...")
        logger.info(f"[Kling] Duration: {request.duration.value}s, Sound: {request.sound}")

        async with session.post(
            f"{self.base_url}/api/v1/jobs/createTask",
            json=payload,
        ) as response:
            data = await response.json()
            
            if response.status == 200 and data.get("code") == 200:
                task_id = data["data"]["taskId"]
                logger.success(f"[Kling] Task created: {task_id}")
                return task_id
            else:
                error_msg = data.get("msg", "Unknown error")
                logger.error(f"[Kling] Generation failed: {error_msg}")
                raise ValueError(f"Generation failed: {error_msg}")

# Singleton client
_kling_client: Optional[KlingClient] = None

def get_kling_client() -> KlingClient:
    global _kling_client
    if _kling_client is None:
        _kling_client = KlingClient()
    return _kling_client
