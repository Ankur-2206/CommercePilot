from sqlalchemy import Column, Integer, String, ForeignKey
from app.database.connection import Base


class ProductRelationship(Base):
    __tablename__ = "product_relationships"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    related_product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    relationship_type = Column(
        String(50),
        nullable=False,
        default="complementary"
    )
    priority = Column(Integer, nullable=False, default=1)