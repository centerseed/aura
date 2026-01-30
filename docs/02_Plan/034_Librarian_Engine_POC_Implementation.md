# 實作計畫：Librarian Engine POC
> **驗證神經符號記憶蒸餾架構的可行性**

**狀態**: 草案 (Draft)
**版本**: 1.0
**日期**: 2026-01-30
**預計時程**: 1 週

---

## 1. 目標 (Objectives)

### 1.1 技術驗證目標
1. **記憶蒸餾有效**: 系統能從用戶修正行為中萃取出明確規則
2. **準確度提升**: 應用蒸餾規則後，分類準確度從 ~60% 提升到 >90%
3. **延遲可接受**: RAG 檢索額外開銷 < 500ms
4. **架構可行**: Python + PostgreSQL + pgvector 的技術堆疊穩定運作

### 1.2 商業驗證目標
- 證明「越用越聰明」的核心價值主張
- 驗證個人化記憶能區分不同用戶的使用習慣

---

## 2. 專案結構

```
naruvia/
├── apps/
│   ├── web/                          # 現有 Next.js (不動)
│   │
│   └── librarian/                    # 🆕 Python Librarian Engine
│       ├── pyproject.toml            # Poetry 專案設定
│       ├── .env.example
│       ├── README.md
│       │
│       ├── src/
│       │   └── librarian/
│       │       ├── __init__.py
│       │       │
│       │       ├── domain/           # 領域層
│       │       │   ├── __init__.py
│       │       │   ├── entities/
│       │       │   │   ├── memory.py         # Memory, MemoryType
│       │       │   │   ├── correction.py     # CorrectionLog
│       │       │   │   └── rule.py           # GovernanceRule
│       │       │   └── interfaces/
│       │       │       ├── memory_repository.py
│       │       │       └── llm_gateway.py
│       │       │
│       │       ├── application/      # 應用層
│       │       │   ├── __init__.py
│       │       │   ├── use_cases/
│       │       │   │   ├── observe.py        # 記錄觀察事件
│       │       │   │   ├── recall.py         # RAG 檢索記憶
│       │       │   │   ├── distill.py        # System 2 蒸餾
│       │       │   │   └── classify.py       # 增強分類
│       │       │   └── services/
│       │       │       ├── embedding_service.py
│       │       │       └── clustering_service.py
│       │       │
│       │       ├── infrastructure/   # 基礎設施層
│       │       │   ├── __init__.py
│       │       │   ├── persistence/
│       │       │   │   ├── postgres_memory_repo.py
│       │       │   │   └── database.py       # SQLAlchemy 連線
│       │       │   └── llm/
│       │       │       ├── gemini_gateway.py
│       │       │       └── prompts/
│       │       │           ├── distillation.py
│       │       │           └── classification.py
│       │       │
│       │       └── interface/        # 介面層
│       │           ├── __init__.py
│       │           └── api/
│       │               ├── main.py           # FastAPI app
│       │               └── routes/
│       │                   ├── memory.py
│       │                   └── health.py
│       │
│       ├── poc/                      # 🎯 POC 驗證腳本
│       │   ├── __init__.py
│       │   ├── config.py             # POC 設定
│       │   ├── personas.py           # Persona 定義
│       │   │
│       │   ├── step1_generate_corrections.py   # 生成模擬修正
│       │   ├── step2_distill_rules.py          # 執行蒸餾
│       │   ├── step3_evaluate_accuracy.py      # 評估準確度
│       │   │
│       │   ├── run_full_poc.py       # 一鍵執行完整 POC
│       │   └── report_generator.py   # 產出報告
│       │
│       └── tests/
│           ├── unit/
│           │   ├── test_embedding_service.py
│           │   ├── test_clustering_service.py
│           │   └── test_distill_use_case.py
│           └── integration/
│               ├── test_memory_repository.py
│               └── test_gemini_gateway.py
```

---

## 3. 資料庫 Schema

### 3.1 新增資料表 (Prisma Schema 擴展)

