from pymongo import AsyncMongoClient
from typing import Optional
from datetime import datetime

from config import get_settings
from user_models import User


class Database:
    """MongoDB database wrapper using pymongo AsyncMongoClient"""
    
    _client: Optional[AsyncMongoClient] = None
    _db = None

    @classmethod
    async def connect(cls) -> None:
        """Initialize database connection"""
        settings = get_settings()
        cls._client = AsyncMongoClient(settings.mongo_uri)
        cls._db = cls._client[settings.mongo_db_name]

    @classmethod
    async def disconnect(cls) -> None:
        """Close database connection"""
        if cls._client:
            await cls._client.close()

    @classmethod
    @property
    def users(cls):
        """Users collection"""
        return cls._db["users"]

    @classmethod
    @property
    def users_queue(cls):
        """Task queue collection"""
        return cls._db["users_queue"]

    @classmethod
    @property
    def db(cls):
        """Direct database access"""
        return cls._db

    @classmethod
    @property
    def payments(cls):
        """Payments collection"""
        return cls._db["payments"]


class UserRepository:
    """Repository for user operations"""

    @staticmethod
    async def get_by_id(user_id: int) -> Optional[User]:
        """Get user by Telegram ID"""
        doc = await Database.users.find_one({"_id": user_id})
        return User.from_mongo(doc) if doc else None

    @staticmethod
    async def create(user: User) -> User:
        """Create new user"""
        await Database.users.insert_one(user.to_mongo())
        return user

    @staticmethod
    async def update(user: User) -> User:
        """Update existing user"""
        user.updated_at = datetime.utcnow()
        await Database.users.replace_one(
            {"_id": user.user_id},
            user.to_mongo()
        )
        return user

    @staticmethod
    async def get_or_create(
        user_id: int,
        username: Optional[str],
        first_name: str,
        last_name: Optional[str],
        language_code: Optional[str] = None,
        is_premium: bool = False,
    ) -> tuple[User, bool]:
        """
        Get existing user or create new one.
        Returns tuple of (user, created) where created is True if new user was created.
        """
        existing = await UserRepository.get_by_id(user_id)
        if existing:
            # Update user info if changed
            updated = False
            if existing.username != username:
                existing.username = username
                updated = True
            if existing.first_name != first_name:
                existing.first_name = first_name
                updated = True
            if existing.last_name != last_name:
                existing.last_name = last_name
                updated = True
            if existing.is_premium != is_premium:
                existing.is_premium = is_premium
                updated = True
            
            if updated:
                await UserRepository.update(existing)
            
            return existing, False

        # Create new user
        user = User(
            user_id=user_id,
            username=username,
            first_name=first_name,
            last_name=last_name,
            language_code=language_code,
            is_premium=is_premium,
        )
        await UserRepository.create(user)
        return user, True

    @staticmethod
    async def update_balance(user_id: int, credits: int) -> Optional[User]:
        """Update user credits balance"""
        user = await UserRepository.get_by_id(user_id)
        if not user:
            return None
        
        user.balance.credits = credits
        return await UserRepository.update(user)

    @staticmethod
    async def add_credits(user_id: int, amount: int) -> Optional[User]:
        """Add credits to user balance"""
        user = await UserRepository.get_by_id(user_id)
        if not user:
            return None
        
        user.balance.credits += amount
        return await UserRepository.update(user)
