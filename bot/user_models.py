from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserBalance(BaseModel):
    """User balance information"""
    credits: int = 0
    expiration_date: Optional[datetime] = None
    expiry_warned: bool = False


class RefTag(BaseModel):
    """A referral tag created by a user"""
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class User(BaseModel):
    """User model for MongoDB"""
    user_id: int
    username: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    language_code: Optional[str] = None
    is_premium: bool = False
    balance: UserBalance = Field(default_factory=UserBalance)
    selected_model: str = "hailuo"  # hailuo | kling | veo
    ref_tags: list[RefTag] = []  # Referral tags this user created
    referred_by_user_id: Optional[int] = None  # Who referred this user
    referred_by_tag: Optional[str] = None  # Which tag was used
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def to_mongo(self) -> dict:
        """Convert to MongoDB document"""
        data = self.model_dump()
        data["_id"] = data.pop("user_id")
        return data

    @classmethod
    def from_mongo(cls, data: dict) -> "User":
        """Create from MongoDB document"""
        if data and "_id" in data:
            data["user_id"] = data.pop("_id")
        # Strip out legacy fields that no longer exist in the model
        known_fields = cls.model_fields.keys()
        data = {k: v for k, v in data.items() if k in known_fields}
        return cls(**data)