```prisma
// 加入現有的 prisma/schema.prisma

// ============================================
// Librarian Engine - Memory System
// ============================================

model Memory {
  id              String    @id @default(uuid())
  userId          String    @map("user_id")

  // 內容
  content         String    @db.Text
  embedding       Unsupported("vector(768)")?  // pgvector

  // 類型
  memoryType      MemoryType @map("memory_type")

  // 來源追溯
  sourceType      String?   @map("source_type")  // 'correction', 'observation', 'manual'
  sourceId        String?   @map("source_id")    // 關聯的 correction_log id

  // 權重與時間
  confidenceScore Float     @default(0.5) @map("confidence_score")
  importanceScore Float     @default(0.5) @map("importance_score")
  accessCount     Int       @default(0)   @map("access_count")

  createdAt       DateTime  @default(now()) @map("created_at")
  lastAccessedAt  DateTime  @default(now()) @map("last_accessed_at")

  // 關聯
  user            User      @relation(fields: [userId], references: [id])

  @@map("memories")
  @@index([userId, memoryType])
}

enum MemoryType {
  EPISODIC    // 原始事件 (Raw Log)
  SEMANTIC    // 蒸餾規則 (Distilled Rule)
  PROCEDURAL  // 流程知識 (How-to)
}

model CorrectionLog {
  id              String    @id @default(uuid())
  userId          String    @map("user_id")

  // 原始輸入
  originalInput   String    @map("original_input") @db.Text

  // AI 預測 vs 用戶修正
  aiPrediction    Json      @map("ai_prediction")   // { category, priority, etc. }
  userCorrection  Json      @map("user_correction") // { category, priority, etc. }

  // 修正欄位 (方便查詢)
  correctedField  String    @map("corrected_field") // 'category', 'priority', 'product'

  // 用戶反饋
  feedbackText    String?   @map("feedback_text") @db.Text

  // 處理狀態
  processed       Boolean   @default(false)
  processedAt     DateTime? @map("processed_at")

  createdAt       DateTime  @default(now()) @map("created_at")

  // 關聯
  user            User      @relation(fields: [userId], references: [id])

  @@map("correction_logs")
  @@index([userId, processed])
  @@index([correctedField])
}
```

### 3.2 啟用 pgvector

```sql
-- Migration: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 為 memories 表創建向量索引
CREATE INDEX ON memories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

---

## 4. POC 驗證流程

### 4.1 實驗設計

```
┌─────────────────────────────────────────────────────────────────┐
│                    POC 三階段實驗                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: Baseline (Day 1)                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 輸入 20 個測試任務 → Zero-Shot 分類 → 記錄準確度 (~60%)    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  Phase 2: Training (Day 2)                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 輸入 30 筆修正 → 計算 Embedding → 分群 → LLM 蒸餾規則       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  Phase 3: Evaluation (Day 3)                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 輸入 20 個新任務 → RAG 增強分類 → 記錄準確度 (>90%)         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Persona 定義

```python
# poc/personas.py

PERSONAS = {
    "entrepreneur": {
        "name": "Alex (創業者)",
        "description": "SaaS 創業者，所有科技產品都是公司資產",
        "classification_rules": {
            "硬體購買 (GPU, 螢幕, 電腦)": "公司資產",
            "SaaS 訂閱 (AWS, Vercel, Notion)": "營運成本",
            "學習課程": "人才投資",
            "娛樂 (Netflix, 遊戲)": "個人支出",
        },
        "priority_rules": {
            "客戶相關": "High",
            "內部優化": "Medium",
            "個人事項": "Low",
        }
    },
    "gamer": {
        "name": "Bob (電玩愛好者)",
        "description": "軟體工程師，下班後是重度玩家",
        "classification_rules": {
            "硬體購買 (GPU, 螢幕, 電腦)": "個人娛樂",
            "SaaS 訂閱 (AWS, Vercel)": "工作工具",
            "遊戲訂閱 (Steam, PS Plus)": "個人娛樂",
            "學習課程": "職涯發展",
        },
        "priority_rules": {
            "工作 Deadline": "High",
            "遊戲發售日": "High",  # 與 Alex 不同！
            "日常雜務": "Low",
        }
    }
}
```

