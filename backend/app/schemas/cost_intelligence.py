from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    contact_info: str | None = Field(default=None, max_length=500)


class IngredientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    unit: str = Field(default="kg", max_length=20)
    current_cost_per_unit: float = Field(ge=0)
    previous_cost_per_unit: float | None = Field(default=None, ge=0)
    categoria: str | None = Field(default=None, max_length=40)
    stock_actual: float = Field(default=0, ge=0)
    stock_minimo: float = Field(default=0, ge=0)
    proveedor: str | None = Field(default=None, max_length=160)
    supplier_id: str | None = None


class IngredientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    unit: str | None = Field(default=None, max_length=20)
    current_cost_per_unit: float | None = Field(default=None, ge=0)
    categoria: str | None = Field(default=None, max_length=40)
    stock_actual: float | None = Field(default=None, ge=0)
    stock_minimo: float | None = Field(default=None, ge=0)
    proveedor: str | None = Field(default=None, max_length=160)
    activo: bool | None = None


class DishCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    sale_price: float = Field(ge=0)
    category: str | None = Field(default=None, max_length=80)
    active: bool = True
    target_margin: float = Field(default=0.68, ge=0, le=0.95)
    estimated_monthly_units: int = Field(default=0, ge=0)


class DishUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    sale_price: float | None = Field(default=None, ge=0)
    category: str | None = Field(default=None, max_length=80)
    active: bool | None = None
    target_margin: float | None = Field(default=None, ge=0, le=0.95)
    estimated_monthly_units: int | None = Field(default=None, ge=0)


class RecipeItemCreate(BaseModel):
    dish_id: str
    ingredient_id: str
    quantity: float = Field(gt=0)
    unit: str = Field(default="kg", max_length=20)


class InvoiceItemCreate(BaseModel):
    ingredient_id: str
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)


class InvoiceCreate(BaseModel):
    supplier_id: str | None = None
    invoice_date: date
    total_amount: float = Field(ge=0)
    items: list[InvoiceItemCreate] = Field(default_factory=list)


class GenerateRecommendationsRequest(BaseModel):
    target_margin: float = Field(default=0.68, ge=0.05, le=0.95)


class SimulatePriceChangeRequest(BaseModel):
    dish_id: str
    new_price: float = Field(gt=0)


class PriceSimulationResponse(BaseModel):
    current_price: float
    new_price: float
    current_margin: float
    new_margin: float
    estimated_monthly_impact: float
    risk_level: Literal["low", "medium", "high"]
    explanation: str


class TicketScanRequest(BaseModel):
    image_base64: str = Field(min_length=16, max_length=12_000_000)
    mime_type: str = Field(default="image/jpeg", max_length=60)
    note: str | None = Field(default=None, max_length=400)


class TicketApplyRequest(BaseModel):
    rows: list[dict] = Field(default_factory=list)
    supplier: str | None = Field(default=None, max_length=160)
    date: str | None = Field(default=None, max_length=40)
    replenish_stock: bool = True
