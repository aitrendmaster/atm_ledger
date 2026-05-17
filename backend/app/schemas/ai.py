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


class ParseResponse(BaseModel):
    items: list[ParsedItem]


class InsightRequest(BaseModel):
    month: str  # YYYY-MM


class InsightResponse(BaseModel):
    summary: str
    praise: str
    concern: str
    suggestion: str
