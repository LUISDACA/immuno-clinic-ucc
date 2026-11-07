"""Stable, additive API response contracts shared by the clients."""

from typing import Any

from pydantic import BaseModel, ConfigDict


class ApiErrorResponse(BaseModel):
    """Canonical error envelope; ``detail`` is retained for legacy clients."""

    code: str
    message: str
    details: dict[str, Any] | list[dict[str, Any]] | None = None
    detail: Any = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "code": "INVALID_REQUEST",
                "message": "La solicitud no es válida.",
                "details": [{"loc": ["body", "field"], "type": "missing"}],
                "detail": "La solicitud no es válida.",
            }
        }
    )


class PageMetadata(BaseModel):
    """Canonical page metadata plus the original field names for compatibility."""

    page: int
    size: int
    total: int
    pages: int
    has_next: bool
    has_previous: bool
    page_size: int
    total_pages: int


class PageResponse[T](PageMetadata):
    items: list[T]

    @classmethod
    def create(cls, items: list[T], total: int, page: int, size: int):
        pages = (total + size - 1) // size
        return cls(
            items=items,
            page=page,
            size=size,
            total=total,
            pages=pages,
            has_next=page < pages,
            has_previous=page > 1 and pages > 0,
            page_size=size,
            total_pages=pages,
        )
