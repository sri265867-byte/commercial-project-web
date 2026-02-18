"""
Hailuo Image-to-Video Pro API Client
Model: hailuo/2-3-image-to-video-pro
"""
from typing import Optional
from enum import Enum
import aiohttp
from pydantic import BaseModel
from loguru import logger

from config import get_settings


class HailuoDuration(str, Enum):
    SHORT = "6"
    LONG = "10"


class HailuoResolution(str, Enum):
    HD = "768P"


class HailuoGenerateRequest(BaseModel):
    """Request model for Hailuo video generation"""
    prompt: str
    image_url: str
    duration: HailuoDuration = HailuoDuration.SHORT
    resolution: HailuoResolution = HailuoResolution.HD
    callback_url: Optional[str] = None


class HailuoTaskStatus(BaseModel):
    """Task status response"""
    task_id: str
    success_flag: int  # 0=processing, 1=success, 2/3=failed
    result_urls: Optional[list[str]] = None
    error_message: Optional[str] = None


class HailuoClient:
    """Async client for Hailuo Image-to-Video Pro API (kie.ai)"""

    MODEL_NAME = "hailuo/2-3-image-to-video-pro"
    
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key or settings.kie_api_key
        self.base_url = base_url or "https://api.kie.ai"
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

    async def generate(self, request: HailuoGenerateRequest) -> str:
        """
        Start video generation task.
        Returns task_id on success.
        Raises ValueError on error.
        """
        session = await self._get_session()
        
        payload = {
            "model": self.MODEL_NAME,
            "input": {
                "prompt": request.prompt,
                "image_url": request.image_url,
                "duration": request.duration.value,
                "resolution": request.resolution.value,
            },
        }
        
        if request.callback_url:
            payload["callBackUrl"] = request.callback_url

        logger.info(f"[Hailuo] Generating video with prompt: {request.prompt[:50]}...")
        logger.info(f"[Hailuo] Duration: {request.duration.value}s, Resolution: {request.resolution.value}")

        async with session.post(
            f"{self.base_url}/api/v1/jobs/createTask",
            json=payload,
        ) as response:
            data = await response.json()
            
            if response.status == 200 and data.get("code") == 200:
                task_id = data["data"]["taskId"]
                logger.success(f"[Hailuo] Task created: {task_id}")
                return task_id
            else:
                error_msg = data.get("msg", "Unknown error")
                logger.error(f"[Hailuo] Generation failed: {error_msg}")
                raise ValueError(f"Hailuo generation failed: {error_msg}")

    async def get_status(self, task_id: str) -> HailuoTaskStatus:
        """
        Check task status via Get Task Detail endpoint.
        Returns HailuoTaskStatus with current state.
        """
        session = await self._get_session()

        async with session.get(
            f"{self.base_url}/api/v1/jobs/getTaskDetail",
            params={"taskId": task_id},
        ) as response:
            data = await response.json()
            
            if response.status == 200 and data.get("code") == 200:
                task_data = data.get("data", {})
                
                # Parse result URLs from response
                result_urls = None
                info = task_data.get("info", {})
                if info and info.get("resultUrls"):
                    import json
                    try:
                        result_urls = json.loads(info["resultUrls"])
                    except (json.JSONDecodeError, TypeError):
                        result_urls = None
                
                return HailuoTaskStatus(
                    task_id=task_id,
                    success_flag=task_data.get("successFlag", 0),
                    result_urls=result_urls,
                    error_message=data.get("msg") if task_data.get("successFlag", 0) > 1 else None,
                )
            else:
                raise ValueError(f"Hailuo status check failed: {data.get('msg', 'Unknown error')}")


# Singleton client
_hailuo_client: Optional[HailuoClient] = None


def get_hailuo_client() -> HailuoClient:
    global _hailuo_client
    if _hailuo_client is None:
        _hailuo_client = HailuoClient()
    return _hailuo_client
