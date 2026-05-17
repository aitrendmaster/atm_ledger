from pydantic import BaseModel, Field


class PhotoOut(BaseModel):
    id: int
    url: str

    class Config:
        from_attributes = True


class EntryBase(BaseModel):
    description: str = Field(min_length=1, max_length=255)
    amount: int = Field(ge=0)
    category: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    place_name: str | None = None
    place_lat: float | None = None
    place_lng: float | None = None
    place_address: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    review: str | None = None
    mood: str | None = None


class EntryCreate(EntryBase):
    pass


class EntryUpdate(BaseModel):
    description: str | None = None
    amount: int | None = Field(default=None, ge=0)
    category: str | None = None
    date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    place_name: str | None = None
    place_lat: float | None = None
    place_lng: float | None = None
    place_address: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    review: str | None = None
    mood: str | None = None


class EntryOut(EntryBase):
    id: int
    photos: list[PhotoOut] = []

    class Config:
        from_attributes = True
