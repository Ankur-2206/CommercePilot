from sqlalchemy import String, Integer, Numeric, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.connection import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    price: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )

    rating: Mapped[float] = mapped_column(
        Numeric(3, 2),
        nullable=False
    )

    stock: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )

    wireless: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )

    battery_hours: Mapped[int] = mapped_column(
        Integer,
        nullable=True
    )

    brand: Mapped[str] = mapped_column(
        String(100),
        nullable=True
    )

    color: Mapped[str] = mapped_column(
        String(100),
        nullable=True
    )

    image_url: Mapped[str] = mapped_column(
        String(512),
        nullable=True
    )