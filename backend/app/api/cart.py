from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.product import Product


router = APIRouter(
    prefix="/cart",
    tags=["Cart"]
)


# ---------------------------------------------------------
# ADD PRODUCT TO CART
# ---------------------------------------------------------

@router.post("/add")
def add_to_cart(
    session_id: str,
    product_id: int,
    quantity: int = 1,
    db: Session = Depends(get_db)
):
    if quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than 0"
        )

    # Check that product exists
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    # Find existing cart
    cart = db.query(Cart).filter(
        Cart.session_id == session_id
    ).first()

    # Create cart if it doesn't exist
    if not cart:
        cart = Cart(session_id=session_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)

    # Check whether product is already in cart
    cart_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.product_id == product_id
    ).first()

    if cart_item:
        cart_item.quantity += quantity
    else:
        cart_item = CartItem(
            cart_id=cart.id,
            product_id=product_id,
            quantity=quantity
        )
        db.add(cart_item)

    db.commit()
    db.refresh(cart_item)

    return {
        "message": "Product added to cart",
        "cart_id": cart.id,
        "product_id": product_id,
        "quantity": cart_item.quantity
    }


# ---------------------------------------------------------
# GET CART
# ---------------------------------------------------------

@router.get("")
def get_cart(
    session_id: str,
    db: Session = Depends(get_db)
):
    cart = db.query(Cart).filter(
        Cart.session_id == session_id
    ).first()

    if not cart:
        return {
            "cart_id": None,
            "items": [],
            "total": 0
        }

    items = (
        db.query(CartItem)
        .filter(CartItem.cart_id == cart.id)
        .all()
    )

    result = []
    total = 0

    for item in items:

        product = db.query(Product).filter(
            Product.id == item.product_id
        ).first()

        if product:

            item_total = float(product.price) * item.quantity

            total += item_total

            result.append({
                "id": product.id,
                "name": product.name,
                "price": float(product.price),
                "quantity": item.quantity,
                "total": item_total,
                "brand": product.brand,
                "color": product.color,
                "image_url": product.image_url,
                "category": product.category,
            })

    return {
        "cart_id": cart.id,
        "items": result,
        "total": total
    }


# ---------------------------------------------------------
# UPDATE QUANTITY
# ---------------------------------------------------------

@router.patch("/update")
def update_cart_quantity(
    session_id: str,
    product_id: int,
    quantity: int,
    db: Session = Depends(get_db)
):

    if quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than 0"
        )

    # Find cart
    cart = db.query(Cart).filter(
        Cart.session_id == session_id
    ).first()

    if not cart:
        raise HTTPException(
            status_code=404,
            detail="Cart not found"
        )

    # Find cart item
    cart_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.product_id == product_id
    ).first()

    if not cart_item:
        raise HTTPException(
            status_code=404,
            detail="Product not found in cart"
        )

    # Update quantity
    cart_item.quantity = quantity

    db.commit()
    db.refresh(cart_item)

    return {
        "message": "Cart quantity updated",
        "product_id": product_id,
        "quantity": cart_item.quantity
    }


# ---------------------------------------------------------
# REMOVE PRODUCT FROM CART
# ---------------------------------------------------------

@router.delete("/remove")
def remove_from_cart(
    session_id: str,
    product_id: int,
    db: Session = Depends(get_db)
):

    # Find cart
    cart = db.query(Cart).filter(
        Cart.session_id == session_id
    ).first()

    if not cart:
        raise HTTPException(
            status_code=404,
            detail="Cart not found"
        )

    # Find cart item
    cart_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.product_id == product_id
    ).first()

    if not cart_item:
        raise HTTPException(
            status_code=404,
            detail="Product not found in cart"
        )

    # Delete item
    db.delete(cart_item)

    db.commit()

    return {
        "message": "Product removed from cart",
        "product_id": product_id
    }
