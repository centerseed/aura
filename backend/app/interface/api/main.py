from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime

from app.domain.models import Task, StatusEnum
from app.domain.schemas import (
    CreateSubItemRequest,
    UpdateSubItemRequest,
    ReorderSubItemsRequest,
    TaskWithSubItems,
    SubItem,
    SubItemsMeta,
    TopicCluster,
    ReorganizeProposal
)
from app.infrastructure.db import get_db_session
from sqlmodel import select

app = FastAPI(title="Aura Business OS API - Naruvia")

# ===== Auth Models =====
class SignInRequest(BaseModel):
    auth_method: str
    email: str
    firebase_uid: str
    display_name: Optional[str] = None
    photo_url: Optional[str] = None

class RawInputRequest(BaseModel):
    text: str

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/")
def read_root():
    return {"message": "Aura Business OS API is running."}

# ===== Authentication Endpoints =====

@app.post("/api/auth/signin")
async def signin(request: SignInRequest):
    """
    使用者登入端點。
    驗證認證方式並與資料庫同步使用者資訊。
    """
    # 驗證認證方式
    if not request.auth_method:
        raise HTTPException(
            status_code=400,
            detail="需要提供認證方式"
        )

    # 驗證是否支援此認證方式
    supported_methods = ["google", "email", "firebase"]
    if request.auth_method not in supported_methods:
        raise HTTPException(
            status_code=400,
            detail=f"不支援的認證方式: {request.auth_method}。支援的方式: {', '.join(supported_methods)}"
        )

    # 驗證必要欄位
    if not request.email:
        raise HTTPException(
            status_code=400,
            detail="需要提供電子郵件"
        )

    if not request.firebase_uid:
        raise HTTPException(
            status_code=400,
            detail="需要提供 Firebase UID"
        )

    # 返回成功響應（未來可以與資料庫同步或創建使用者）
    return {
        "success": True,
        "auth_method": request.auth_method,
        "email": request.email,
        "firebase_uid": request.firebase_uid,
        "display_name": request.display_name,
        "photo_url": request.photo_url,
        "message": f"使用者 {request.email} 已透過 {request.auth_method} 認證"
    }

@app.post("/ingest")
async def ingest_input(request: RawInputRequest):
    """
    主要輸入介面：接收 Bot 或 Web 的原始文字。
    """
    # 這裡未來會串接 Gatekeeper Agent 實作
    return {
        "status": "received",
        "processed_data": {
            "text": request.text,
            "note": "Aura engine is ready to process."
        }
    }

# ===== Task & Sub-items CRUD API =====

@app.get("/api/tasks/{task_id}", response_model=TaskWithSubItems)
async def get_task(task_id: str):
    """獲取單一 Task,包含 sub_items"""
    async with get_db_session() as session:
        task = await session.get(Task, uuid.UUID(task_id))
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # 解析 sub_items
        ai_analysis = task.ai_analysis or {}
        sub_items_raw = ai_analysis.get("sub_items", [])
        sub_items = [SubItem(**item) for item in sub_items_raw]

        sub_items_meta = SubItemsMeta(**ai_analysis.get("sub_items_meta", {}))

        return TaskWithSubItems(
            id=str(task.id),
            content=task.content,
            narrative=ai_analysis.get("narrative"),
            status=task.status.value if task.status else None,
            sub_items=sub_items,
            sub_items_meta=sub_items_meta
        )

@app.get("/api/tasks", response_model=List[TaskWithSubItems])
async def list_tasks(user_id: str, status: Optional[str] = None):
    """列出用戶的所有 Task"""
    async with get_db_session() as session:
        stmt = select(Task).where(Task.user_id == uuid.UUID(user_id))
        if status:
            stmt = stmt.where(Task.status == status)

        result = await session.execute(stmt)
        tasks = result.scalars().all()

        # 轉換為 response model
        return [
            TaskWithSubItems(
                id=str(t.id),
                content=t.content,
                narrative=t.ai_analysis.get("narrative") if t.ai_analysis else None,
                status=t.status.value if t.status else None,
                sub_items=[SubItem(**s) for s in t.ai_analysis.get("sub_items", [])] if t.ai_analysis else [],
                sub_items_meta=SubItemsMeta(**t.ai_analysis.get("sub_items_meta", {})) if t.ai_analysis else SubItemsMeta()
            )
            for t in tasks
        ]

