import os
import asyncio
import sys
import json
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from pydantic_ai import Agent

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.infrastructure.llm.gemini_adapter import GeminiAdapter
load_dotenv()

# --- 第一性原理：記憶壓縮 Prompt ---
MEMORY_PRINCIPLES = """
1. 實體錨定 (Entity Anchoring):
   - 摘要中嚴禁使用模糊代詞 (如 "它", "該系統", "某資料庫")。
   - 必須保留具體專有名詞 (如 "Gemini 1.5 Pro", "PostgreSQL", "Redis")。

2. 決策因果鏈 (Causal Chain of Decisions):
   - 記憶的核心價值在於 "Why"。
   - 格式必須是：[情境] -> [遇到的問題] -> [採取的決策] -> [預期結果]。
   - 例如：因為 "用戶量大增 (Context)" 導致 "DB Latency 高 (Problem)"，所以決定 "引入 Redis Cache (Decision)"。

3. 狀態演進 (State Evolution):
   - 必須識別 "新決策" 是否 "推翻" 或 "優化" 了 "舊決策"。
   - 如：若新輸入說 "改用 Async Queue"，則舊摘要中的 "使用 Retry 機制" 應被標記為 [已廢棄] 或直接替換，不可並存導致矛盾。
"""

# --- 模擬數據：5 個週期的已聚合 Narrative ---
# 這些是已經經過 Librarian 整理過的區塊敘事，不是原始碎料
BATCHES = [
    ("Week 1", [
        "基礎架構決策：採用 Gemini 1.5 Pro，主要考量其 1M Context Window 能支援長文本分析。",
        "資料庫選型：使用 Firebase Firestore 以快速建立 MVP 原型。"
    ]),
    ("Week 2", [
        "開發進度：Adapter 層已實作完畢，但在高併發測試時發現 Gemini API 頻繁 Timeout。",
        "臨時對策：在 Client 端實作了指數退避 (Exponential Backoff) 的 Retry 機制來應對 Timeout。"
    ]),
    ("Week 3", [
        "用戶反饋：Retry 機制導致前端等待時間過長 (超過 30s)，用戶體驗不佳。",
        "架構重構：決定移除 Client Retry，改在後端引入 Redis 做 Task Queue (非同步處理)。",
        "新功能：新增了『每日回顧』功能，會自動生成報告。"
    ]),
    ("Week 4", [
        "資料庫遷移評估：Firestore 在複雜關聯查詢上效能受限，團隊開始討論是否遷移到 PostgreSQL。",
        "每日回顧功能上線，但發現生成報告的 Token 消耗太高，成本超出預算。"
    ]),
    ("Week 5", [
        "架構定案：確認遷移至 PostgreSQL + pgvector，以支援向量搜尋與複雜關聯。",
        "成本優化：將每日回顧的生成模型降級為 Gemini Flash，成本降低 90%。",
        "棄用 Redis：直接使用 Postgres 當 Queue，減少維運元件。"
    ])
]

# --- 輸出結構 ---
class MemoryState(BaseModel):
    architectural_decisions: str = Field(description="目前的架構狀態與關鍵技術選型 (含廢棄紀錄)")
    current_challenges: str = Field(description="目前面臨的並尚未解決的核心問題")
    project_narrative: str = Field(description="專案演進的連貫敘事 (Chain of Thought)")

async def run_memory_compression_poc():
    api_key = os.getenv("GEMINI_API_KEY")
    adapter = GeminiAdapter(model_name="gemini-2.0-flash-exp", api_key=api_key)
    
    # 初始記憶
    current_memory = MemoryState(
        architectural_decisions="尚未開始",
        current_challenges="無",
        project_narrative="專案啟動。"
    )

    compressor = Agent(
        adapter.get_model_instance(),
        output_type=MemoryState,
        system_prompt=(
            f"你是 Naruvia 的首席架構師。請執行『增量式狀態更新 (Incremental State Update)』。\n"
            f"核心原則：\n"
            f"{MEMORY_PRINCIPLES}\n"
            "執行步驟：\n"
            "1. **差異分析 (Diff Analysis)**: 比對『舊記憶』與『新進展』，識別出狀態變更 (State Changes)。\n"
            "2. **實體錨定 (Entity Anchoring)**: 確保所有關鍵技術名詞 (如 PostgreSQL, Redis, Gemini) 都被準確保留，不可使用模糊代詞。\n"
            "3. **變更標記 (Change Tagging)**: 在 [架構決策] 中使用明確的標記：\n"
            "   - [NEW]: 新增的決策。\n"
            "   - [UPDATE]: 修正的決策 (需註明原因)。\n"
            "   - [DEPRECATE]: 廢棄的決策 (需註明替代方案)。\n"
            "4. **敘事演進**: 在 [演進敘事] 中，將這些變更串聯成有因果關係的故事 (Story of Why)。"
        )
    )

    print("=== 啟動深度記憶壓縮模擬 (5 Weeks) ===\n")

    for week, new_narratives in BATCHES:
        print(f"\n>>> {week} 進展: {new_narratives}")
        
        result = await compressor.run(
            f"舊記憶狀態：{current_memory.model_dump_json(indent=2)}\n"
            f"本週新進展：{json.dumps(new_narratives, ensure_ascii=False)}"
        )
        
        current_memory = result.output
        print(f"--- {week} 結算記憶 ---")
        print(f"🏗️ [架構決策]\n{current_memory.architectural_decisions}")
        print(f"⚠️ [當前挑戰]\n{current_memory.current_challenges}")
        print(f"📜 [演進敘事]\n{current_memory.project_narrative}")
        print("-" * 60)

    print("\n=== 最終一致性驗收 ===")
    
    # 驗證 Retry 是否被移除
    if "Retry" in current_memory.architectural_decisions and "Redis" not in current_memory.architectural_decisions and "PostgreSQL" in current_memory.architectural_decisions:
         print("⚠️ 警告: 記憶混亂。Redis 應被 Postgres 取代。")
    
    print("邏輯檢查完畢。請確認上述 Week 5 的架構是否為：Gemini 1.5 Pro/Flash + PostgreSQL (Queue & Vector)，且無 Redis/Firestore。")

if __name__ == "__main__":
    asyncio.run(run_memory_compression_poc())
