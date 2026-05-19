import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..constants.countries import (
    country_defaults,
    normalize_country,
    normalize_currency,
    normalize_locale,
)
from ..database import get_db
from ..deps import get_current_user, is_admin
from ..models.password_reset_token import PasswordResetToken
from ..models.user import User
from ..schemas.auth import (
    BootstrapResetIn,
    ChangePasswordRequest,
    LoginRequest,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    RefreshRequest,
    SignupRequest,
    SimpleResult,
    TokenPair,
    UpdateProfileRequest,
    UserOut,
)
from ..services.email_service import send_password_reset_email


def _user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        display_name=u.display_name,
        monthly_income=u.monthly_income,
        monthly_budget=u.monthly_budget,
        country_code=u.country_code or "KR",
        currency_code=u.currency_code or "KRW",
        locale=u.locale or "ko",
        is_admin=is_admin(u),
        subscription_tier=u.subscription_tier or "free",
        subscription_expires_at=u.subscription_expires_at,
        allow_location_metadata=bool(u.allow_location_metadata),
        last_geo_city=u.last_geo_city,
        last_geo_region=u.last_geo_region,
        last_geo_country=u.last_geo_country,
    )
from ..security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(user_id: int) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(str(user_id)),
        refresh_token=create_refresh_token(str(user_id)),
    )


@router.post("/signup", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    try:
        res = await db.execute(select(User).where(User.email == body.email.lower()))
        if res.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="이미 가입된 이메일입니다.")
        # 지역화 기본값: country 만 지정되면 currency/locale 자동 도출. 셋 다 미지정이면 KR/KRW/ko.
        defaults = country_defaults(body.country_code)
        country = normalize_country(body.country_code or defaults["country_code"])
        currency = normalize_currency(body.currency_code or defaults["currency_code"])
        locale = normalize_locale(body.locale or defaults["locale"])
        user = User(
            email=body.email.lower(),
            password_hash=hash_password(body.password),
            display_name=body.display_name,
            auth_provider="password",
            country_code=country,
            currency_code=currency,
            locale=locale,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return _issue_tokens(user.id)
    except HTTPException:
        raise
    except Exception:
        logger.exception(f"signup failed for email={body.email!r}")
        raise HTTPException(
            status_code=500,
            detail="회원가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        )


@router.post("/login", response_model=TokenPair)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.email == body.email.lower()))
    user = res.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    return _issue_tokens(user.id)


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest):
    try:
        payload = decode_token(body.refresh_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="wrong token type")
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="no sub")
    return _issue_tokens(int(sub))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return _user_out(user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.monthly_income is not None:
        user.monthly_income = body.monthly_income
    if body.monthly_budget is not None:
        user.monthly_budget = body.monthly_budget
    if body.allow_location_metadata is not None:
        user.allow_location_metadata = body.allow_location_metadata
    if body.country_code is not None:
        user.country_code = normalize_country(body.country_code)
    if body.currency_code is not None:
        user.currency_code = normalize_currency(body.currency_code)
    if body.locale is not None:
        user.locale = normalize_locale(body.locale)
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.post("/change-password", response_model=SimpleResult)
async def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """로그인된 사용자의 비밀번호 변경. password 가입자만 가능 (OAuth-only 사용자는 거부)."""
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="소셜 로그인 계정은 비밀번호 변경이 불필요합니다.",
        )
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="현재 비밀번호가 일치하지 않습니다.",
        )
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="새 비밀번호가 기존 비밀번호와 같습니다.",
        )
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return SimpleResult(ok=True, message="비밀번호가 변경되었습니다.")


