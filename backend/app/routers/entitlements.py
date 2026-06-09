"""Entitlement(이용 권한) 라우터 — /entitlements/*

atmbook(전자책) 프론트/서버리스가 콘텐츠 게이팅·구매 복구를 위해 호출한다.
모든 엔드포인트는 moa365 통합 계정 JWT(Bearer)로 인증된 사용자 기준.

- GET  /entitlements/check?sku=...   해당 sku 권한 보유 여부 (콘텐츠 게이팅)
- GET  /entitlements/me              내 전체 권한 목록 (마이페이지/복구 화면)
- POST /entitlements/redeem-license  기존 atmbook 라이선스 키를 현재 계정에 귀속
"""
from __future__ import annotations

import hashlib
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_user
from ..models.user import User
from ..services import entitlement_service

router = APIRouter(prefix="/entitlements", tags=["entitlements"])


class CheckOut(BaseModel):
    sku: str
    granted: bool


class EntitlementOut(BaseModel):
    sku: str
    product: str
    status: str
    source: str
    expires_at: datetime | None = None


class RedeemIn(BaseModel):
    license_key: str = Field(min_length=4, max_length=128)
    # 어느 전자책 SKU 로 귀속할지. 미지정 시 기본 상품.
    # 패턴상 'atmbook:book-XXX' 만 허용 — 'atmbook:all'(전체 열람권) 클라이언트 지정 차단.
    sku: str | None = Field(default=None, max_length=64, pattern=r"^atmbook:book-[a-z0-9-]+$")


class RedeemOut(BaseModel):
    granted: bool
    sku: str


@router.get("/check", response_model=CheckOut)
async def check(
    sku: str = Query(..., min_length=3, max_length=64),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """sku 권한 보유 여부. atmbook content.js 가 챕터 잠금해제 판정에 사용."""
    granted = await entitlement_service.has_entitlement(db, user.id, sku)
    return CheckOut(sku=sku, granted=granted)


@router.get("/me", response_model=list[EntitlementOut])
async def my_entitlements(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await entitlement_service.list_for_user(db, user.id)
    return [
        EntitlementOut(
            sku=e.sku,
            product=e.product,
            status=e.status,
            source=e.source,
            expires_at=e.expires_at,
        )
        for e in rows
    ]


@router.post("/redeem-license", response_model=RedeemOut)
async def redeem_license(
    body: RedeemIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """기존 atmbook 라이선스 키(계정 없이 구매)를 현재 로그인 계정에 귀속.

    LS 공개 라이선스 검증 API 로 키 유효성 확인 후 전자책 권한을 영구 부여.
    교차 지급(moa365 무료)은 운영 정책상 소급 적용하지 않는다(신규 결제 webhook 에서만).
    """
    settings = get_settings()

    # SKU 결정 — 설정된 전자책 카탈로그(ls_variant_sku) 안에서만 허용.
    # 클라이언트가 임의 sku 를 보내 권한을 부풀리지 못하게 한다(atmbook:all 은 패턴에서 이미 차단).
    allowed = set(settings.ls_variant_sku.values())
    if body.sku:
        if allowed and body.sku not in allowed:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="지원하지 않는 전자책입니다.")
        sku = body.sku
    elif len(allowed) == 1:
        sku = next(iter(allowed))
    else:
        sku = "atmbook:book-001"

    try:
        async with httpx.AsyncClient(timeout=10) as cx:
            resp = await cx.post(
                "https://api.lemonsqueezy.com/v1/licenses/validate",
                json={"license_key": body.license_key},
                headers={"Accept": "application/json"},
            )
        data = resp.json() if resp.status_code == 200 else {}
    except Exception as e:
        logger.warning(f"LS 라이선스 검증 호출 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="라이선스 확인 서비스에 일시적으로 접속할 수 없습니다.",
        )

    if not data.get("valid"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 라이선스 키입니다.")

    # 멱등·단일귀속 키: 전체 키의 SHA-256 (원본 키는 저장 안 함).
    # LS /validate 는 키를 소모하지 않으므로 같은 키가 여러 계정에 재사용될 수 있다 →
    # source_ref 전역 유일성으로 '한 키 = 한 계정' 강제(라이선스 공유 차단).
    source_ref = f"license:{hashlib.sha256(body.license_key.encode('utf-8')).hexdigest()}"
    holder = await entitlement_service.license_holder(db, source_ref)
    if holder is not None and holder != user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 다른 계정에 등록된 라이선스입니다.",
        )

    await entitlement_service.grant(
        db,
        user_id=user.id,
        product="atmbook",
        sku=sku,
        source="purchase",
        source_ref=source_ref,
        expires_at=None,  # 전자책은 영구
    )
    await db.commit()
    logger.info(f"라이선스 귀속 user_id={user.id} sku={sku}")
    return RedeemOut(granted=True, sku=sku)
