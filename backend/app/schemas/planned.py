from pydantic import BaseModel, Field


class PlannedBase(BaseModel):
    description: str = Field(min_length=1, max_length=255)
    amount: int = Field(ge=0)
    category: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    type: str = Field(default="event")
    note: str | None = None


class PlannedCreate(PlannedBase):
    pass


class PlannedUpdate(BaseModel):
    description: str | None = None
    amount: int | None = Field(default=None, ge=0)
    category: str | None = None
    date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    type: str | None = None
    note: str | None = None


class PlannedOut(PlannedBase):
    id: int

    class Config:
        from_attributes = True
