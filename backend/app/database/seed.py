"""Seed CommercePilot's MySQL database from CSV files.

Reads:
  - products.csv             -> Product rows
  - product_relationships.csv -> ProductRelationship rows

Run with:  python -m app.database.seed
"""

import csv
from decimal import Decimal
from pathlib import Path

from app.database.connection import SessionLocal
from app.models.product import Product
from app.models.product_relationship import ProductRelationship


# Path to the CSV files (same directory as this module).
_DATA_DIR = Path(__file__).parent

# Required columns on every row of products.csv.
# `description` and the optional `brand`, `color`, `image_url` columns are
# read directly from the row dict and don't need to appear here.
_PRODUCT_COLUMNS = (
    "name",
    "category",
    "price",
    "rating",
    "stock",
    "wireless",
    "battery_hours",
)

# Optional product columns — missing or empty values become None.
_OPTIONAL_PRODUCT_COLUMNS = ("brand", "color", "image_url")


def _parse_bool(value: str) -> bool:
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def _parse_int_or_none(value: str):
    value = (value or "").strip()
    if value == "":
        return None
    return int(value)


def _parse_str_or_none(value: str):
    value = (value or "").strip()
    return value or None


def _row_to_product(row: dict) -> Product:
    """Build a Product from one CSV row."""
    return Product(
        name=row["name"].strip(),
        description=row["description"].strip(),
        category=row["category"].strip(),
        price=Decimal(row["price"].strip()),
        rating=Decimal(row["rating"].strip()),
        stock=int(row["stock"]),
        wireless=_parse_bool(row["wireless"]),
        battery_hours=_parse_int_or_none(row["battery_hours"]),
        brand=_parse_str_or_none(row.get("brand", "")),
        color=_parse_str_or_none(row.get("color", "")),
        image_url=_parse_str_or_none(row.get("image_url", "")),
    )


def seed_products():
    """Insert products from products.csv if the table is empty."""
    csv_path = _DATA_DIR / "products.csv"

    db = SessionLocal()
    try:
        if db.query(Product).count() > 0:
            print("Products already exist. Nothing to add.")
            return

        with csv_path.open(newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            missing = [c for c in _PRODUCT_COLUMNS if c not in reader.fieldnames]
            if missing:
                raise ValueError(
                    f"products.csv is missing required columns: {missing}"
                )

            rows = [_row_to_product(row) for row in reader]

        db.add_all(rows)
        db.commit()
        print(f"Added {len(rows)} products from {csv_path.name}.")

    finally:
        db.close()


def seed_relationships():
    """Insert product cross-sell pairs from product_relationships.csv."""
    csv_path = _DATA_DIR / "product_relationships.csv"

    db = SessionLocal()
    try:
        if db.query(ProductRelationship).count() > 0:
            print("Relationships already exist. Nothing to add.")
            return

        # Build a name -> Product lookup once so we can resolve FKs.
        products_by_name = {p.name: p for p in db.query(Product).all()}

        added = 0
        skipped = 0
        with csv_path.open(newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                source = products_by_name.get(row["source_name"].strip())
                related = products_by_name.get(row["related_name"].strip())

                if not source or not related:
                    skipped += 1
                    continue

                db.add(
                    ProductRelationship(
                        product_id=source.id,
                        related_product_id=related.id,
                        relationship_type=row.get(
                            "relationship_type", "complementary"
                        ).strip() or "complementary",
                        priority=int(row.get("priority", 1) or 1),
                    )
                )
                added += 1

        db.commit()
        print(
            f"Added {added} product relationships "
            f"({skipped} skipped due to unknown names)."
        )

    finally:
        db.close()


if __name__ == "__main__":
    seed_products()
    seed_relationships()
