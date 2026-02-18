from aiogram import Router, F
from aiogram.filters import CommandStart, CommandObject
from aiogram.types import (
    Message,
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
)
from datetime import datetime
from loguru import logger

from config import get_settings
from database import Database, UserRepository

router = Router(name="start")


@router.message(CommandStart(deep_link=True))
async def cmd_start_deeplink(message: Message, command: CommandObject) -> None:
    """Handle /start with deep-link payload (referral tag)"""
    tag = command.args.strip().lower() if command.args else None
    await _handle_start(message, tag=tag)


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    """Handle /start command without payload (organic)"""
    await _handle_start(message, tag=None)


async def _handle_start(message: Message, tag: str | None) -> None:
    """Core /start logic: register user, track referral event, show welcome."""
    user = message.from_user
    settings = get_settings()

    # Register or update user in database
    db_user, is_new = await UserRepository.get_or_create(
        user_id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        language_code=user.language_code,
        is_premium=user.is_premium or False,
    )

    # ── Referral attribution ──
    referrer_user_id = None
    if tag:
        # Find the owner of this tag
        tag_owner = await Database.users.find_one(
            {"ref_tags.name": tag},
            {"_id": 1},
        )
        if tag_owner:
            referrer_user_id = tag_owner["_id"]

            # For new users: permanently attribute them to this referrer/tag
            if is_new and referrer_user_id != user.id:
                await Database.users.update_one(
                    {"_id": user.id},
                    {"$set": {
                        "referred_by_user_id": referrer_user_id,
                        "referred_by_tag": tag,
                    }},
                )
                logger.info(
                    f"[Referral] New user {user.id} attributed to "
                    f"referrer {referrer_user_id} via tag '{tag}'"
                )

    # ── Record ref_event ──
    # Referral click: new user via valid tag (not self-referral)
    if is_new and referrer_user_id and referrer_user_id != user.id:
        now = datetime.utcnow()
        await Database._db["ref_events"].update_one(
            {
                "type": "click",
                "triggered_user_id": user.id,
                "tag": tag,
            },
            {
                "$setOnInsert": {
                    "type": "click",
                    "referrer_user_id": referrer_user_id,
                    "tag": tag,
                    "triggered_user_id": user.id,
                    "is_new_user": True,
                    "created_at": now,
                    "date": now.strftime("%Y-%m-%d"),
                },
            },
            upsert=True,
        )
        logger.info(f"[Referral] Click: user={user.id}, tag='{tag}'")

    # ── Welcome message ──
    welcome_text = (
        "🎬 <b>Добро пожаловать в AI Effects Bot!</b>\n\n"
        "С помощью нейросетей вы можете:\n"
        "✨ Оживлять фотографии\n"
        "🎯 Управлять движением (Motion Control)\n\n"
        "Вы можете выбрать из библиотеки готовые эффекты (пресеты) "
        "или создать свои уникальные видео с помощью промптов.\n\n"
        f"🆔 ID: <code>{user.id}</code>\n"
        f"💎 Баланс: {db_user.balance.credits}\n\n"
        "Жмите кнопку ниже ⬇️"
    )

    # Inline keyboard
    inline_keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎬 Сделать видео",
                    web_app=WebAppInfo(url=settings.webapp_url)
                )
            ],
            [
                InlineKeyboardButton(text="❓ Помощь", callback_data="help"),
            ],
        ]
    )

    await message.answer(
        text=welcome_text,
        reply_markup=inline_keyboard,
        parse_mode="HTML"
    )


@router.callback_query(F.data == "help")
async def callback_help(callback: CallbackQuery) -> None:
    """Handle Help button press"""
    help_text = (
        "<b>Как работает AI Effects Bot</b>\n\n"
        "1) Нажми «🎬 Сделать видео».\n"
        "2) Выбери модель (Kling, Hailuo, Veo или Motion Control).\n"
        "3) Загрузи изображение (или видео для Motion Control).\n"
        "4) Выбери эффект из библиотеки или напиши промпт.\n"
        "5) Нажми «Сгенерировать» — бот создаст видео и пришлёт готовый результат.\n\n"
        "📞 <b>Контакты</b>\n"
        "Вопросы по боту: @dimonk95k"
    )

    await callback.message.answer(text=help_text, parse_mode="HTML")
    await callback.answer()

