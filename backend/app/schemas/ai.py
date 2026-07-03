from typing import Any, Literal

from pydantic import BaseModel, Field


class AIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = Field(default=None, max_length=120)


class AIInsight(BaseModel):
    type: Literal["warning", "success", "info"] = "info"
    title: str
    description: str


class AIRecommendedAction(BaseModel):
    id: str
    label: str
    requires_confirmation: bool = True
    payload: dict[str, Any] = Field(default_factory=dict)


class AIChatResponse(BaseModel):
    answer: str
    insights: list[AIInsight] = Field(default_factory=list)
    recommended_actions: list[AIRecommendedAction] = Field(default_factory=list)


class AIActionConfirmRequest(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    payload: dict[str, Any] = Field(default_factory=dict)
