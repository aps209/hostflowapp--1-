from pydantic import BaseModel, Field


class MenuImage(BaseModel):
    image_base64: str = Field(min_length=16, max_length=12_000_000)
    mime_type: str = Field(default="image/jpeg", max_length=60)


class MenuScanRequest(BaseModel):
    images: list[MenuImage] = Field(min_length=1, max_length=8)


class MenuApplyRequest(BaseModel):
    dishes: list[dict] = Field(default_factory=list)
