"""
Librarian Service - Naruvia 的核心知識治理服務。

職責：
- 結構化混沌輸入（Brain Dump → 雙軸矩陣）
- 執行治理指令（重命名、移動、重新分類）
- 維護用戶的知識庫

遵循 Functional Specification (002_Functional_Specification.md)。
"""
import os
import uuid
import json
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from sqlmodel import select
from sqlalchemy import delete

from app.domain.models import Task, StatusEnum, LifecycleEnum, Area, Product, Topic, Milestone
from app.infrastructure.llm.gemini_adapter import GeminiAdapter
from app.infrastructure.db import get_db_session
from app.services.prompts import (
    build_insight_agent_prompt,
    build_structure_agent_prompt,
    build_governance_agent_prompt,
)

# --- Pydantic Models for Structured Output ---
class TagOutput(BaseModel):
    area: str = Field(description="L1 Area: The workspace or identity context (e.g., Work, Personal, SideProject). No fixed prefixes.")
    product: str = Field(description="L2 Product: The long-term asset being built.")
    topic: str = Field(description="L3 Topic: The thematic module or functional area within the product (e.g., Frontend, Sales Strategy, Legal Documentation).")

class StructuredItem(BaseModel):
    id: Optional[uuid.UUID] = None
    title: str = Field(description="Actionable or Descriptive Title")
    narrative: str = Field(description="Integrated narrative weaving fragments into a continuous story")
    drawer: StatusEnum = Field(description="00_inbox, 10_active, 20_maintain, 30_reference, 40_archive")
    lifecycle: LifecycleEnum = Field(description="finite (Project) or perpetual (Asset)")
    tag: TagOutput
    strategy_used: str = Field(description="Entropy Reduction / High Entropy Preservation / Atomic Collapse")
    reasoning: str = Field(description="Governance logic based on First Principles")
    merged_items: List[str] = Field(description="List of original input fragments swallowed into this item")

    # 新增: Sub-items support for Structured Aggregation
    sub_items: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional list of actionable sub-tasks if aggregation_mode is 'structured'. Each item: {content: str}"
    )
    aggregation_mode: str = Field(
        default="narrative",
        description="Aggregation strategy: 'narrative' (default, weave into continuous story) or 'structured' (create sub_items list)"
    )

class StructureResult(BaseModel):
    items: List[StructuredItem]

class GovernanceAction(BaseModel):
    action_type: str = Field(description="rename_area, rename_product, move_product_to_area, move_task_to_product, reclassify_all, reorganize_topics")
    old_name: Optional[str] = None
    new_name: Optional[str] = None
    context: Optional[str] = Field(description="Target Area/Product name", default=None)
    target_area: Optional[str] = Field(description="Target Area name for cross-identity moves", default=None)
    task_id: Optional[uuid.UUID] = None
    topic_mapping: Optional[Dict[str, str]] = Field(description="For reorganize_topics: mapping from task_id to new topic name", default=None)

class GovernanceResult(BaseModel):
    actions: List[GovernanceAction]
    reasoning: str

# --- Reorganize Product Topics ---
class TopicCluster(BaseModel):
    """AI 建議的 Topic 群聚"""
    topic_name: str = Field(description="建議的 Topic 名稱")
    description: str = Field(description="這個 Topic 的語義描述")
    task_ids: List[str] = Field(description="屬於這個 Topic 的 Task IDs")
    confidence: float = Field(ge=0.0, le=1.0, description="AI 的信心度")

class TaskTimeInference(BaseModel):
    """Task 時間推斷結果"""
    task_id: str
    suggested_due_date: Optional[str] = Field(description="建議的截止日期 (ISO 8601)")
    inferred_from_milestone_id: Optional[str] = Field(description="從哪個 Milestone 推斷出來的")
    time_confidence: float = Field(ge=0.0, le=1.0, description="時間推斷的信心度")
    urgency_level: str = Field(description="緊急程度: critical, high, medium, low")
    reasoning: str = Field(description="時間推斷的理由")

class ReorganizeProposal(BaseModel):
    """Product Topics 重組提案"""
    product_id: str
    product_name: str
    current_topics: List[str] = Field(description="目前的 Topics")
    proposed_clusters: List[TopicCluster] = Field(description="AI 建議的新 Topic 分群")
    time_inferences: List[TaskTimeInference] = Field(description="所有 Tasks 的時間推斷")
    reasoning: str = Field(description="重組的理由與邏輯")


