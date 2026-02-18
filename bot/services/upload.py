"""Upload service for kie.ai file upload API (File Stream)"""
import base64
import time

import aiohttp
from loguru import logger


# Map MIME type prefixes to file extensions
MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",
    "video/webm": "webm",
    "video/avi": "avi",
    "video/x-msvideo": "avi",
}


class UploadClient:
    """Client for uploading files to kie.ai via File Stream"""

    FILE_UPLOAD_BASE = "https://kieai.redpandaai.co"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def upload_file(
        self,
        base64_data: str,
        user_id: int,
        upload_path: str = "telegram-bot",
    ) -> str | None:
        """
        Upload a file to kie.ai using File Stream API.

        Accepts base64 data (with or without data URL prefix),
        decodes to bytes, and uploads via multipart/form-data.

        Args:
            base64_data: Base64 string (with or without data URL prefix)
            user_id: Telegram user ID for unique filename
            upload_path: Path on kie.ai storage

        Returns:
            URL of uploaded file or None if failed
        """
        # Parse MIME type and raw base64
        mime_type = "image/jpeg"  # default
        raw_b64 = base64_data

        if base64_data.startswith("data:"):
            # Format: data:image/png;base64,iVBOR...
            header, raw_b64 = base64_data.split(",", 1)
            # Extract MIME: "data:image/png;base64" -> "image/png"
            mime_type = header.split(":")[1].split(";")[0]

        # Determine file extension
        ext = MIME_TO_EXT.get(mime_type, "bin")

        # Generate unique filename
        filename = f"user_{user_id}_{int(time.time())}.{ext}"

        # Decode base64 to bytes
        try:
            file_bytes = base64.b64decode(raw_b64)
        except Exception as e:
            logger.error(f"Failed to decode base64: {e}")
            return None

        logger.info(
            f"Uploading {filename} ({len(file_bytes)} bytes, {mime_type}) "
            f"via File Stream for user {user_id}"
        )

        try:
            async with aiohttp.ClientSession() as session:
                # Build multipart form data
                form = aiohttp.FormData()
                form.add_field(
                    "file",
                    file_bytes,
                    filename=filename,
                    content_type=mime_type,
                )
                form.add_field("uploadPath", upload_path)
                form.add_field("fileName", filename)

                async with session.post(
                    f"{self.FILE_UPLOAD_BASE}/api/file-stream-upload",
                    data=form,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                ) as response:
                    data = await response.json()
                    logger.debug(f"Upload response: {data}")

                    if response.status == 200 and data.get("success"):
                        url = data.get("data", {}).get("downloadUrl")
                        logger.info(f"File uploaded: {url}")
                        return url
                    else:
                        logger.error(
                            f"Upload failed: {data.get('msg')} - "
                            f"Full response: {data}"
                        )
                        return None

        except Exception as e:
            logger.error(f"Upload error: {e}")
            return None
