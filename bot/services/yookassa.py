"""
YooKassa Payment API client
Docs: https://yookassa.ru/developers/api
"""

import uuid
import aiohttp
import logging
from config import get_settings

logger = logging.getLogger(__name__)

YOOKASSA_API_BASE = "https://api.yookassa.ru/v3"

# Credit plans (prices in RUB)
PLANS = {
    "starter": {
        "name": "Начинающий",
        "credits": 1000,
        "amount": "790",
        "currency": "RUB",
    },
    "creator": {
        "name": "Создатель",
        "credits": 10000,
        "amount": "4900",
        "currency": "RUB",
    },
    "pro": {
        "name": "Про",
        "credits": 105000,
        "amount": "45900",
        "currency": "RUB",
    },
}


class YooKassaClient:
    """Client for YooKassa Payment API"""

    def __init__(self):
        settings = get_settings()
        self.shop_id = settings.yookassa_shop_id
        self.secret_key = settings.yookassa_secret_key

    def _auth(self) -> aiohttp.BasicAuth:
        return aiohttp.BasicAuth(self.shop_id, self.secret_key)

    async def create_payment(
        self,
        amount: str,
        currency: str,
        description: str,
        metadata: dict | None = None,
    ) -> dict:
        """
        Create a payment with embedded confirmation (for widget).
        Returns: {id, status, confirmation.confirmation_token, ...}
        """
        idempotence_key = str(uuid.uuid4())

        payload = {
            "amount": {
                "value": amount,
                "currency": currency,
            },
            "confirmation": {
                "type": "embedded",
            },
            "capture": True,
            "description": description,
            "metadata": metadata or {},
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{YOOKASSA_API_BASE}/payments",
                json=payload,
                auth=self._auth(),
                headers={
                    "Idempotence-Key": idempotence_key,
                    "Content-Type": "application/json",
                },
            ) as resp:
                data = await resp.json()
                if resp.status != 200:
                    logger.error(f"YooKassa create_payment error: {resp.status} {data}")
                    raise Exception(f"YooKassa error: {data}")
                logger.info(f"YooKassa payment created: {data['id']}, status={data['status']}")
                return data

    async def get_payment(self, payment_id: str) -> dict:
        """Get payment info by ID"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{YOOKASSA_API_BASE}/payments/{payment_id}",
                auth=self._auth(),
            ) as resp:
                return await resp.json()


# Singleton
_client: YooKassaClient | None = None


def get_yookassa_client() -> YooKassaClient:
    global _client
    if _client is None:
        _client = YooKassaClient()
    return _client
