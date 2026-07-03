from pydantic import BaseModel, Field


class WorkerCreateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=160)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=255)
    password: str = Field(min_length=8, max_length=128)
    pin: str = Field(pattern=r"^\d{4,12}$")
    role: str = "WORKER"


class WorkerUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    is_active: bool | None = None
