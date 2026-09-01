from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.agent.service import run_agent


router = APIRouter(
    prefix="/agent",
    tags=["AI Agent"]
)


@router.post("/chat")
def chat(
    message: str,
    db: Session = Depends(get_db)
):
    result = run_agent(
        user_message=message,
        db=db
    )

    return result