@router.get("/me/export")
async def export_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GDPR Article 20 — 본인 데이터 JSON 다운로드."""
    import json

    from fastapi.responses import StreamingResponse

    from ..services.user_export import build_user_export

    bundle = await build_user_export(db, user)
    body = json.dumps(bundle, ensure_ascii=False, indent=2)
    filename = f"moa-ai-mydata-{user.id}-{datetime.utcnow().strftime('%Y%m%d-%H%M')}.json"
    return StreamingResponse(
        iter([body]),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/me", response_model=SimpleResult)
async def delete_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """본인 계정 비활성화 (soft delete). 데이터는 보존되지만 즉시 로그인 차단."""
    # 자기 자신이 마지막 admin 이면 못 빠짐.
    if user.is_admin:
        from sqlalchemy import func
        active_admins = (
            await db.execute(
                select(func.count(User.id)).where(
                    User.is_admin.is_(True), User.deleted_at.is_(None)
                )
            )
        ).scalar_one()
        if active_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="마지막 admin 입니다. 다른 사용자에게 권한을 부여한 뒤 탈퇴하세요.",
            )
    user.deleted_at = datetime.now(timezone.utc)
    user.is_admin = False
    await db.commit()
    return SimpleResult(ok=True, message="탈퇴 처리되었습니다.")


# ---------- 비밀번호 찾기 ----------


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@router.post("/password-reset/request", response_model=SimpleResult)
async def password_reset_request(
    body: PasswordResetRequestIn,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """비번 재설정 메일 요청. 보안상 이메일 존재 여부와 무관하게 항상 동일한 200 응답을 돌려준다.

    실제 이메일 발송과 토큰 생성은 백그라운드 태스크로 분리(타이밍 사이드채널 방어).
    """
    settings = get_settings()

    async def _enqueue():
        try:
            res = await db.execute(
                select(User).where(User.email == body.email.lower())
            )
            user = res.scalar_one_or_none()
            if not user or user.deleted_at is not None or not user.password_hash:
                # 소셜-only 또는 미존재 / 탈퇴 — 발송 안 함
                return
            raw_token = secrets.token_urlsafe(48)
            db.add(
                PasswordResetToken(
                    user_id=user.id,
                    token_hash=_hash_token(raw_token),
                    expires_at=datetime.now(timezone.utc)
                    + timedelta(minutes=settings.password_reset_ttl_min),
                )
            )
            await db.commit()
            reset_link = f"{settings.frontend_base_url.rstrip('/')}/reset-password?token={raw_token}"
            send_password_reset_email(user.email, reset_link, user.display_name)
        except Exception:
            logger.exception("password_reset_request 처리 중 오류")

    background.add_task(_enqueue)
    return SimpleResult(
        ok=True,
        message="해당 이메일이 등록되어 있다면 비밀번호 재설정 안내를 발송했어요.",
    )


@router.post("/password-reset/confirm", response_model=SimpleResult)
async def password_reset_confirm(
    body: PasswordResetConfirmIn,
    db: AsyncSession = Depends(get_db),
):
    """토큰 검증 + 비밀번호 교체. 성공 시 해당 사용자의 모든 미사용 토큰 무효화."""
    th = _hash_token(body.token)
    res = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == th)
    )
    tok = res.scalar_one_or_none()
    if not tok:
        raise HTTPException(status_code=400, detail="유효하지 않은 링크입니다.")
    if tok.used_at is not None:
        raise HTTPException(status_code=400, detail="이미 사용된 링크입니다.")
    if tok.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="만료된 링크입니다. 다시 요청해 주세요.")

    user_res = await db.execute(select(User).where(User.id == tok.user_id))
    user = user_res.scalar_one_or_none()
    if not user or user.deleted_at is not None:
        raise HTTPException(status_code=400, detail="사용자를 찾을 수 없습니다.")

    user.password_hash = hash_password(body.new_password)
    user.auth_provider = "password"
    tok.used_at = datetime.now(timezone.utc)

    # 해당 사용자의 미사용 토큰 모두 사용 처리
    other = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
    )
    for t in other.scalars().all():
        t.used_at = datetime.now(timezone.utc)

    await db.commit()
    return SimpleResult(ok=True, message="비밀번호가 변경되었습니다. 다시 로그인해 주세요.")


# ---------- 잠금 복구 (Admin Bootstrap Reset) ----------
# 일회성 운영 endpoint. ENV `ADMIN_BOOTSTRAP_TOKEN` 이 있을 때만 동작.
# 사용 직후 ENV 제거 + 후속 PR 로 이 핸들러 코드 삭제 권장.


@router.post("/admin-bootstrap-reset", response_model=SimpleResult)
async def admin_bootstrap_reset(
    body: BootstrapResetIn,
    db: AsyncSession = Depends(get_db),
):
    expected = (os.getenv("ADMIN_BOOTSTRAP_TOKEN") or "").strip()
    if not expected:
        raise HTTPException(status_code=403, detail="disabled")
    if not secrets.compare_digest(body.token, expected):
        raise HTTPException(status_code=401, detail="invalid token")
    res = await db.execute(select(User).where(User.email == body.email.lower()))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    user.password_hash = hash_password(body.new_password)
    user.auth_provider = "password"
    user.deleted_at = None
    await db.commit()
    logger.warning(f"admin-bootstrap-reset used: email={body.email} user_id={user.id}")
    return SimpleResult(ok=True, message="비밀번호가 재설정되었습니다.")
