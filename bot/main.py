import asyncio
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from loguru import logger

from config import get_settings
from database import Database
from handlers.start import router as start_router


async def on_startup() -> None:
    """Startup actions"""
    logger.info("Connecting to database...")
    await Database.connect()
    logger.success("Database connected!")

    # Start background credit expiry scheduler
    from services.credit_expiry import start_credit_expiry_scheduler
    await start_credit_expiry_scheduler()


async def on_shutdown() -> None:
    """Shutdown actions"""
    logger.info("Disconnecting from database...")
    await Database.disconnect()
    logger.success("Database disconnected!")


async def main() -> None:
    """Main entry point"""
    # Configure loguru
    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
        level="INFO",
    )

    settings = get_settings()

    # Initialize bot
    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )

    # Initialize dispatcher
    dp = Dispatcher()

    # Register startup/shutdown handlers
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    # Register routers
    dp.include_router(start_router)

    # Start polling
    logger.info("Starting bot...")
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
