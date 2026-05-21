from pydantic import BaseModel


class ParseImage(BaseModel):
    data: str  # base64
    media_type: str


class ParseRequest(BaseModel):
    text: str | None = None
    image: ParseImage | None = None


class ParsedItem(BaseModel):
    kind: str  # spent | planned
    description: str
    amount: int
    category: str
    date: str
    place_name: str | None = None
    recurrence: str = "none"  # none | monthly | weekly | yearly
    recurrence_day: int | None = None  # monthly: 1-31, weekly: 0-6 (Mon=0)
    recurrence_until: str | None = None  # YYYY-MM-DD, 반복 항목은 필수 (서비스에서 강제)


class ParseResponse(BaseModel):
    items: list[ParsedItem]
    # AI가 사용자 입력에서 의도를 파악했지만 누락된 필드가 있어 추가 정보를
    # 요청해야 할 때 채우는 자연어 follow-up 메시지 (사용자 locale).
    # frontend 가 받으면 assistant 채팅 메시지로 표시. null 이면 일반 입력으로 간주.
    follow_up: str | None = None


class InsightRequest(BaseModel):
    month: str  # YYYY-MM


class InsightResponse(BaseModel):
    summary: str
    praise: str
    concern: str
    suggestion: str
