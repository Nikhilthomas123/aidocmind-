import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db, SessionLocal
from models.models import Document, DocumentChunk, ChatSession, ChatMessage, User
from models.schemas import ChatRequest, ChatSessionResponse
from middleware.auth_middleware import get_current_user
import services.ai_service as ai_service

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = logging.getLogger(__name__)

@router.post("/send")
async def send_chat_message(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    x_openai_key: Optional[str] = Header(None)
):
    # 1. Verify document ownership
    doc_result = await db.execute(
        select(Document).where(Document.id == req.document_id, Document.user_id == current_user.id)
    )
    doc = doc_result.scalars().first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied."
        )

    # 2. Get or create ChatSession for this document
    session_result = await db.execute(
        select(ChatSession)
        .where(ChatSession.document_id == req.document_id, ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
    )
    session = session_result.scalars().first()
    
    if not session:
        session = ChatSession(
            user_id=current_user.id,
            document_id=req.document_id,
            title=f"Chat regarding {doc.filename[:30]}"
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

    # 3. Load chat history (last 10 messages)
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(10)
    )
    history_msgs = history_result.scalars().all()
    chat_history = [{"role": m.role, "content": m.content} for m in history_msgs]

    # 4. Generate query embedding vector
    query_embedding = await ai_service.generate_embeddings(req.query, user_key=x_openai_key)

    # 5. Perform cosine similarity vector search in DB chunks
    # Order chunks by cosine distance (native pgvector operation)
    vector_query = (
        select(DocumentChunk)
        .where(DocumentChunk.document_id == req.document_id)
        .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        .limit(4)
    )
    
    chunks_result = await db.execute(vector_query)
    matching_chunks = chunks_result.scalars().all()
    context_passages = [chunk.content for chunk in matching_chunks]

    # 6. Stream RAG response back to frontend
    async def event_generator():
        collected_tokens = []
        async for token in ai_service.stream_chat(req.query, context_passages, chat_history, user_key=x_openai_key):
            collected_tokens.append(token)
            yield f"data: {token}\n\n"
            
        assistant_response = "".join(collected_tokens)
        
        # Save messages to database safely
        async with SessionLocal() as db_session:
            # Save User question
            user_msg = ChatMessage(
                session_id=session.id,
                role="user",
                content=req.query
            )
            # Save Assistant answer
            assistant_msg = ChatMessage(
                session_id=session.id,
                role="assistant",
                content=assistant_response
            )
            db_session.add(user_msg)
            db_session.add(assistant_msg)
            await db_session.commit()
            
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/sessions/{doc_id}", response_model=List[ChatSessionResponse])
async def list_chat_sessions(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.document_id == doc_id, ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
    )
    return result.scalars().all()