### 4.3 測試資料集

```python
# poc/test_datasets.py

# Phase 1 & 3 使用的測試任務
TEST_TASKS = [
    # 硬體類
    {"input": "買 RTX 5090 顯卡", "ambiguous": True},
    {"input": "訂購 32 吋 4K 螢幕", "ambiguous": True},
    {"input": "升級 MacBook Pro M4", "ambiguous": True},

    # SaaS 類
    {"input": "續訂 AWS 年費", "ambiguous": True},
    {"input": "購買 Notion Team Plan", "ambiguous": True},
    {"input": "升級 Vercel Pro", "ambiguous": True},

    # 娛樂類
    {"input": "續訂 Netflix", "ambiguous": False},  # 明確個人
    {"input": "買 Steam 遊戲", "ambiguous": True},
    {"input": "PS5 Pro 預購", "ambiguous": True},

    # 學習類
    {"input": "報名 AI 課程", "ambiguous": True},
    {"input": "買 O'Reilly 訂閱", "ambiguous": True},

    # 會議類
    {"input": "約 John 喝咖啡", "ambiguous": True},
    {"input": "客戶 Demo 會議", "ambiguous": False},  # 明確工作

    # ... 更多測試案例
]

# Phase 2 使用的修正資料
def generate_corrections_for_persona(persona_id: str, count: int = 30):
    """根據 Persona 生成模擬的修正資料"""
    pass
```

---

## 5. 核心實作

### 5.1 Embedding Service

```python
# src/librarian/application/services/embedding_service.py

from google import genai
from typing import List
import numpy as np

class EmbeddingService:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
        self.model = "text-embedding-004"

    async def embed(self, text: str) -> List[float]:
        """生成單一文本的向量"""
        response = await self.client.models.embed_content_async(
            model=self.model,
            content=text
        )
        return response.embedding

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """批次生成向量"""
        embeddings = []
        for text in texts:
            emb = await self.embed(text)
            embeddings.append(emb)
        return embeddings

    def cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """計算餘弦相似度"""
        a_np = np.array(a)
        b_np = np.array(b)
        return np.dot(a_np, b_np) / (np.linalg.norm(a_np) * np.linalg.norm(b_np))
```

### 5.2 Clustering Service

```python
# src/librarian/application/services/clustering_service.py

from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_distances
import numpy as np
from typing import List, Dict, Any

class ClusteringService:
    def __init__(self, eps: float = 0.3, min_samples: int = 2):
        """
        eps: 最大距離閾值 (1 - cosine_similarity)
        min_samples: 形成群集的最小樣本數
        """
        self.eps = eps
        self.min_samples = min_samples

    def cluster_corrections(
        self,
        corrections: List[Dict[str, Any]],
        embeddings: List[List[float]]
    ) -> Dict[int, List[Dict[str, Any]]]:
        """
        將相似的修正分群

        Returns:
            {cluster_id: [correction1, correction2, ...]}
        """
        X = np.array(embeddings)

        # 使用餘弦距離進行 DBSCAN
        clustering = DBSCAN(
            eps=self.eps,
            min_samples=self.min_samples,
            metric='cosine'
        ).fit(X)

        # 整理結果
        clusters = {}
        for idx, label in enumerate(clustering.labels_):
            if label == -1:  # 噪音點
                continue
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(corrections[idx])

        return clusters
```

### 5.3 Distillation Use Case (System 2)