@app.post("/api/tasks/{task_id}/sub-items")
async def create_sub_item(task_id: str, request: CreateSubItemRequest):
    """手動新增 sub-item (用戶後續補充)"""
    async with get_db_session() as session:
        task = await session.get(Task, uuid.UUID(task_id))
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        ai_analysis = task.ai_analysis or {}
        sub_items = ai_analysis.get("sub_items", [])

        # 新增 sub-item
        new_sub_item = {
            "id": str(uuid.uuid4()),
            "content": request.content,
            "completed": False,
            "created_at": datetime.utcnow().isoformat(),
            "completed_at": None,
            "order": len(sub_items)  # 自動排到最後
        }
        sub_items.append(new_sub_item)

        # 更新 meta
        ai_analysis["sub_items"] = sub_items
        ai_analysis["sub_items_meta"] = _calculate_meta(sub_items)

        task.ai_analysis = ai_analysis
        task.updated_at = datetime.utcnow()

        session.add(task)
        await session.commit()
        await session.refresh(task)

        return {"success": True, "sub_item": new_sub_item}

@app.patch("/api/tasks/{task_id}/sub-items/{sub_item_id}")
async def update_sub_item(task_id: str, sub_item_id: str, request: UpdateSubItemRequest):
    """更新 sub-item (修改內容、勾選完成、重排序)"""
    async with get_db_session() as session:
        task = await session.get(Task, uuid.UUID(task_id))
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        ai_analysis = task.ai_analysis or {}
        sub_items = ai_analysis.get("sub_items", [])

        # 找到目標 sub-item
        target_sub = None
        for sub in sub_items:
            if sub["id"] == sub_item_id:
                target_sub = sub
                break

        if not target_sub:
            raise HTTPException(status_code=404, detail="Sub-item not found")

        # 更新欄位
        if request.content is not None:
            target_sub["content"] = request.content

        if request.completed is not None:
            target_sub["completed"] = request.completed
            if request.completed:
                target_sub["completed_at"] = datetime.utcnow().isoformat()
            else:
                target_sub["completed_at"] = None

        if request.order is not None:
            target_sub["order"] = request.order

        # 更新 meta
        meta = _calculate_meta(sub_items)
        ai_analysis["sub_items_meta"] = meta

        # 🆕 自動完成邏輯: 所有 sub-items 完成 → Task 自動歸檔
        if meta["total"] > 0 and meta["completed"] == meta["total"]:
            task.status = StatusEnum.ARCHIVE

        task.ai_analysis = ai_analysis
        task.updated_at = datetime.utcnow()

        session.add(task)
        await session.commit()

        return {
            "success": True,
            "sub_item": target_sub,
            "task_completed": (meta["completed"] == meta["total"])
        }

@app.delete("/api/tasks/{task_id}/sub-items/{sub_item_id}")
async def delete_sub_item(task_id: str, sub_item_id: str):
    """刪除 sub-item"""
    async with get_db_session() as session:
        task = await session.get(Task, uuid.UUID(task_id))
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        ai_analysis = task.ai_analysis or {}
        sub_items = ai_analysis.get("sub_items", [])

        # 移除 sub-item
        ai_analysis["sub_items"] = [s for s in sub_items if s["id"] != sub_item_id]
        ai_analysis["sub_items_meta"] = _calculate_meta(ai_analysis["sub_items"])

        task.ai_analysis = ai_analysis
        task.updated_at = datetime.utcnow()

        session.add(task)
        await session.commit()

        return {"success": True}

