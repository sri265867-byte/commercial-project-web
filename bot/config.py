from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    bot_token: str
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db_name: str = "video_generator"
    webapp_url: str = "https://example.com"
    api_public_url: str = "http://localhost:8000"  # For callbacks (Amvera URL)
    
    @property
    def callback_base_url(self) -> str:
        """API URL without trailing slash for callback construction"""
        return self.api_public_url.rstrip("/")
    
    # Kie.ai API (used for Veo, Hailuo, etc.)
    kie_api_key: str = ""
    kie_api_base: str = "https://api.kie.ai"
    
    # YooKassa Payment
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""
    
    # API Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # Admin IDs for log notifications
    admin_ids: list[int] = [190796855, 1322880441]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
