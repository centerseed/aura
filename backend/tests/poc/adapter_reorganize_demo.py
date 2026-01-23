import os
import asyncio
import sys
import json
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List, Optional
from pydantic_ai import Agent

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.infrastructure.llm.gemini_adapter import GeminiAdapter
load_dotenv()

# --- 核心：第一性原理治理 Prompt ---
SCIENTIFIC_PRINCIPLES = """
1. 熵衰減 (Entropy Reduction):
   - 對於成熟專案 (Product)，必須強制執行 EM-INF (最小熵) 策略。
   - 碎料應被既有強向量 (Master Note) 吞噬，除非語義損失 > 20%。

2. 動能狀態 (Kinetic Status):
   - 狀態 (Drawer) 反映的是『做功速率』。
   - 只要項目仍在產出 (Active)，修復或微調都是動能的一部分，禁止降級為 Maintain。

3. 高熵保留 (High Entropy Preservation):
   - 對於生活/探索類 (Life/Discovery)，允許較高的標籤熵值。
   - 但運用『弱聚合』原則：同類型的生活瑣事 (如多筆寵物事項) 物理上應合併為一則 Master Note，避免版面破碎。
"""

# --- 模擬資料 ---
TAG_ONTOLOGY = {
    "Areas": ["01_Life", "04_Product"],
    "Products": {
        "04_Product": ["Naruvia", "AAE_Framework"],
        "01_Life": ["Routine", "Finance"] 
    }
}

# --- 讀取基準數據 (Immutable Constants) ---
def load_benchmark_data():
    file_path = os.path.join(os.path.dirname(__file__), 'poc_benchmark_data.json')
    with open(file_path, 'r') as f:
        return json.load(f)

# --- 結構定義 ---
class Tag(BaseModel):
    area: str
    product: str
    topic: str

class EvolvedObj(BaseModel):
    id: str
    title: str
    narrative: str = Field(description="整合後生成的完整敘事文本")
    drawer: str = Field(description="Active/Maintain/Reference/Archive")
    tag: Tag
    strategy_used: str = Field(description="使用的治理策略 (Entropy Reduction / High Entropy Preservation)")
    reasoning: str = Field(description="AI 的決策思考過程")
    merged_ids: List[str]

class Result(BaseModel):
    items: List[EvolvedObj]

async def run_final_poc():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not found")
        return

    # 1. 載入不可變常量
    data = load_benchmark_data()
    EXISTING_EVENTS = data['existing_events']
    TRIVIAL_INPUTS = data['trivial_inputs']

    adapter = GeminiAdapter(model_name="gemini-2.0-flash-exp", api_key=api_key)
    
    librarian = Agent(
        adapter.get_model_instance(),
        output_type=Result,
        system_prompt=(
            f"你是 Naruvia Librarian。請依據以下第一性原理執行治理：\n{SCIENTIFIC_PRINCIPLES}\n"
            f"標籤本體：{json.dumps(TAG_ONTOLOGY, ensure_ascii=False)}\n"
            "要求：\n"
            "1. 對於 Product 內容，執行『強力吞噬』。\n"
            "2. 對於 Life 內容，執行『同類合併』(例如 T3+T4 應合併為寵物事項)。\n"
            "3. 輸出完整的演化敘事 (Narrative)。"
        )
    )

    print("============================================================")
    print("【1. 初始狀態】")
    print("--- 既有引力中心 ---")
    for e in EXISTING_EVENTS:
        print(f"[{e['id']}] {e['title']} ({e['status']})")
        print(f"    {e['narrative']}")
    
    print("\n--- 待處理碎料 ---")
    for t in TRIVIAL_INPUTS:
        print(f"[{t['id']}] {t['content']}")
    print("============================================================\n")

    print(">>> 階段 1: 語義引力追蹤 (Semantic Gravity Tracking)...")
    
    # 定義階段 1 的輸出結構
    class TrackingItem(BaseModel):
        trivial_id: str
        target_gravity_id: Optional[str] = Field(description="被哪個既有事件吸附 (E1/E2)，若無則為 None")
        entropy_gain: str = Field(description="High/Low - 合併後的語義增益")
        decision: str = Field(description="Merge / New Cluster")

    class TrackingResult(BaseModel):
        tracings: List[TrackingItem]

    tracking_agent = Agent(
        adapter.get_model_instance(),
        output_type=TrackingResult,
        system_prompt=(
            f"你是語義引力追蹤器。請依據第一性原理判斷碎料去向：\n{SCIENTIFIC_PRINCIPLES}\n"
            "任務：僅判斷 T 碎料應被哪個 E 事件吸附，或應獨立成新群聚。"
        )
    )

    track_res = await tracking_agent.run(
        f"既有事件：{json.dumps(EXISTING_EVENTS, ensure_ascii=False)}\n"
        f"受入碎料：{json.dumps(TRIVIAL_INPUTS, ensure_ascii=False)}"
    )

    print("\n【階段 1 輸出：引力場分佈】")
    trivial_map = {t['id']: t['content'] for t in TRIVIAL_INPUTS}
    for t in track_res.output.tracings:
        target = t.target_gravity_id if t.target_gravity_id else "NEW_CLUSTER"
        print(f" -> [{t.trivial_id}] {trivial_map.get(t.trivial_id)[:15]}... 吸向 {target} | 決策: {t.decision} ({t.entropy_gain} Entropy Gain)")

    print("\n>>> 階段 2: 敘事演化與雙軸定位 (Evolution & Alignment)...")
    
    evolution_agent = Agent(
        adapter.get_model_instance(),
        output_type=Result,
        system_prompt=(
            f"你是 Naruvia Librarian。根據第一階段的追蹤結果執行最終演化：\n"
            f"標籤本體：{json.dumps(TAG_ONTOLOGY, ensure_ascii=False)}\n"
            "要求：\n"
            "1. 執行『吞噬』：將 Merge 的碎料編織進主敘事。\n"
            "2. 執行『弱聚合』：對於 Life 領域，預設採用『互斥排他』策略。金融、旅遊、寵物、家務屬於完全不同的物理維度，嚴禁合併。請為 T7(旅遊), T8(金融), T6(寵物) 保持獨立，只有當多筆項目明確屬於同一維度（如 T9, T10 都是家務/跑腿）時才可合併。\n"
            "3. 輸出最終雙軸定位 (Active/Maintain + Area/Product/Topic)。"
        )
    )

    final_res = await evolution_agent.run(
        f"既有事件：{json.dumps(EXISTING_EVENTS, ensure_ascii=False)}\n"
        f"追蹤判定：{track_res.output.model_dump_json()}"
    )

    print("\n【階段 2 輸出：最終重構結果】")
    for item in final_res.output.items:
        print(f"📌 {item.title} (ID: {item.id})")
        print(f"   📂 定位: [{item.drawer}] {item.tag.area} > {item.tag.product} > {item.tag.topic}")
        print(f"   📝 敘事: {item.narrative}")
        print(f"   🧠 邏輯: {item.strategy_used} | {item.reasoning}")
        print(f"   🔗 來源: {item.merged_ids}\n")

if __name__ == "__main__":
    asyncio.run(run_final_poc())