class LibrarianService:
    """知識治理服務 - 負責結構化、歸檔和重組用戶的知識庫。"""

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        self.api_key = api_key or "dummy_key"
        self.model_name = "gemini-2.5-flash-lite"

    def _get_model(self):
        """取得 LLM 模型實例"""
        adapter = GeminiAdapter(
            model_name=self.model_name,
            api_key=self.api_key
        )
        return adapter.get_model_instance()

    def _create_insight_agent(self):
        """創建 Insight Agent（Act 2: Gateway Stabilization）"""
        return Agent(
            self._get_model(),
            output_type=InsightOutput,
            system_prompt=build_insight_agent_prompt()
        )

    def _create_structure_agent(self, existing_manifest: str = "None"):
        """創建 Structure Agent（Act 3: Synthesis & Evolution）"""
        return Agent(
            self._get_model(),
            output_type=StructureResult,
            system_prompt=build_structure_agent_prompt(existing_manifest)
        )

    def _create_governance_agent(self, context: str):
        """創建 Governance Agent（Act 4: Structural Reorganization）"""
        return Agent(
            self._get_model(),
            output_type=GovernanceResult,
            retries=3,
            system_prompt=build_governance_agent_prompt(context)
        )


    async def generate_narrative_insight(self, text: str) -> Dict[str, Any]:
        """Act 2 Logic: Gateway Stabilization."""
        try:
            agent = self._create_insight_agent()
            result = await agent.run(f"USER INPUT:\n{text}")
            return result.output.model_dump()
        except Exception as e:
            print(f"LLM Error: {e}")
            return {
                "insight_text": "Librarian is adjusting the archives...",
                "anxiety_score": 0.5,
                "detected_contexts": ["Self"],
                "hidden_project_name": "General_Asset"
            }

    async def structure_chaos(self, text: str, user_id: uuid.UUID) -> List[StructuredItem]:
        """Act 3 Logic: Synthesis & Evolution with Context awareness."""
        try:
            # 1. Fetch Existing Context AND Area Boundaries
            existing_items = await self.get_full_library(user_id)
            context_summary = ""

            # 1.1 載入用戶的 Area 定義
            async with get_db_session() as session:
                result = await session.execute(
                    select(Area).where(Area.user_id == user_id)
                )
                user_areas = result.scalars().all()

            # 構建 Area 邊界摘要
            if user_areas:
                context_summary += "\n### 用戶的身分地圖 (User's Identity Map):\n"
                for area in user_areas:
                    context_summary += f"- **{area.name}**: {area.scope or '（尚未定義範圍）'}\n"
                context_summary += "\n"

            # 1.2 既有 Product 清單
            if existing_items:
                context_summary += "\n### 既有資產 (Existing Products):\n"
                lib_tree: Dict[str, Dict[str, List[str]]] = {}
                for item in existing_items:
                    area_name = item.tag.area
                    prod_name = item.tag.product
                    if area_name not in lib_tree:
                        lib_tree[area_name] = {}
                    if prod_name not in lib_tree[area_name]:
                        lib_tree[area_name][prod_name] = []
                    lib_tree[area_name][prod_name].append(item.title)

                for area_name, products in lib_tree.items():
                    context_summary += f"\n**Area: {area_name}**\n"
                    for prod, titles in products.items():
                        context_summary += f"  - Product: {prod} (包含: {', '.join(titles[:3])}...)\n"

            # 2. LLM Extraction with Intelligent Clustering & Gravity
            agent = self._create_structure_agent(existing_manifest=context_summary)
            result = await agent.run(
                f"請對以下輸入執行知識治理工作流 (Synthesis & Evolution)。\n"
                f"{context_summary}\n\n"
                f"**任務**：判定新輸入是否應被『既有 Product』吸附，還是需要建立新結構。\n"
                f"USER INPUT:\n{text}"
            )
            items: List[StructuredItem] = result.output.items

            if not items:
                return []

            # DB Persistence
            async with get_db_session() as session:
                for item in items:
                    # A. Area
                    area_name = item.tag.area
                    res = await session.execute(select(Area).where(Area.user_id == user_id).where(Area.name == area_name))
                    area = res.scalars().first()
                    if not area:
                        area = Area(user_id=user_id, name=area_name, is_custom=True)
                        session.add(area); await session.commit(); await session.refresh(area)
                        
                    # B. Product
                    prod_name = item.tag.product
                    res = await session.execute(select(Product).where(Product.user_id == user_id).where(Product.area_id == area.id).where(Product.name == prod_name))
                    product = res.scalars().first()
                    if not product:
                        product = Product(
                            user_id=user_id, 
                            area_id=area.id, 
                            name=prod_name, 
                            status=item.drawer, # Sync with initial interpretation
                            lifecycle=item.lifecycle
                        )
                        session.add(product); await session.commit(); await session.refresh(product)
                    else:
                        # Update product status/lifecycle if it evolves
                        product.status = item.drawer
                        product.lifecycle = item.lifecycle
                        session.add(product)
                        
                    # C. Topic ... [keep rest]
                    topic_name = item.tag.topic
                    res = await session.execute(select(Topic).where(Topic.user_id == user_id).where(Topic.product_id == product.id).where(Topic.name == topic_name))
                    topic = res.scalars().first()
                    if not topic:
                        topic = Topic(user_id=user_id, product_id=product.id, name=topic_name)
                        session.add(topic); await session.commit(); await session.refresh(topic)
                        
                    # D. Create Master Note / Task
                    ai_analysis_data = {
                        "narrative": item.narrative,
                        "reasoning": item.reasoning,
                        "strategy_used": item.strategy_used,
                        "merged_items": item.merged_items,
                        "drawer": item.drawer,
                        "lifecycle": item.lifecycle
                    }

                    # 新增: 處理 sub_items (Structured Aggregation)
                    if item.aggregation_mode == "structured" and item.sub_items:
                        from datetime import datetime
                        sub_items_list = []
                        for idx, sub in enumerate(item.sub_items):
                            sub_items_list.append({
                                "id": str(uuid.uuid4()),
                                "content": sub.get("content", ""),
                                "completed": False,
                                "created_at": datetime.utcnow().isoformat(),
                                "completed_at": None,
                                "order": idx
                            })

                        ai_analysis_data["sub_items"] = sub_items_list
                        ai_analysis_data["sub_items_meta"] = {
                            "total": len(sub_items_list),
                            "completed": 0,
                            "completion_rate": 0.0
                        }
                    else:
                        # 確保向後兼容
                        ai_analysis_data["sub_items"] = []
                        ai_analysis_data["sub_items_meta"] = {
                            "total": 0,
                            "completed": 0,
                            "completion_rate": 0.0
                        }

                    task = Task(
                        user_id=user_id,
                        product_id=product.id,
                        topic_id=topic.id,
                        content=item.title,
                        status=StatusEnum.ACTIVE,
                        ai_analysis=ai_analysis_data
                    )
                    session.add(task)
                
                await session.commit()

            return items

        except Exception as e:
            print(f"Governance Error: {e}")
            import traceback
            traceback.print_exc()
            return []

    async def get_full_library(self, user_id: uuid.UUID) -> List[StructuredItem]:
        """Fetch all stored tasks and reconstruct StructuredItem list for UI."""
        from sqlalchemy.orm import joinedload

        async with get_db_session() as session:
            # Query tasks with related product/area/topic
            stmt = select(Task).where(Task.user_id == user_id).options(
                joinedload(Task.product).joinedload(Product.area),
                joinedload(Task.topic)
            ).order_by(Task.created_at.desc())
            
            res = await session.execute(stmt)
            tasks = res.scalars().all()
            
            items = []
            for t in tasks:
                items.append(StructuredItem(
                    id=t.id,
                    title=t.content,
                    narrative=t.ai_analysis.get("narrative", ""),
                    drawer=StatusEnum(t.ai_analysis.get("drawer", t.status.value)),
                    lifecycle=LifecycleEnum(t.ai_analysis.get("lifecycle", t.product.lifecycle.value)),
                    tag=TagOutput(
                        area=t.product.area.name,
                        product=t.product.name,
                        topic=t.topic.name if t.topic else "General"
                    ),
                    strategy_used=t.ai_analysis.get("strategy_used", "Stored"),
                    reasoning=t.ai_analysis.get("reasoning", "Historical Data"),
                    merged_items=t.ai_analysis.get("merged_items", [])
                ))
            return items

    async def execute_governance_instruction(self, instruction: str, user_id: uuid.UUID) -> str:
        """Act 4: Process natural language structural overhaul."""
        # 1. Provide Context to AI
        current_library = await self.get_full_library(user_id)
        lib_data = [item.model_dump(mode='json') for item in current_library]
        lib_context = json.dumps(lib_data, indent=2, ensure_ascii=False)

        # 2. AI Analysis
        agent = self._create_governance_agent(context=lib_context)
        res = await agent.run(f"INSTRUCTION: {instruction}")
        actions = res.output.actions

        if not actions:
            return "AI 判定無須執行任何結構更動。"

        # 3. Execute Actions
        async with get_db_session() as session:
            for act in actions:
                if act.action_type == "rename_area":
                    # Find and update
                    s = select(Area).where(Area.user_id == user_id).where(Area.name == act.old_name)
                    area = (await session.execute(s)).scalars().first()
                    if area: area.name = act.new_name; session.add(area)
                
                elif act.action_type == "rename_product":
                    s = select(Product).where(Product.user_id == user_id).where(Product.name == act.old_name)
                    prod = (await session.execute(s)).scalars().first()
                    if prod: 
                        prod.name = act.new_name
                        # Update all related task narratives that might mention the old name
                        tasks_to_fix = (await session.execute(select(Task).where(Task.product_id == prod.id))).scalars().all()
                        for t in tasks_to_fix:
                            if "narrative" in t.ai_analysis:
                                t.ai_analysis["narrative"] = f"[修正為 {act.new_name}] " + t.ai_analysis["narrative"]
                        session.add(prod)
                
                elif act.action_type == "move_product_to_area":
                    # Complex move: Change Area mapping for a Product
                    s_p = select(Product).where(Product.user_id == user_id).where(Product.name == act.old_name)
                    prod = (await session.execute(s_p)).scalars().first()
                    
                    # Target area might not exist, create if needed
                    s_a = select(Area).where(Area.user_id == user_id).where(Area.name == act.context)
                    target_area = (await session.execute(s_a)).scalars().first()
                    if not target_area and act.context:
                        target_area = Area(user_id=user_id, name=act.context, is_custom=True)
                        session.add(target_area); await session.flush()
                        
                    if prod and target_area:
                        prod.area_id = target_area.id
                        session.add(prod)

                elif act.action_type == "move_task_to_product":
                    # Reassign a single task to a different Product (optionally in a different Area)
                    task_s = select(Task).where(Task.user_id == user_id)
                    if act.task_id:
                        task_s = task_s.where(Task.id == act.task_id)
                    elif act.old_name:
                        task_s = task_s.where(Task.content.contains(act.old_name))

                    task = (await session.execute(task_s)).scalars().first()
                    if not task:
                        continue

                    product_name = act.context or act.old_name or "General"

                    # Determine target Area
                    target_area_obj = None
                    if act.target_area:
                        s_ta = select(Area).where(Area.user_id == user_id).where(Area.name == act.target_area)
                        target_area_obj = (await session.execute(s_ta)).scalars().first()
                        if not target_area_obj:
                            target_area_obj = Area(user_id=user_id, name=act.target_area, is_custom=True)
                            session.add(target_area_obj); await session.flush()

                    # Find Product - if target_area specified, must be in that Area
                    if target_area_obj:
                        p_s = select(Product).where(
                            Product.user_id == user_id,
                            Product.name == product_name,
                            Product.area_id == target_area_obj.id
                        )
                    else:
                        p_s = select(Product).where(Product.user_id == user_id).where(Product.name == product_name)
                    target_prod = (await session.execute(p_s)).scalars().first()

                    # Create Product if not found
                    if not target_prod:
                        if not target_area_obj:
                            # Fallback to current Product's Area
                            p_parent = await session.get(Product, task.product_id)
                            area_id = p_parent.area_id if p_parent else None
                            if not area_id:
                                s_a2 = select(Area).where(Area.user_id == user_id).limit(1)
                                fallback = (await session.execute(s_a2)).scalars().first()
                                area_id = fallback.id if fallback else None
                        else:
                            area_id = target_area_obj.id

                        target_prod = Product(user_id=user_id, name=product_name, area_id=area_id)
                        session.add(target_prod); await session.flush()
                        
                        task.product_id = target_prod.id

                        # Update narrative to reflect the move
                        if "narrative" in task.ai_analysis:
                            task.ai_analysis["narrative"] = f"[{act.context}] " + task.ai_analysis["narrative"]
                        session.add(task)
                        await session.commit()  # CRITICAL: Commit changes before returning
                        return f"治理完成：已將任務移動至資產『{act.context}』(身分：{act.target_area or '繼承'})。"

                elif act.action_type == "reorganize_topics":
                    # 重組 Topic 結構（保留 Areas 和 Products）
                    all_tasks = (await session.execute(
                        select(Task).where(Task.user_id == user_id)
                    )).scalars().all()
                    if not all_tasks:
                        continue
                    full_backup_text = "\n".join([t.content for t in all_tasks])

                    # 清除 Topics 和 Tasks
                    await session.execute(delete(Task).where(Task.user_id == user_id))
                    await session.execute(delete(Topic).where(Topic.user_id == user_id))
                    await session.commit()

                    # 使用新的 L3 定義重新分類
                    await self.structure_chaos(full_backup_text, user_id)
                    return (
                        f"治理完成：我已根據新的『主題模組』定義重新整理了所有 Topic 標籤。"
                        f"共處理 {len(all_tasks)} 個事項。\n\n{res.output.reasoning}"
                    )

                elif act.action_type == "reclassify_all":
                    # 全局重新分類（清除所有結構）
                    all_tasks = (await session.execute(
                        select(Task).where(Task.user_id == user_id)
                    )).scalars().all()
                    if not all_tasks:
                        continue
                    full_backup_text = "\n".join([t.content for t in all_tasks])

                    # 按外鍵順序清除: Task → Topic → Product → Area
                    await session.execute(delete(Task).where(Task.user_id == user_id))
                    await session.execute(delete(Topic).where(Topic.user_id == user_id))
                    await session.execute(delete(Product).where(Product.user_id == user_id))
                    await session.execute(delete(Area).where(Area.user_id == user_id))
                    await session.commit()

                    # 重新分類
                    await self.structure_chaos(full_backup_text, user_id)
                    return (
                        f"治理完成：我已清理了所有舊標籤，並根據最新的『身分與資產』原則"
                        f"重新對 {len(all_tasks)} 個事項進行了全局編排。"
                    )
            
            await session.commit()

        return f"治理完成：{res.output.reasoning}"

    async def reorganize_product_topics(self, product_id: uuid.UUID, user_id: uuid.UUID) -> ReorganizeProposal:
        """
        AI 分析 Product 下的所有 Tasks 並建議新的 Topic 分群 + 時間推斷。

        考慮因素:
        1. Tasks 的語義相似度 (重新分群)
        2. Product 的 Milestones (時間錨點)
        3. 為每個 Task 推斷建議的 due_date
        """
        from sqlalchemy.orm import joinedload
        from datetime import datetime

        async with get_db_session() as session:
            # 1. 查詢 Product 資訊
            product_stmt = select(Product).where(Product.id == product_id).options(joinedload(Product.area))
            product_result = await session.execute(product_stmt)
            product = product_result.scalar_one_or_none()
            if not product:
                raise ValueError(f"Product {product_id} not found")

            # 2. 查詢該 Product 下的所有 Tasks
            stmt = select(Task).where(
                Task.user_id == user_id,
                Task.product_id == product_id
            ).options(joinedload(Task.topic))
            result = await session.execute(stmt)
            tasks = result.scalars().all()

            if not tasks:
                return ReorganizeProposal(
                    product_id=str(product_id),
                    product_name=product.name,
                    current_topics=[],
                    proposed_clusters=[],
                    time_inferences=[],
                    reasoning="該 Product 下沒有任何 Tasks，無需重組。"
                )

            # 3. 查詢相關的 Milestones (entity_type='product', entity_id=product_id)
            milestone_stmt = select(Milestone).where(
                Milestone.user_id == user_id,
                Milestone.entity_type == "product",
                Milestone.entity_id == product_id
            ).order_by(Milestone.target_date)
            milestone_result = await session.execute(milestone_stmt)
            milestones = milestone_result.scalars().all()

            # 4. 構建上下文資訊
            current_topics = list(set([t.topic.name for t in tasks if t.topic]))

            # 構建 Tasks 資訊 (給 AI)
            tasks_data = []
            for t in tasks:
                tasks_data.append({
                    "id": str(t.id),
                    "content": t.content,
                    "narrative": t.ai_analysis.get("narrative", ""),
                    "current_topic": t.topic.name if t.topic else "未分類",
                    "status": t.status.value,
                    "current_due_date": t.due_date.isoformat() if t.due_date else None,
                })

            # 構建 Milestones 資訊 (給 AI)
            milestones_data = []
            for m in milestones:
                milestones_data.append({
                    "id": str(m.id),
                    "name": m.name,
                    "target_date": m.target_date.isoformat(),
                    "status": m.status,
                    "priority": m.priority,
                    "description": m.description or ""
                })

            # 5. 呼叫 AI Agent 進行分析
            context = {
                "product_name": product.name,
                "area_name": product.area.name,
                "current_topics": current_topics,
                "tasks": tasks_data,
                "milestones": milestones_data,
                "today": datetime.utcnow().isoformat()
            }

            agent = Agent(
                self._get_model(),
                output_type=ReorganizeProposal,
                system_prompt=self._build_reorganize_prompt(context)
            )

            result = await agent.run(
                f"請分析 Product '{product.name}' 下的所有 Tasks，並提供：\n"
                f"1. 新的 Topic 分群建議 (語義聚類)\n"
                f"2. 每個 Task 的時間推斷 (due_date, urgency)\n"
                f"請考慮以下 Milestones 作為時間錨點:\n{json.dumps(milestones_data, indent=2, ensure_ascii=False)}"
            )

            proposal = result.output
            proposal.product_id = str(product_id)
            proposal.product_name = product.name
            proposal.current_topics = current_topics

            return proposal

    def _build_reorganize_prompt(self, context: Dict[str, Any]) -> str:
        """構建 Product Topics 重組的 AI prompt"""
        return f"""你是 Naruvia Librarian - Product Topics 重組與時間推斷專家。

### 任務目標:
分析 Product 下的所有 Tasks，提供兩個關鍵輸出：
1. **Topic 重組**: 將 Tasks 重新分群成語義連貫的 Topic clusters
2. **時間推斷**: 為每個 Task 推斷建議的 due_date 和 urgency_level

### 上下文資訊:
- **Product**: {context['product_name']} (Area: {context['area_name']})
- **當前 Topics**: {', '.join(context['current_topics']) if context['current_topics'] else '無'}
- **Tasks 總數**: {len(context['tasks'])}
- **Milestones 總數**: {len(context['milestones'])}
- **今天日期**: {context['today']}

### Topic 重組原則 (遵循 L3 語義子集原則):
1. **語義聚類**: 將相似主題的 Tasks 群聚在一起
2. **功能模組化**: Topic 應該是 Product 的「功能模組」或「子專案」,不是活動類型
3. **正確範例**:
   - Product: Naruvia → Topics: Onboarding Flow, AI Librarian, Time Inference
   - Product: 日本公司設立 → Topics: Legal Documentation, Banking Setup, Office Rental
4. **錯誤範例**: Dev, QA, Admin (這些是活動類型,應避免)
5. **規模適中**: 每個 Topic 應包含 2-8 個 Tasks (太少則過度細分,太多則難以聚焦)
6. **信心度**: 對每個分群給出 0.0-1.0 的信心度

### 時間推斷原則:
1. **Milestone 錨定**:
   - 如果 Milestone 有明確的 target_date,將相關 Tasks 對齊到該日期之前
   - 根據 Milestone 的 priority 調整 urgency_level
2. **倒推邏輯**: 從 Milestone 的 target_date 往回推算,考慮 Task 的複雜度
3. **緊急程度判斷**:
   - **critical**: 逾期或今天到期
   - **high**: 3 天內到期,或與 high-priority Milestone 相關
   - **medium**: 1-2 週內到期
   - **low**: 2 週以上或無明確期限
4. **信心度**:
   - 有明確 Milestone 關聯: 0.8-1.0
   - 根據 narrative 推斷: 0.5-0.7
   - 完全推測: 0.3-0.5

### 輸出要求:
- `proposed_clusters`: 新的 Topic 分群,每個包含:
  - `topic_name`: 新的 Topic 名稱 (遵循語義子集原則)
  - `description`: 該 Topic 的描述
  - `task_ids`: 屬於該 Topic 的 Task IDs
  - `confidence`: 分群的信心度
- `time_inferences`: 每個 Task 的時間推斷,包含:
  - `task_id`: Task ID
  - `suggested_due_date`: 建議的截止日期 (ISO 8601 格式)
  - `inferred_from_milestone_id`: 從哪個 Milestone 推斷 (如果有)
  - `time_confidence`: 時間推斷的信心度
  - `urgency_level`: critical/high/medium/low
  - `reasoning`: 推斷理由
- `reasoning`: 整體重組的理由與邏輯

### 重要提醒:
- 所有 task_id 必須來自輸入的 Tasks 列表
- 每個 Task 必須被分配到恰好一個 Topic cluster
- 如果 Milestones 為空,仍需根據 Task 的 narrative 推斷時間
- 優先保持現有結構的穩定性,只在有明確改善時才重組
"""
