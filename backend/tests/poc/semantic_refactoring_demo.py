import math
import random

# 模擬資料集：針對 Naruvia 專案的進度與細碎事項
MOCK_DATA = [
    # 開發進度 (Macro Progress)
    {"id": "P1", "content": "完成 Milestone 2: AAE 核心框架多 LLM 適配架構", "target": "Progress"},
    {"id": "P2", "content": "Librarian Agent 核心存儲邏輯與 Firestore 對接完成", "target": "Progress"},
    {"id": "P3", "content": "Unified Board 儀表板三層視圖邏輯實現", "target": "Progress"},
    
    # 細碎事項 (Micro Details - UI)
    {"id": "U1", "content": "修正導航欄左側圖標 2px 的偏置問題", "target": "UI_Detail"},
    {"id": "U2", "content": "調整 GlassCard 的磨砂背景模糊度至 15px", "target": "UI_Detail"},
    {"id": "U3", "content": "更新按鈕的 hover 顏色從 #666 改為 #888", "target": "UI_Detail"},
    {"id": "U4", "content": "手機視圖下字體大小調整為 14px", "target": "UI_Detail"},
    
    # 細碎事項 (Micro Details - Logic)
    {"id": "L1", "content": "重命名變數 user_info 為 user_profile 以符合規範", "target": "Logic_Detail"},
    {"id": "L2", "content": "修正一個 README.md 中的拼字錯誤", "target": "Logic_Detail"},
    {"id": "L3", "content": "在 API header 中增加一個時間戳欄位", "target": "Logic_Detail"},
]

def dot_product(v1, v2):
    return sum(x * y for x, y in zip(v1, v2))

def magnitude(v):
    return math.sqrt(sum(x * x for x in v))

def cosine_similarity(v1, v2):
    mag1 = magnitude(v1)
    mag2 = magnitude(v2)
    if mag1 == 0 or mag2 == 0:
        return 0
    return dot_product(v1, v2) / (mag1 * mag2)

def generate_mock_embeddings(data):
    """手動構造向量，模擬 Embedding 效果"""
    embeddings = []
    for item in data:
        # 基礎特徵
        vec = [random.uniform(-1, 1) for _ in range(256)] 
        
        if item["target"] == "Progress":
            # 宏觀進度特徵：強大的「系統性」語義
            for i in range(0, 50): vec[i] += 4.0
        elif item["target"] == "UI_Detail":
            # UI 細節特徵：強大的「視覺與小修」語義
            for i in range(100, 150): vec[i] += 3.5
            for i in range(0, 20): vec[i] += 0.5 # 帶有一點點進度感
        elif item["target"] == "Logic_Detail":
            # 邏輯細節特徵
            for i in range(200, 250): vec[i] += 2.0
            
        embeddings.append(vec)
    return embeddings

def calculate_stats(similarities):
    mean = sum(similarities) / len(similarities)
    variance = sum((x - mean) ** 2 for x in similarities) / len(similarities)
    return mean, math.sqrt(variance)

def run_poc():
    print("=== Naruvia 專案語義分群測試 (進度 vs 細碎) ===\n")
    
    embeddings = generate_mock_embeddings(MOCK_DATA)
    all_sims = []
    for i in range(len(embeddings)):
        for j in range(i + 1, len(embeddings)):
            all_sims.append(cosine_similarity(embeddings[i], embeddings[j]))
    
    global_mean, global_std = calculate_stats(all_sims)
    
    # 測試 UI 細碎事項的群聚 (U1~U4)
    ui_indices = [3, 4, 5, 6]
    ui_sims = []
    for i in range(len(ui_indices)):
        for j in range(i + 1, len(ui_indices)):
            ui_sims.append(cosine_similarity(embeddings[ui_indices[i]], embeddings[ui_indices[j]]))
    
    ui_mean = sum(ui_sims) / len(ui_sims)
    z_score_ui = (ui_mean - global_mean) / global_std
    
    # 測試 進度與細碎的跨群聚相似度 (P1 vs U1)
    p1_u1_sim = cosine_similarity(embeddings[0], embeddings[3])

    print(f"全局底噪相似度 (Mean): {global_mean:.4f}")
    print(f"UI 細碎群聚相似度: {ui_mean:.4f} (Z-Score: {z_score_ui:.2f}x)")
    print(f"進度報告 P1 與 UI 修正 U1 的關聯度: {p1_u1_sim:.4f}")

    # 重構建議決策
    if z_score_ui > 2.0:
        print("\n[重構建議：原子坍縮 (Collapse)]")
        print("🔴 偵測到大量 UI 微調事項。")
        print("建議動作：將 U1, U2, U3, U4 合併為一則 Master Note:『儀表板介面風格微調建議』")
        print("價值：減少儀表板瑣碎卡片，提升宏觀進度可視性。")

    # 進度報告分群
    progress_indices = [0, 1, 2]
    progress_sims = []
    for i in range(len(progress_indices)):
        for j in range(i + 1, len(progress_indices)):
            progress_sims.append(cosine_similarity(embeddings[progress_indices[i]], embeddings[progress_indices[j]]))
    
    prog_mean = sum(progress_sims) / len(progress_sims)
    print(f"\n跨進度報告相似度: {prog_mean:.4f}")
    if prog_mean > 0.8:
        print("🟢 這些進度報告邏輯連貫，將自動形成『專案開發日誌脈絡』。")

if __name__ == "__main__":
    run_poc()

if __name__ == "__main__":
    run_poc()
