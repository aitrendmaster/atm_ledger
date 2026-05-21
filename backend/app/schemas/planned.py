from datetime import date as _date

from pydantic import BaseModel, Field, model_validator


def validate_recurrence_state(
    recurrence: str | None,
    recurrence_until: str | None,
    start_date: str | None,
) -> None:
    """반복 항목이면 종료일 필수 + 시작일 이후여야 함.

    Schema (Create) 와 router (PATCH merged state) 양쪽에서 호출.
    """
    if recurrence and recurrence != "none":
        if not recurrence_until:
            raise ValueError(
                "recurrence_until is required when recurrence is not 'none'"
            )
        if start_date:
            if _date.fromisoformat(recurrence_until) < _date.fromisoformat(start_date):
                raise ValueError("recurrence_until must be on or after date")


# legacy alias (내부 사용만)
_ensure_recurrence_end = validate_recurrence_state


class PlannedBase(BaseModel):
    description: str = Field(min_length=1, max_length=255)
    amount: int = Field(ge=0)
    category: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    type: str = Field(default="event")
    note: str | None = None
    recurrence: str = Field(default="none", pattern=r"^(none|monthly|weekly|yearly)$")
    recurrence_day: int | None = None
    recurrence_until: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class PlannedCreate(PlannedBase):
    @model_validator(mode="after")
    def _check_recurrence_end(self):
        _ensure_recurrence_end(self.recurrence, self.recurrence_until, self.date)
        return self


class PlannedUpdate(BaseModel):
    description: str | None = None
    amount: int | None = Field(default=None, ge=0)
    category: str | None = None
    date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    type: str | None = None
    note: str | None = None
    recurrence: str | None = Field(default=None, pattern=r"^(none|monthly|weekly|yearly)$")
    recurrence_day: int | None = None
    recurrence_until: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")

    # PATCH 검증은 router 에서 merged state 로 수행 (validate_recurrence_state 헬퍼)


class PlannedOut(PlannedBase):
    id: int
    is_recurring_instance: bool = False  # True 면 가상으로 생성된 occurrence (DB row 아님)

    class Config:
        from_attributes = True
