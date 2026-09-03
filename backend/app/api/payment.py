import os
import uuid
from datetime import datetime
from decimal import Decimal

import razorpay
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.payment_attempt import PaymentAttempt
from app.models.product import Product


router = APIRouter(prefix="/payment", tags=["Payment"])

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
    raise RuntimeError("Razorpay API keys are missing from .env")

client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


class VerifyPaymentRequest(BaseModel):
    session_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


def _cart_snapshot(db: Session, session_id: str):
    """Return immutable purchase data for the cart at payment creation time."""
    cart = db.query(Cart).filter(Cart.session_id == session_id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    items = db.query(CartItem).filter(CartItem.cart_id == cart.id).all()
    if not items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    snapshot = []
    total = Decimal("0.00")
    for item in items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"{product.name} is out of stock")

        price = Decimal(product.price)
        snapshot.append({"product_id": product.id, "quantity": item.quantity, "price": price})
        total += price * item.quantity

    return snapshot, total.quantize(Decimal("0.01"))


@router.post("/create-order")
def create_payment_order(session_id: str, db: Session = Depends(get_db)):
    snapshot, total = _cart_snapshot(db, session_id)

    # End the read transaction before the network call to Razorpay.
    db.rollback()
    receipt = f"cp_{uuid.uuid4().hex[:28]}"
    amount_in_paise = int(total * 100)

    try:
        razorpay_order = client.order.create(
            data={
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": receipt,
                "notes": {"session_id": session_id},
            }
        )
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create Razorpay order") from error

    try:
        # Persist the exact items and prices the customer was asked to pay for.
        order = Order(session_id=session_id, total_amount=total, status="pending")
        db.add(order)
        db.flush()

        for item in snapshot:
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=item["product_id"],
                    quantity=item["quantity"],
                    price=item["price"],
                )
            )

        db.add(
            PaymentAttempt(
                order_id=order.id,
                session_id=session_id,
                razorpay_order_id=razorpay_order["id"],
                amount=total,
                currency="INR",
                status="created",
            )
        )
        db.commit()
    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not save pending order") from error

    return {
        "razorpay_order_id": razorpay_order["id"],
        "amount": razorpay_order["amount"],
        "currency": razorpay_order["currency"],
        "key_id": RAZORPAY_KEY_ID,
    }


@router.post("/verify")
def verify_payment(payload: VerifyPaymentRequest, db: Session = Depends(get_db)):
    try:
        client.utility.verify_payment_signature(
            {
                "razorpay_order_id": payload.razorpay_order_id,
                "razorpay_payment_id": payload.razorpay_payment_id,
                "razorpay_signature": payload.razorpay_signature,
            }
        )
    except razorpay.errors.SignatureVerificationError as error:
        raise HTTPException(status_code=400, detail="Payment verification failed") from error

    try:
        attempt = (
            db.query(PaymentAttempt)
            .filter(PaymentAttempt.razorpay_order_id == payload.razorpay_order_id)
            .with_for_update()
            .first()
        )
        if not attempt or attempt.session_id != payload.session_id:
            raise HTTPException(status_code=404, detail="Pending payment not found")

        order = db.query(Order).filter(Order.id == attempt.order_id).with_for_update().first()
        if not order:
            raise HTTPException(status_code=404, detail="Pending order not found")

        # A repeated browser callback is safe: return the original paid order.
        if attempt.status == "paid":
            if attempt.razorpay_payment_id != payload.razorpay_payment_id:
                raise HTTPException(status_code=409, detail="Payment already completed")
            return {
                "message": "Payment already verified",
                "payment_id": attempt.razorpay_payment_id,
                "razorpay_order_id": attempt.razorpay_order_id,
                "order_id": order.id,
                "total_amount": float(order.total_amount),
                "status": order.status,
            }

        other_attempt = (
            db.query(PaymentAttempt)
            .filter(PaymentAttempt.razorpay_payment_id == payload.razorpay_payment_id)
            .with_for_update()
            .first()
        )
        if other_attempt:
            raise HTTPException(status_code=409, detail="Payment is already linked to another order")

        order_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        if not order_items:
            raise HTTPException(status_code=400, detail="Pending order has no items")

        # Lock product rows before validating/decrementing stock to avoid overselling.
        product_ids = [item.product_id for item in order_items]
        products = (
            db.query(Product)
            .filter(Product.id.in_(product_ids))
            .with_for_update()
            .all()
        )
        products_by_id = {product.id: product for product in products}
        for item in order_items:
            product = products_by_id.get(item.product_id)
            if not product or product.stock < item.quantity:
                raise HTTPException(status_code=409, detail="One or more paid items are out of stock")

        for item in order_items:
            products_by_id[item.product_id].stock -= item.quantity

        # Preserve anything the shopper added after this payment was started.
        cart = db.query(Cart).filter(Cart.session_id == payload.session_id).with_for_update().first()
        if cart:
            cart_items = (
                db.query(CartItem)
                .filter(CartItem.cart_id == cart.id, CartItem.product_id.in_(product_ids))
                .with_for_update()
                .all()
            )
            cart_items_by_product = {item.product_id: item for item in cart_items}
            for order_item in order_items:
                cart_item = cart_items_by_product.get(order_item.product_id)
                if not cart_item:
                    continue
                cart_item.quantity -= order_item.quantity
                if cart_item.quantity <= 0:
                    db.delete(cart_item)

        attempt.razorpay_payment_id = payload.razorpay_payment_id
        attempt.status = "paid"
        attempt.paid_at = datetime.utcnow()
        order.status = "paid"
        db.commit()

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Payment is already being processed") from error
    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not finalize payment") from error

    return {
        "message": "Payment verified successfully",
        "payment_id": payload.razorpay_payment_id,
        "razorpay_order_id": payload.razorpay_order_id,
        "order_id": order.id,
        "total_amount": float(order.total_amount),
        "status": order.status,
    }


@router.get("/orders")
def get_orders(session_id: str, db: Session = Depends(get_db)):
    """Retrieve all orders for a session with their items."""
    try:
        orders = db.query(Order).filter(Order.session_id == session_id).order_by(Order.created_at.desc()).all()
        
        result = []
        for order in orders:
            items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
            
            order_items = []
            for item in items:
                product = db.query(Product).filter(Product.id == item.product_id).first()
                order_items.append({
                    "product_id": item.product_id,
                    "product_name": product.name if product else "Unknown Product",
                    "quantity": item.quantity,
                    "price": float(item.price),
                })
            
            result.append({
                "order_id": order.id,
                "total_amount": float(order.total_amount),
                "status": order.status,
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "items": order_items,
            })
        
        return {
            "orders": result,
            "count": len(result),
        }
    
    except Exception as error:
        raise HTTPException(status_code=500, detail="Could not retrieve orders") from error
