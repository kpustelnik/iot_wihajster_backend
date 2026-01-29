"""
Router do logowania przez Discord OAuth2.
Umożliwia rejestrację i logowanie przez Discord.
"""
import logging
import secrets
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse, JSONResponse, HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app_common.config import settings
from app_common.database import get_db
from app_common.models.user import User, UserType
from frontend_api.docs import Tags
from frontend_api.utils.auth.auth import make_token
from frontend_api.utils.cookies import add_auth_cookie

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth/discord",
    tags=[Tags.Users],
    responses={}
)

# Discord OAuth2 endpoints
DISCORD_API_BASE = "https://discord.com/api/v10"
DISCORD_AUTHORIZE_URL = "https://discord.com/api/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"

# Scopes needed for login
DISCORD_SCOPES = ["identify", "email"]


async def _exchange_code_for_user(code: str) -> dict:
    """
    Wymień kod autoryzacji na dane użytkownika Discord.
    """
    async with httpx.AsyncClient() as client:
        # Exchange code for access token
        token_response = await client.post(
            DISCORD_TOKEN_URL,
            data={
                "client_id": settings.discord_client_id,
                "client_secret": settings.discord_client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.discord_redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        if token_response.status_code != 200:
            logger.error(f"Discord token exchange failed: {token_response.text}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to authenticate with Discord"
            )

        token_data = token_response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No access token received from Discord"
            )

        # Get user info from Discord
        user_response = await client.get(
            f"{DISCORD_API_BASE}/users/@me",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if user_response.status_code != 200:
            logger.error(f"Discord user info failed: {user_response.text}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to get user info from Discord"
            )

        return user_response.json()


@router.get(
    "/login",
    status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    summary="Login/Register with Discord",
)
async def discord_login(
    redirect_after: Optional[str] = Query(default=None, description="URL to redirect after successful login")
):
    """
    Przekieruj użytkownika do Discord w celu logowania lub rejestracji.
    
    Jeśli użytkownik nie ma konta - zostanie utworzone automatycznie.
    Jeśli ma - zostanie zalogowany.
    """
    if not settings.discord_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Discord OAuth2 is not configured"
        )

    state = secrets.token_urlsafe(32)
    if redirect_after:
        state = f"{state}:{redirect_after}"

    params = {
        "client_id": settings.discord_client_id,
        "redirect_uri": settings.discord_redirect_uri,
        "response_type": "code",
        "scope": " ".join(DISCORD_SCOPES),
        "state": state,
    }

    authorization_url = f"{DISCORD_AUTHORIZE_URL}?{urlencode(params)}"
    return RedirectResponse(url=authorization_url)


@router.get(
    "/callback",
    status_code=status.HTTP_200_OK,
    summary="Discord OAuth2 callback",
)
async def discord_callback(
    code: str = Query(..., description="Authorization code from Discord"),
    state: Optional[str] = Query(default=None, description="State for CSRF protection"),
    db: AsyncSession = Depends(get_db)
):
    """
    Callback endpoint dla Discord OAuth2.
    
    - Jeśli użytkownik z danym discord_id istnieje → logowanie
    - Jeśli nie istnieje → rejestracja nowego konta
    """
    if not settings.discord_client_id or not settings.discord_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Discord OAuth2 is not configured"
        )

    # Extract redirect URL from state if present
    redirect_after = None
    if state and ":" in state:
        _, redirect_after = state.split(":", 1)

    # Get Discord user data
    discord_user = await _exchange_code_for_user(code)

    discord_id = discord_user.get("id")
    discord_username = discord_user.get("username")
    discord_email = discord_user.get("email")
    discord_avatar = discord_user.get("avatar")

    if not discord_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discord did not provide user ID"
        )

    # Check if user exists by discord_id
    result = await db.execute(
        select(User).where(User.discord_id == discord_id)
    )
    user = result.scalar_one_or_none()
    is_new_user = False

    if user is None:
        # Create new user - registration via Discord
        is_new_user = True
        
        # Generate unique login from Discord username
        base_login = discord_username or f"discord_{discord_id}"
        login = base_login
        counter = 1

        while True:
            existing = await db.execute(
                select(User).where(User.login == login)
            )
            if existing.scalar_one_or_none() is None:
                break
            login = f"{base_login}_{counter}"
            counter += 1

        # Check email uniqueness
        email = discord_email or f"{discord_id}@discord.user"
        existing_email = await db.execute(
            select(User).where(User.email == email)
        )
        if existing_email.scalar_one_or_none():
            email = f"{discord_id}@discord.user"

        user = User(
            email=email,
            login=login,
            password=secrets.token_urlsafe(32),  # Random password, user logs in via Discord
            type=UserType.CLIENT,
            discord_id=discord_id,
            discord_username=discord_username,
            discord_avatar=discord_avatar,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info(f"New user registered via Discord: {user.id} ({discord_username})")
    else:
        # Update Discord info on login
        user.discord_username = discord_username
        user.discord_avatar = discord_avatar
        await db.commit()
        await db.refresh(user)
        logger.info(f"User logged in via Discord: {user.id} ({discord_username})")

    # Generate JWT token
    token = make_token(user.id)

    # Build response
    if redirect_after:
        # Return HTML page that redirects via JavaScript
        # This avoids Service Worker issues with cross-origin redirects
        # Parse the redirect URL to add token params
        separator = '&' if '?' in redirect_after else '?'
        final_url = f"{redirect_after}{separator}discord_token={token}&discord_user_id={user.id}"
        
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Logowanie...</title>
</head>
<body>
    <p>Przekierowanie...</p>
    <script>
        window.location.replace("{final_url}");
    </script>
</body>
</html>"""
        response = HTMLResponse(content=html_content)
    else:
        response = JSONResponse({
            "token": token,
            "user_id": user.id,
            "login": user.login,
            "discord_username": user.discord_username,
            "is_new_user": is_new_user,
            "message": "Konto utworzone przez Discord" if is_new_user else "Zalogowano przez Discord"
        })

    response = add_auth_cookie(response, token)
    return response
