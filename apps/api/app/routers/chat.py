from datetime import UTC, datetime
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.db import get_db
from app.deps import get_current_user_id
from app.schemas.domain import ChatMessage

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatPost(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


@router.get("/messages", response_model=list[ChatMessage])
async def list_messages(user_id: Annotated[str, Depends(get_current_user_id)]) -> list[ChatMessage]:
    db = get_db()
    cursor = db.chat_messages.find({"user_id": user_id}).sort("created_at", 1).limit(100)
    out: list[ChatMessage] = []
    async for doc in cursor:
        out.append(
            ChatMessage(
                id=str(doc["_id"]),
                role=doc["role"],
                content=doc["content"],
                created_at=doc["created_at"],
            )
        )
    if not out:
        now = datetime.now(UTC)
        seed = [
            {
                "user_id": user_id,
                "role": "assistant",
                "content": (
                    "Welcome to CipherStrike agentic chat. Connect agents from the workspace "
                    "sidebar to begin orchestration."
                ),
                "created_at": now,
            }
        ]
        await db.chat_messages.insert_many(seed)
        cursor2 = db.chat_messages.find({"user_id": user_id}).sort("created_at", 1)
        async for doc in cursor2:
            out.append(
                ChatMessage(
                    id=str(doc["_id"]),
                    role=doc["role"],
                    content=doc["content"],
                    created_at=doc["created_at"],
                )
            )
    return out


@router.post("/messages", response_model=ChatMessage)
async def post_message(
    body: ChatPost,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ChatMessage:
    db = get_db()
    now = datetime.now(UTC)
    doc = {"user_id": user_id, "role": "user", "content": body.content, "created_at": now}
    ins = await db.chat_messages.insert_one(doc)
    reply = {
        "user_id": user_id,
        "role": "assistant",
        "content": (
            f"Received: {body.content[:200]}{'…' if len(body.content) > 200 else ''} "
            "(demo reply — wire to Ollama in production.)"
        ),
        "created_at": datetime.now(UTC),
    }
    ins2 = await db.chat_messages.insert_one(reply)
    rdoc = await db.chat_messages.find_one({"_id": ins2.inserted_id})
    if not rdoc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return ChatMessage(
        id=str(rdoc["_id"]),
        role=rdoc["role"],
        content=rdoc["content"],
        created_at=rdoc["created_at"],
    )


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> None:
    db = get_db()
    try:
        oid = ObjectId(message_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id")
    await db.chat_messages.delete_one({"_id": oid, "user_id": user_id})
