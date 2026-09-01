from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database.connection import Base


class Cart(Base):
    __tablename__ = "carts"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    session_id = Column(
        String(100),
        unique=True,
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now()
    )