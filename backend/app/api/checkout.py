from fastapi import APIRouter, HTTPException


router = APIRouter(
    prefix="/checkout",
    tags=["Checkout"]
)


@router.post("")
def checkout():
    """Deprecated: payment verification now creates paid orders safely."""
    raise HTTPException(
        status_code=410,
        detail="Use /api/payment/create-order followed by /api/payment/verify.",
    )
