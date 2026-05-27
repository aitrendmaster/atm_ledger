"""소셜 로그인 (Google OAuth 2.0) 라우터.

흐름: 프론트가 Google Identity Services 로 받은 id_token 을 백엔드로 POST →
백엔드는 google-auth 로 검증(서명·만료·aud) → User upsert → JWT 발급.

기존 password 가입자와 같은 email 이 들어오면 같은 user 행에 provider_sub 를 채워
머지한다 (password 로그인은 그대로 가능).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..deps import is_admin
from ..models.user import User
from ..schemas.auth import TokenPair, UserOut
from ..security import create_access_token, create_refresh_token

router = APIRouter(prefix="/auth/google", tags=["auth"])


class GoogleLoginIn(BaseModel):
    id_token: str = Field(min_length=10, max_length=4096)


class GoogleLoginOut(TokenPair):
    user: UserOut


def _verify_id_token(id_token_str: str, allowed_client_ids: list[str]) -> dict:
    """Google id_token 검증. 허용 client_id 중 하나에 audience 매칭되면 통과.

    웹 클라이언트는 단일 audience(`google_client_id`), Capacitor Android 앱은
    google-services.json 의 client_id (Firebase 자동 생성) audience 를 사용해
    audience 가 환경에 따라 다르다. 따라서 허용 목록을 순회하며 시도.
    """
    # 라이브러리 미설치 환경에서도 import 가 무사히 부팅되도록 지연 import.
    from google.auth.transport import requests as g_requests  # type: ignore
    from google.oauth2 import id_token as gid_token  # type: ignore

    request = g_requests.Request()
    last_err: Exception | None = None
    for cid in allowed_client_ids:
        if not cid:
            continue
        try:
            return gid_token.verify_oauth2_token(id_token_str, request, cid)
        except ValueError as e:
            last_err = e
            continue
    raise last_err or ValueError("허용된 Google client_id 가 없습니다.")


def _user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        email=u.email,
        display_name=u.display_name,
        monthly_income=u.monthly_income,
        monthly_budget=u.monthly_budget,
        country_code=u.country_code or "KR",
        currency_code=u.currency_code or "KRW",
        locale=u.locale or "ko",
        is_admin=is_admin(u),
    )


@router.post("", response_model=GoogleLoginOut)
async def google_login(body: GoogleLoginIn, db: AsyncSession = Depends(get_db)):
    """Google id_token 으로 로그인 또는 가입(upsert)."""
    settings = get_settings()
    if not settings.google_client_id:
        # Cloud Console 발급 전엔 503 으로 종료. 프론트는 버튼을 hidden 처리.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google 로그인이 활성화되어 있지 않습니다.",
        )

    try:
        claims = _verify_id_token(body.id_token, settings.google_client_ids_all)
    except Exception as e:
        logger.warning(f"Google id_token 검증 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 Google 토큰"
        )

    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰 발급자")
    if not claims.get("email_verified", False):
        raise HTTPException(status_code=401, detail="Google 이메일이 검증되지 않았습니다.")

    sub = claims.get("sub")
    email = (claims.get("email") or "").lower()
    name = claims.get("name") or claims.get("given_name")
    if not sub or not email:
        raise HTTPException(status_code=400, detail="Google 응답에 필수 정보가 없습니다.")

    # 1) provider_sub 로 찾기
    res = await db.execute(
        select(User).where(User.provider_sub == sub, User.auth_provider == "google")
    )
    user = res.scalar_one_or_none()

    # 2) 없으면 email 로 머지 시도 (기존 password 가입자도 같은 사람이 맞다고 간주)
    if not user:
        res = await db.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()
        if user:
            user.provider_sub = sub
            # auth_provider 는 처음 가입 경로를 유지. password 사용자가 Google 도 연동하는 경우.
            if not user.password_hash and not user.auth_provider:
                user.auth_provider = "google"
            if not user.display_name and name:
                user.display_name = name

    # 3) 둘 다 없으면 신규 가입
    if not user:
        user = User(
            email=email,
            password_hash=None,
            display_name=name,
            auth_provider="google",
            provider_sub=sub,
            # Google 이 이미 email_verified=true 를 보장 (위 line 94 에서 검증). 추가 메일 인증 불필요.
            email_verified=True,
        )
        db.add(user)
    elif not user.email_verified:
        # 기존 password 계정이 Google 로 연동되는 경우 — Google 이 메일 소유권을 보증하므로 verified=true 승격.
        user.email_verified = True
        user.email_verification_token = None
        user.email_verification_expires_at = None

    if user.deleted_at is not None:
        raise HTTPException(status_code=403, detail="비활성화된 계정입니다.")

    await db.commit()
    await db.refresh(user)

    return GoogleLoginOut(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        user=_user_out(user),
    )
