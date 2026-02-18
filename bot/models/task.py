from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class GenerationTask(BaseModel):
    """Video generation task for MongoDB"""
    task_id: str  # From Veo API
    user_id: int  # Telegram user ID
    model: str  # veo3, hailuo, kling
    prompt: str
    image_urls: Optional[list[str]] = None
    status: TaskStatus = TaskStatus.PENDING
    result_url: Optional[str] = None
    sound: bool = False
    error_message: Optional[str] = None
    credits_charged: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    def to_mongo(self) -> dict:
        data = self.model_dump()
        data["_id"] = data.pop("task_id")
        return data

    @classmethod
    def from_mongo(cls, data: dict) -> "GenerationTask":
        if data and "_id" in data:
            data["task_id"] = data.pop("_id")
        return cls(**data)