```python
# src/librarian/application/use_cases/distill.py

from typing import List, Dict, Any
from ..services.embedding_service import EmbeddingService
from ..services.clustering_service import ClusteringService
from ...infrastructure.llm.gemini_gateway import GeminiGateway
from ...domain.entities.rule import GovernanceRule

class DistillRulesUseCase:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        clustering_service: ClusteringService,
        llm_gateway: GeminiGateway
    ):
        self.embedding = embedding_service
        self.clustering = clustering_service
        self.llm = llm_gateway

    async def execute(self, user_id: str, corrections: List[Dict]) -> List[GovernanceRule]:
        """
        從修正紀錄中蒸餾出治理規則

        1. 計算每個修正的 embedding
        2. 使用 DBSCAN 分群
        3. 對每個群集使用 LLM 歸納規則
        """
        if not corrections:
            return []

        # Step 1: 計算 embeddings
        texts = [self._format_correction(c) for c in corrections]
        embeddings = await self.embedding.embed_batch(texts)

        # Step 2: 分群
        clusters = self.clustering.cluster_corrections(corrections, embeddings)

        # Step 3: 對每個群集歸納規則
        rules = []
        for cluster_id, cluster_corrections in clusters.items():
            rule = await self._distill_cluster(user_id, cluster_corrections)
            if rule:
                rules.append(rule)

        return rules

    def _format_correction(self, correction: Dict) -> str:
        """格式化修正為可嵌入的文本"""
        return f"""
        原始輸入: {correction['original_input']}
        AI 預測: {correction['ai_prediction']}
        用戶修正: {correction['user_correction']}
        修正欄位: {correction['corrected_field']}
        """.strip()

    async def _distill_cluster(
        self,
        user_id: str,
        corrections: List[Dict]
    ) -> GovernanceRule | None:
        """使用 LLM 從一個群集中歸納規則"""

        prompt = self._build_distillation_prompt(corrections)

        response = await self.llm.generate(
            prompt=prompt,
            system_prompt=DISTILLATION_SYSTEM_PROMPT,
            temperature=0.3  # 低溫度確保穩定輸出
        )

        # 解析 LLM 輸出為規則
        return self._parse_rule(user_id, response, corrections)


DISTILLATION_SYSTEM_PROMPT = """
你是一個規則歸納專家。根據用戶的修正歷史，歸納出一條明確的分類規則。

規則必須：
1. 具體且可執行（避免模糊描述）
2. 使用 IF-THEN 格式
3. 包含觸發條件和預期結果

輸出格式 (JSON):
{
    "rule_description": "當任務包含 'GPU' 或 '顯卡' 且用戶是創業者時，分類為「公司資產」",
    "trigger_conditions": ["contains:GPU", "contains:顯卡"],
    "result_action": {"field": "category", "value": "公司資產"},
    "confidence": 0.85,
    "reasoning": "基於 5 次相似的修正..."
}
"""
```

### 5.4 RAG Recall Use Case (System 1)

```python
# src/librarian/application/use_cases/recall.py

from typing import List
from ...domain.entities.memory import Memory, MemoryType

class RecallMemoriesUseCase:
    def __init__(self, memory_repository, embedding_service):
        self.repo = memory_repository
        self.embedding = embedding_service

    async def execute(
        self,
        user_id: str,
        query: str,
        top_k: int = 5,
        memory_types: List[MemoryType] = None
    ) -> List[Memory]:
        """
        根據查詢檢索相關記憶

        1. 將查詢轉為向量
        2. 在 memories 表中搜尋最相似的記憶
        3. 更新 access_count 和 last_accessed_at
        """
        # 預設只檢索語意規則
        if memory_types is None:
            memory_types = [MemoryType.SEMANTIC]

        # Step 1: 計算查詢向量
        query_embedding = await self.embedding.embed(query)

        # Step 2: 向量搜尋
        memories = await self.repo.search_by_vector(
            user_id=user_id,
            embedding=query_embedding,
            top_k=top_k,
            memory_types=memory_types
        )

        # Step 3: 更新存取紀錄
        for memory in memories:
            await self.repo.increment_access(memory.id)

        return memories
```

### 5.5 PostgreSQL Memory Repository

