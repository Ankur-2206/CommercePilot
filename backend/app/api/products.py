from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.product import Product

from typing import Optional


router = APIRouter(prefix="/products", tags=["Products"])


@router.get("/")
def get_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()

    return products



@router.get("/search")
def search_products(
    category: Optional[str] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    wireless: Optional[bool] = None,
    min_battery: Optional[int] = None,
    db: Session = Depends(get_db)
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