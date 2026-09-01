from sqlalchemy import Column, Integer, String, DateTime, Numeric
from sqlalchemy.sql import func

from app.database.connection import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    session_id = Column(
        String(100),
        nullable=False
    )

    total_amount = Column(
        Numeric(10, 2),
        nullable=False
    )

    status = Column(
        String(50),
        nullable=False,
        default="pending"
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )