from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=255)
    password: str = Field(min_length=1)


class ValidateLicenseRequest(BaseModel):
    license_key: str = Field(min_length=12, max_length=120)


class RegisterCompanyRequest(BaseModel):
    license_key: str = Field(min_length=12, max_length=120)
    company_name: str = Field(min_length=1, max_length=160)
    ceo_full_name: str = Field(min_length=1, max_length=160)
    ceo_email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=255)
    ceo_password: str = Field(min_length=8, max_length=128)
    ceo_pin: str = Field(pattern=r"^\d{4,12}$")


class VerifyPinRequest(BaseModel):
    temporary_token: str = Field(min_length=20)
    pin: str = Field(pattern=r"^\d{4,12}$")
