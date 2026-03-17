from fastapi import Header, HTTPException

from app.config import settings


async def verify_internal_api_key(x_api_key: str = Header(...)):
    """Verify that the request comes from the Next.js BFF with valid API key."""
    if x_api_key != settings.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