@app.post("/api/tasks/{task_id}/sub-items/reorder")
async def reorder_sub_items(task_id: str, request: ReorderSubItemsRequest):
    """批量重排 sub-items 順序 (拖曳後呼叫)"""
    async with get_db_session() as session:
        task = await session.get(Task, uuid.UUID(task_id))
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        ai_analysis = task.ai_analysis or {}
        sub_items = ai_analysis.get("sub_items", [])

        # 更新 order
        order_map = {item["id"]: item["order"] for item in request.sub_item_orders}
        for sub in sub_items:
            if sub["id"] in order_map:
                sub["order"] = order_map[sub["id"]]

        # 按 order 重新排序
        ai_analysis["sub_items"] = sorted(sub_items, key=lambda x: x["order"])

        task.ai_analysis = ai_analysis
        task.updated_at = datetime.utcnow()

        session.add(task)
        await session.commit()

        return {"success": True}

# ===== Product Reorganization API =====

@app.post("/api/products/{product_id}/reorganize-topics", response_model=ReorganizeProposal)
async def reorganize_product_topics(product_id: str, user_id: str):
    """
    AI 分析 Product 下的所有 Tasks 並建議新的 Topic 分群 + 時間推斷。

    考慮因素:
    1. Tasks 的語義相似度 (重新分群)
    2. Product 的 Milestones (時間錨點)
    3. 為每個 Task 推斷建議的 due_date
    """
    from app.services.librarian import LibrarianService

    librarian = LibrarianService()

    try:
        proposal = await librarian.reorganize_product_topics(
            product_id=uuid.UUID(product_id),
            user_id=uuid.UUID(user_id)
        )
        return proposal
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reorganization failed: {str(e)}")

@app.post("/api/products/{product_id}/apply-reorganization")
async def apply_reorganization(product_id: str, user_id: str, proposal: ReorganizeProposal):
    """
    應用 AI 建議的重組方案:
    1. 更新 Tasks 的 Topic 分配
    2. 更新 Tasks 的 due_date 和 urgency_level
    """
    async with get_db_session() as session:
        # 1. 根據 proposed_clusters 更新 Topic 分配
        for cluster in proposal.proposed_clusters:
            # 找到或創建 Topic
            from sqlmodel import select
            from app.domain.models import Topic, Product

            product = await session.get(Product, uuid.UUID(product_id))
            if not product:
                raise HTTPException(status_code=404, detail="Product not found")

            topic_stmt = select(Topic).where(
                Topic.product_id == uuid.UUID(product_id),
                Topic.name == cluster.topic_name
            )
            topic_result = await session.execute(topic_stmt)
            topic = topic_result.scalars().first()

            if not topic:
                topic = Topic(
                    user_id=uuid.UUID(user_id),
                    product_id=uuid.UUID(product_id),
                    name=cluster.topic_name
                )
                session.add(topic)
                await session.flush()

            # 更新該 cluster 中的所有 Tasks
            for task_id_str in cluster.task_ids:
                task = await session.get(Task, uuid.UUID(task_id_str))
                if task:
                    task.topic_id = topic.id
                    session.add(task)

        # 2. 根據 time_inferences 更新 due_date
        for inference in proposal.time_inferences:
            task = await session.get(Task, uuid.UUID(inference.task_id))
            if task:
                if inference.suggested_due_date:
                    from datetime import datetime
                    task.due_date = datetime.fromisoformat(inference.suggested_due_date)

                task.inferred_from_milestone_id = (
                    uuid.UUID(inference.inferred_from_milestone_id)
                    if inference.inferred_from_milestone_id else None
                )
                task.time_confidence = inference.time_confidence
                task.urgency_level = inference.urgency_level

                # 更新 ai_analysis
                if not task.ai_analysis:
                    task.ai_analysis = {}
                task.ai_analysis["time_inference_reasoning"] = inference.reasoning

                session.add(task)

        await session.commit()

        return {
            "success": True,
            "updated_topics": len(proposal.proposed_clusters),
            "updated_tasks": len(proposal.time_inferences)
        }

# ===== Helper Functions =====

def _calculate_meta(sub_items: List[dict]) -> dict:
    """計算 sub_items 統計資訊"""
    total = len(sub_items)
    completed = sum(1 for s in sub_items if s.get("completed", False))
    completion_rate = completed / total if total > 0 else 0.0

    return {
        "total": total,
        "completed": completed,
        "completion_rate": completion_rate
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
