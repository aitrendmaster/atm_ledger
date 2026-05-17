from pydantic import BaseModel, Field


class ReflectionBase(BaseModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    type: str = Field(description="regret | praise | goal | insight")
    text: str = Field(min_length=1)


class ReflectionCreate(ReflectionBase):
    pass


class ReflectionOut(ReflectionBase):
    id: int

    class Config:
        from_attributes = True
