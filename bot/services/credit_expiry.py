"""
Credit Expiry Scheduler

Runs periodically (every 6 hours) to:
1. Warn users whose credits expire within 3 days
2. Expire (zero out) credits that have passed their expiration date
"""

import asyncio
from datetime import datetime, timedelta
from loguru import logger

from database import Database
from services.notifications import get_notifier


async def _warn_expiring_users() -> int:
    """Send Telegram warning to users whose credits expire within 3 days.
    
    Only warns users who:
    - Have credits > 0
    - Have expiration_date within 3 days from now
    - Haven't been warned yet (expiry_warned != True)
    
    Returns number of users warned.
    """
    now = datetime.utcnow()
    warn_cutoff = now + timedelta(days=3)

    cursor = Database.users.find({
        "balance.credits": {"$gt": 0},
        "balance.expiration_date": {"$ne": None, "$lte": warn_cutoff, "$gt": now},
        "balance.expiry_warned": {"$ne": True},
    })

    notifier = get_notifier()
    warned = 0

    async for user_doc in cursor:
        user_id = user_doc["_id"]
        exp_date = user_doc.get("balance", {}).get("expiration_date")
        credits = user_doc.get("balance", {}).get("credits", 0)

        if not exp_date:
            continue

        # Format expiration date in Russian
        month_names = [
            "", "января", "февраля", "марта", "апреля", "мая", "июня",
            "июля", "августа", "сентября", "октября", "ноября", "декабря",
        ]
        date_label = f"{exp_date.day} {month_names[exp_date.month]}"

        text = (
            f"⚠️ <b>Срок действия кредитов истекает!</b>\n\n"
            f"У вас осталось <b>{credits}</b> кредитов.\n"
            f"Они будут аннулированы <b>{date_label}</b>.\n\n"
            f"Используйте их или пополните баланс, чтобы продлить срок."
        )

        try:
            await notifier.send_message(user_id, text)
            await Database.users.update_one(
                {"_id": user_id},
                {"$set": {"balance.expiry_warned": True}},
            )
            warned += 1
            logger.info(f"[CreditExpiry] Warned user {user_id} — expires {date_label}")
        except Exception as e:
            logger.error(f"[CreditExpiry] Failed to warn user {user_id}: {e}")

    return warned


async def _expire_credits() -> int:
    """Zero out credits for users whose expiration_date has passed.
    
    Returns number of users whose credits were expired.
    """
    now = datetime.utcnow()

    cursor = Database.users.find({
        "balance.credits": {"$gt": 0},
        "balance.expiration_date": {"$ne": None, "$lte": now},
    })

    notifier = get_notifier()
    expired = 0

    async for user_doc in cursor:
        user_id = user_doc["_id"]
        credits = user_doc.get("balance", {}).get("credits", 0)

        # Zero out credits and clear expiration
        await Database.users.update_one(
            {"_id": user_id},
            {"$set": {
                "balance.credits": 0,
                "balance.expiration_date": None,
                "balance.expiry_warned": False,
            }},
        )

        # Notify user
        text = (
            f"❌ <b>Кредиты аннулированы</b>\n\n"
            f"Срок действия ваших <b>{credits}</b> кредитов истёк.\n"
            f"Пополните баланс, чтобы продолжить генерацию видео."
        )

        try:
            await notifier.send_message(user_id, text)
            logger.info(f"[CreditExpiry] Expired {credits} credits for user {user_id}")
        except Exception as e:
            logger.error(f"[CreditExpiry] Failed to notify user {user_id} about expiry: {e}")

        expired += 1

    return expired


async def _run_expiry_checks():
    """Run both warning and expiration passes."""
    try:
        warned = await _warn_expiring_users()
        expired = await _expire_credits()
        logger.info(f"[CreditExpiry] Check complete: warned={warned}, expired={expired}")
    except Exception as e:
        logger.error(f"[CreditExpiry] Check failed: {e}")


async def _scheduler_loop():
    """Run expiry checks every 6 hours."""
    while True:
        await _run_expiry_checks()
        await asyncio.sleep(6 * 3600)  # 6 hours


_scheduler_task = None


async def start_credit_expiry_scheduler():
    """Start the background credit expiry scheduler."""
    global _scheduler_task
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    logger.info("[CreditExpiry] Scheduler started (interval: 6h)")
