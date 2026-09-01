from app.models.product_relationship import ProductRelationship

from typing import Optional

from sqlalchemy.orm import Session

from app.models.product import Product


def search_products(
    db: Session,
    category: Optional[str] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    wireless: Optional[bool] = None,
    min_battery: Optional[int] = None,
):
    query = db.query(Product)

    if category:
        query = query.filter(Product.category == category)

    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    if min_rating is not None:
        query = query.filter(Product.rating >= min_rating)

    if wireless is not None:
        query = query.filter(Product.wireless == wireless)

    if min_battery is not None:
        query = query.filter(Product.battery_hours >= min_battery)

    return query.all()

def get_related_products(
    db: Session,
    product_id: int,
):
    query = (
        db.query(Product)
        .join(
            ProductRelationship,
            ProductRelationship.related_product_id == Product.id
        )
        .filter(
            ProductRelationship.product_id == product_id
        )
        .order_by(ProductRelationship.priority.asc())
    )

    products = query.all()

    return products

