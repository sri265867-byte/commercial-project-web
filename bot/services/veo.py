from typing import Optional
from enum import Enum
import aiohttp
from pydantic import BaseModel
from loguru import logger

from config import get_settings


class VeoModel(str, Enum):
    FAST = "veo3_fast"


class AspectRatio(str, Enum):
    LANDSCAPE = "16:9"
    PORTRAIT = "9:16"
    AUTO = "Auto"


class GenerationType(str, Enum):
    TEXT_TO_VIDEO = "TEXT_2_VIDEO"
    IMAGE_TO_VIDEO = "FIRST_AND_LAST_FRAMES_2_VIDEO"
    REFERENCE = "REFERENCE_2_VIDEO"


class VeoGenerateRequest(BaseModel):
    """Request model for Veo video generation"""
    prompt: str
    image_urls: list[str]  # required for image-to-video
    model: VeoModel = VeoModel.FAST
    aspect_ratio: AspectRatio = AspectRatio.AUTO
    generation_type: GenerationType = GenerationType.IMAGE_TO_VIDEO
    seeds: Optional[int] = None
    callback_url: Optional[str] = None
    enable_translation: bool = True
    watermark: Optional[str] = None


class VeoTaskStatus(BaseModel):
    """Task status response"""
    task_id: str
    success_flag: int  # 0=processing, 1=success, 2/3=failed
    result_urls: Optional[list[str]] = None
    error_message: Optional[str] = None


class VeoClient:
    """Async client for Veo 3.1 API (kie.ai)"""

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

    async def generate(self, request: VeoGenerateRequest) -> str:
        """
        Start video generation task.
        Returns task_id on success.
        Raises ValueError on error.
        """
        session = await self._get_session()
        
        payload = {
            "prompt": request.prompt,
            "model": request.model.value,
            "aspect_ratio": request.aspect_ratio.value,
            "enableTranslation": request.enable_translation,
        }
        
        if request.image_urls:
            payload["imageUrls"] = request.image_urls
        if request.generation_type:
            payload["generationType"] = request.generation_type.value
        if request.seeds:
            payload["seeds"] = request.seeds
        if request.callback_url:
            payload["callBackUrl"] = request.callback_url
        if request.watermark:
            payload["watermark"] = request.watermark

        logger.info(f"Generating video with prompt: {request.prompt[:50]}...")

        async with session.post(
            f"{self.base_url}/api/v1/veo/generate",
            json=payload,
        ) as response:
            data = await response.json()
            
            if response.status == 200 and data.get("code") == 200:
                task_id = data["data"]["taskId"]
                logger.success(f"Task created: {task_id}")
                return task_id
            else:
                error_msg = data.get("msg", "Unknown error")
                logger.error(f"Generation failed: {error_msg}")
                raise ValueError(f"Generation failed: {error_msg}")

    async def get_status(self, task_id: str) -> VeoTaskStatus:
        """
        Check task status.
        Returns VeoTaskStatus with current state.
        """
        session = await self._get_session()

        async with session.get(
            f"{self.base_url}/api/v1/veo/record-info",
            params={"taskId": task_id},
        ) as response:
            data = await response.json()
            
            if response.status == 200 and data.get("code") == 200:
                task_data = data["data"]
                result_urls = None
                
                if task_data.get("resultUrls"):
                    import json
                    try:
                        result_urls = json.loads(task_data["resultUrls"])
                    except (json.JSONDecodeError, TypeError):
                        result_urls = None
                
                return VeoTaskStatus(
                    task_id=task_id,
                    success_flag=task_data.get("successFlag", 0),
                    result_urls=result_urls,
                    error_message=data.get("msg") if task_data.get("successFlag", 0) > 1 else None,
                )
            else:
                raise ValueError(f"Status check failed: {data.get('msg', 'Unknown error')}")

    async def get_1080p(self, task_id: str) -> Optional[str]:
        """
        Get 1080p HD video URL.
        Returns URL or None if not ready.
        """
        session = await self._get_session()

        async with session.get(
            f"{self.base_url}/api/v1/veo/get-1080p-video",
            params={"taskId": task_id},
        ) as response:
            data = await response.json()
            
            if response.status == 200 and data.get("code") == 200:
                return data.get("data", {}).get("url")
            else:
                logger.warning(f"1080p not available: {data.get('msg')}")
                return None


# Singleton client
_veo_client: Optional[VeoClient] = None


def get_veo_client() -> VeoClient:
    global _veo_client
    if _veo_client is None:
        _veo_client = VeoClient()
    return _veo_client
