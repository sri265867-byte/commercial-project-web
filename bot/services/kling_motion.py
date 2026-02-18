from typing import Optional, List
import aiohttp
from pydantic import BaseModel
from loguru import logger

from config import get_settings

class KlingMotionRequest(BaseModel):
    """Request model for Kling Motion Control"""
    prompt: Optional[str] = None
    input_urls: List[str] # Image URL
    video_urls: List[str] # Video URL
    character_orientation: str = "video"
    mode: str = "720p"
    callback_url: Optional[str] = None

class KlingMotionClient:
    """Async client for Kling Motion Control API"""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key or settings.kie_api_key
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

    async def generate(self, request: KlingMotionRequest) -> str:
        """
        Start motion control generation task.
        """
        session = await self._get_session()
        
        payload = {
            "model": "kling-2.6/motion-control",
            "input": {
                "prompt": request.prompt or "",
                "input_urls": request.input_urls,
                "video_urls": request.video_urls,
                "character_orientation": request.character_orientation,
                "mode": request.mode,
            }
        }

        if request.callback_url:
            payload["callBackUrl"] = request.callback_url

        logger.info(f"[KlingMotion] Generating with prompt: {request.prompt[:50]}...")
        
        async with session.post(
            f"{self.base_url}/api/v1/jobs/createTask",
            json=payload,
        ) as response:
            data = await response.json()
            
            if response.status == 200 and data.get("code") == 200:
                task_id = data["data"]["taskId"]
                logger.success(f"[KlingMotion] Task created: {task_id}")
                return task_id
            else:
                error_msg = data.get("msg", "Unknown error")
                logger.error(f"[KlingMotion] Generation failed: {error_msg}")
                raise ValueError(f"Generation failed: {error_msg}")

# Singleton
_kling_motion_client: Optional[KlingMotionClient] = None

def get_kling_motion_client() -> KlingMotionClient:
    global _kling_motion_client
    if _kling_motion_client is None:
        _kling_motion_client = KlingMotionClient()
    return _kling_motion_client
