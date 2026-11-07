"""Pagination utilities."""

from pydantic import AliasChoices, BaseModel, Field


class PaginationParams(BaseModel):
    """Query parameters for paginated endpoints."""

    page: int = Field(default=1, ge=1)
    size: int = Field(
        default=20,
        ge=1,
        le=100,
        validation_alias=AliasChoices("size", "page_size"),
    )

    @property
    def page_size(self) -> int:
        """Legacy accessor retained while callers move to ``size``."""
        return self.size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size

    @property
    def limit(self) -> int:
        return self.size


class PaginatedResponse(BaseModel):
    """Wrapper for paginated API responses."""

    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
    size: int
    pages: int
    has_next: bool
    has_previous: bool

    @classmethod
    def create(cls, items: list, total: int, params: PaginationParams):
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.size,
            total_pages=(total + params.size - 1) // params.size,
            size=params.size,
            pages=(total + params.size - 1) // params.size,
            has_next=params.page < (total + params.size - 1) // params.size,
            has_previous=params.page > 1 and total > 0,
        )
