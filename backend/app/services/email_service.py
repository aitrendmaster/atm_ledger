"""이메일 발송 서비스 — Resend SDK 래퍼.

RESEND_API_KEY 가 비어 있으면 발송 대신 백엔드 로그에 reset 링크를 출력한다
(도메인 검증/Resend 계정 준비 전에도 비번 복구가 가능하도록).

Resend 도메인 검증이 끝나기 전이라도 `onboarding@resend.dev` 발신 주소를 쓰면
**Resend 가입 본인 계정의 이메일에만** 발송 테스트 가능. 도메인 검증 후엔
RESEND_FROM 을 자체 도메인으로 교체.
"""
from __future__ import annotations

from loguru import logger

from ..config import get_settings


def send_password_reset_email(to_email: str, reset_link: str, display_name: str | None = None) -> bool:
    """비밀번호 재설정 메일 발송. 발송 성공 시 True, 미설정/실패 시 False (보안상 사용자에겐 항상 동일 응답)."""
    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning(
            f"[DEV] RESEND_API_KEY 미설정 — 발송 생략. 수동 reset link 로 사용자에게 전달하세요:\n"
            f"  to:   {to_email}\n"
            f"  link: {reset_link}"
        )
        return False

    try:
        # 지연 import: SDK 가 설치 안 됐을 때도 백엔드 부팅이 깨지지 않도록.
        import resend  # type: ignore

        resend.api_key = settings.resend_api_key
        greeting = display_name or to_email.split("@", 1)[0]
        html = f"""\
<div style="font-family:system-ui,-apple-system,'Noto Sans KR',sans-serif;
            max-width:520px;margin:0 auto;padding:24px;color:#2C2418;">
  <h1 style="font-size:20px;margin:0 0 16px">Moa AI 가계부</h1>
  <p style="margin:0 0 16px">{greeting} 님, 안녕하세요.</p>
  <p style="margin:0 0 20px">
    비밀번호 재설정을 요청하셨습니다. 아래 버튼을 누르면 새 비밀번호를 설정할 수 있어요.
    링크는 {settings.password_reset_ttl_min}분간만 유효합니다.
  </p>
  <p style="margin:0 0 28px;text-align:center">
    <a href="{reset_link}"
       style="display:inline-block;padding:12px 22px;background:#A0633C;color:#fff;
              text-decoration:none;border-radius:10px;font-weight:600">
      새 비밀번호 설정하기
    </a>
  </p>
  <p style="font-size:12px;color:#7A7567;margin:0 0 8px">
    버튼이 동작하지 않으면 아래 주소를 복사해 브라우저에 붙여 넣으세요.
  </p>
  <p style="font-size:12px;color:#7A7567;word-break:break-all;margin:0 0 24px">{reset_link}</p>
  <hr style="border:none;border-top:1px solid #E8E2D5;margin:16px 0" />
  <p style="font-size:12px;color:#7A7567;margin:0">
    본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.
  </p>
</div>
"""
        resend.Emails.send(
            {
                "from": settings.resend_from,
                "to": [to_email],
                "subject": "[Moa AI 가계부] 비밀번호 재설정 안내",
                "html": html,
            }
        )
        logger.info(f"비번 재설정 메일 발송 완료: to={to_email}")
        return True
    except Exception:
        logger.exception(f"Resend 비번 재설정 메일 발송 실패: to={to_email}")
        return False
