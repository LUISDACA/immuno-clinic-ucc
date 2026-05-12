"""Communication thread and message ORM models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.enums import ConversationStatus
from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.users.models import User


class CommunicationThread(Base, UUIDMixin, TimestampMixin):
    """Conversation between a student and administrators."""

    __tablename__ = "communication_threads"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    recipient_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[ConversationStatus] = mapped_column(
        Enum(ConversationStatus, name="conversation_status_enum"),
        default=ConversationStatus.OPEN,
        nullable=False,
    )
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    student: Mapped["User"] = relationship(
        foreign_keys=[student_id],
        lazy="joined",
    )
    created_by: Mapped["User | None"] = relationship(
        foreign_keys=[created_by_id],
        lazy="joined",
    )
    recipient: Mapped["User | None"] = relationship(
        foreign_keys=[recipient_id],
        lazy="joined",
    )
    messages: Mapped[list["CommunicationMessage"]] = relationship(
        back_populates="thread",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="CommunicationMessage.created_at",
    )


class CommunicationMessage(Base, UUIDMixin):
    """Single message inside a communication thread."""

    __tablename__ = "communication_messages"

    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("communication_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    thread: Mapped["CommunicationThread"] = relationship(back_populates="messages")
    sender: Mapped["User | None"] = relationship(lazy="joined")