```python
# src/librarian/infrastructure/persistence/postgres_memory_repo.py

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from ...domain.entities.memory import Memory, MemoryType

class PostgresMemoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def search_by_vector(
        self,
        user_id: str,
        embedding: List[float],
        top_k: int = 5,
        memory_types: List[MemoryType] = None
    ) -> List[Memory]:
        """使用 pgvector 進行向量相似度搜尋"""

        type_filter = ""
        if memory_types:
            types_str = ",".join([f"'{t.value}'" for t in memory_types])
            type_filter = f"AND memory_type IN ({types_str})"

        query = text(f"""
            SELECT
                id, content, memory_type, confidence_score,
                1 - (embedding <=> :embedding) as similarity
            FROM memories
            WHERE user_id = :user_id
              AND embedding IS NOT NULL
              {type_filter}
            ORDER BY embedding <=> :embedding
            LIMIT :top_k
        """)

        result = await self.session.execute(
            query,
            {
                "user_id": user_id,
                "embedding": str(embedding),  # pgvector 格式
                "top_k": top_k
            }
        )

        rows = result.fetchall()
        return [self._row_to_memory(row) for row in rows]

    async def save_rule(self, memory: Memory) -> Memory:
        """儲存蒸餾出的規則"""
        query = text("""
            INSERT INTO memories (
                id, user_id, content, embedding,
                memory_type, confidence_score, source_type, source_id
            ) VALUES (
                :id, :user_id, :content, :embedding,
                :memory_type, :confidence_score, :source_type, :source_id
            )
            RETURNING *
        """)

        result = await self.session.execute(query, memory.to_dict())
        await self.session.commit()
        return self._row_to_memory(result.fetchone())
```

---

## 6. POC 執行腳本

### 6.1 完整 POC Runner

```python
# poc/run_full_poc.py

import asyncio
from datetime import datetime
from .config import POCConfig
from .personas import PERSONAS
from .step1_generate_corrections import generate_corrections
from .step2_distill_rules import distill_all_rules
from .step3_evaluate_accuracy import evaluate_accuracy
from .report_generator import generate_report

async def run_poc():
    """執行完整的 POC 驗證流程"""

    config = POCConfig()
    results = {
        "run_id": datetime.now().isoformat(),
        "personas": {},
    }

    for persona_id, persona in PERSONAS.items():
        print(f"\n{'='*60}")
        print(f"Testing Persona: {persona['name']}")
        print(f"{'='*60}")

        persona_results = {}

        # Phase 1: Baseline (Zero-Shot)
        print("\n📊 Phase 1: Baseline Evaluation...")
        baseline = await evaluate_accuracy(
            persona_id=persona_id,
            use_rag=False
        )
        persona_results["baseline"] = baseline
        print(f"   Accuracy: {baseline['accuracy']:.1%}")

        # Phase 2: Generate Corrections & Distill
        print("\n🔄 Phase 2: Training (Corrections + Distillation)...")
        corrections = await generate_corrections(
            persona_id=persona_id,
            count=30
        )
        print(f"   Generated {len(corrections)} corrections")

        rules = await distill_all_rules(
            persona_id=persona_id,
            corrections=corrections
        )
        print(f"   Distilled {len(rules)} rules")
        persona_results["rules"] = [r.to_dict() for r in rules]

        # Phase 3: Enhanced Evaluation
        print("\n🚀 Phase 3: Enhanced Evaluation (with RAG)...")
        enhanced = await evaluate_accuracy(
            persona_id=persona_id,
            use_rag=True
        )
        persona_results["enhanced"] = enhanced
        print(f"   Accuracy: {enhanced['accuracy']:.1%}")

        # 計算改進幅度
        improvement = enhanced['accuracy'] - baseline['accuracy']
        persona_results["improvement"] = improvement
        print(f"   Improvement: +{improvement:.1%}")

        results["personas"][persona_id] = persona_results

    # 生成報告
    report = generate_report(results)
    print(f"\n📄 Report saved to: {report['path']}")

    return results


if __name__ == "__main__":
    asyncio.run(run_poc())
```

### 6.2 報告生成器

