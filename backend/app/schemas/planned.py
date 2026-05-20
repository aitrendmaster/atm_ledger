from pydantic import BaseModel, Field


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
    pass


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


class PlannedOut(PlannedBase):
    id: int
    is_recurring_instance: bool = False  # True 면 가상으로 생성된 occurrence (DB row 아님)

    class Config:
        from_attributes = True
