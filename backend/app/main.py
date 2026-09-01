from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database.connection import engine, Base

from app.models.product import Product
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.payment_attempt import PaymentAttempt

from app.api.products import router as products_router
from app.api.agent import router as agent_router
from app.api.cart import router as cart_router
from app.api.payment import router as payment_router


app = FastAPI(
    title="CommercePilot API",
    description="AI-powered agentic commerce platform",
    version="1.0.0"
)


# ----------------------------------------
# CORS
# ----------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------
# REGISTER SQLAlchemy MODELS
# ----------------------------------------

Base.metadata.create_all(bind=engine)


# ----------------------------------------
# PRODUCT APIs
# ----------------------------------------

app.include_router(
    products_router,
    prefix="/api"
)


# ----------------------------------------
# AI AGENT APIs
# ----------------------------------------

app.include_router(
    agent_router,
    prefix="/api"
)


# ----------------------------------------
# CART APIs
# ----------------------------------------

app.include_router(
    cart_router,
    prefix="/api"
)


# ----------------------------------------
# RAZORPAY PAYMENT APIs
# ----------------------------------------

app.include_router(
    payment_router,
    prefix="/api"
)


# ----------------------------------------
# HOME
# ----------------------------------------

@app.get("/")
def home():
    return {
        "message": "CommercePilot API is running"
    }


# ----------------------------------------
# DATABASE TEST
# ----------------------------------------

@app.get("/db-test")
def database_test():

    with engine.connect() as connection:

        result = connection.execute(
            text("SELECT DATABASE()")
        )

        database_name = result.scalar()

    return {
        "database": database_name,
        "status": "connected"
    }