```python
# poc/report_generator.py

from datetime import datetime
from typing import Dict, Any

def generate_report(results: Dict[str, Any]) -> Dict[str, str]:
    """生成 Markdown 格式的 POC 報告"""

    report_lines = [
        "# Librarian Engine POC 驗證報告",
        f"> 執行時間: {results['run_id']}",
        "",
        "## 執行摘要",
        "",
        "| Persona | Baseline | Enhanced | Improvement |",
        "|---------|----------|----------|-------------|",
    ]

    for persona_id, data in results["personas"].items():
        baseline = data["baseline"]["accuracy"]
        enhanced = data["enhanced"]["accuracy"]
        improvement = data["improvement"]

        report_lines.append(
            f"| {persona_id} | {baseline:.1%} | {enhanced:.1%} | +{improvement:.1%} |"
        )

    report_lines.extend([
        "",
        "## 蒸餾規則",
        "",
    ])

    for persona_id, data in results["personas"].items():
        report_lines.append(f"### {persona_id}")
        report_lines.append("")
        for i, rule in enumerate(data["rules"], 1):
            report_lines.append(f"{i}. **{rule['rule_description']}**")
            report_lines.append(f"   - 信心度: {rule['confidence']:.0%}")
            report_lines.append(f"   - 推理: {rule['reasoning']}")
            report_lines.append("")

    # ... 更多報告內容

    content = "\n".join(report_lines)

    # 儲存報告
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = f"poc/reports/poc_report_{timestamp}.md"

    with open(path, "w") as f:
        f.write(content)

    return {"path": path, "content": content}
```

---

## 7. 執行計畫

### 7.1 時程表

| Day | 任務 | 輸出 |
|-----|------|------|
| **Day 1** | 環境設定 + Schema | 可運行的 Python 專案 + DB Migration |
| **Day 2** | Embedding + Clustering 服務 | 通過單元測試 |
| **Day 3** | Distillation Use Case | 可蒸餾規則 |
| **Day 4** | RAG Recall + Repository | 可向量搜尋 |
| **Day 5** | POC 腳本整合 | 完整 POC 流程 |
| **Day 6** | 執行實驗 + 調參 | POC 報告 |
| **Day 7** | 文檔 + 決策 | 結論與下一步 |

### 7.2 成功標準

| 指標 | 目標 | 說明 |
|------|------|------|
| **Baseline 準確度** | 50-70% | 證明 Zero-Shot 不夠個人化 |
| **Enhanced 準確度** | >90% | 證明記憶蒸餾有效 |
| **規則有效性** | 100% | 人工檢視規則合理性 |
| **RAG 延遲** | <500ms | 可接受的即時性 |
| **蒸餾成本** | <$0.10/次 | 經濟可行性 |

---

## 8. 技術依賴

```toml
# pyproject.toml

[tool.poetry.dependencies]
python = "^3.11"

# Web Framework
fastapi = "^0.115.0"
uvicorn = "^0.34.0"
pydantic = "^2.10.0"

# Database
sqlalchemy = {extras = ["asyncio"], version = "^2.0.0"}
asyncpg = "^0.30.0"         # PostgreSQL async driver
pgvector = "^0.3.0"         # pgvector Python binding

# AI/ML
google-genai = "^1.0.0"     # Gemini SDK
scikit-learn = "^1.6.0"     # Clustering
numpy = "^2.0.0"

# Testing
pytest = "^8.0.0"
pytest-asyncio = "^0.25.0"

[tool.poetry.group.dev.dependencies]
black = "^24.0.0"
ruff = "^0.9.0"
```

---

## 9. 風險與緩解

| 風險 | 可能性 | 緩解措施 |
|------|--------|----------|
| pgvector 效能不足 | 低 | 使用 HNSW 索引、限制向量維度 |
| 蒸餾規則品質不穩定 | 中 | 調整 prompt、增加 few-shot 範例 |
| 分群結果太碎片 | 中 | 調整 DBSCAN eps 參數 |
| LLM 成本超支 | 低 | 使用 Gemini Flash、批次處理 |

---

## 10. 下一步

POC 成功後：
1. 將 Librarian Engine 整合進主系統
2. 建立 MCP Server 介面
3. 實作前端的「修正捕捉」邏輯
4. 部署到 Cloud Run

