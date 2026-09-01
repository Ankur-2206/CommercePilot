from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.sql import func

from app.database.connection import Base


class PaymentAttempt(Base):
    """Maps one Razorpay order to the internal order it is paying for."""

    __tablename__ = "payment_attempts"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True)
    session_id = Column(String(100), nullable=False)
    razorpay_order_id = Column(String(100), nullable=False, unique=True, index=True)
    razorpay_payment_id = Column(String(100), unique=True, nullable=True, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    status = Column(String(30), nullable=False, default="created")
    created_at = Column(DateTime, server_default=func.now())
    paid_at = Column(DateTime, nullable=True)
