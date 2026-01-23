import os
import google.generativeai as genai
from dotenv import load_dotenv

# 加載環境變數
load_dotenv()

# 模擬資料集：針對 Naruvia 專案的進度與細碎事項
MOCK_DATA = [
    {"id": "P1", "content": "完成 Milestone 2: AAE 核心框架多 LLM 適配架構"},
    {"id": "P2", "content": "Librarian Agent 核心存儲邏輯與 Firestore 對接完成"},
    {"id": "P3", "content": "Unified Board 儀表板三層視圖邏輯實現"},
    {"id": "U1", "content": "修正導航欄左側圖標 2px 的偏置問題"},
    {"id": "U2", "content": "調整 GlassCard 的磨砂背景模糊度至 15px"},
    {"id": "U3", "content": "更新按鈕的 hover 顏色從 #666 改為 #888"},
    {"id": "U4", "content": "手機視圖下字體大小調整為 14px"},
    {"id": "L1", "content": "重命名變數 user_info 為 user_profile 以符合規範"},
    {"id": "L2", "content": "修正一個 README.md 中的拼字錯誤"},
    {"id": "L3", "content": "在 API header 中增加一個時間戳欄位"},
]

def run_gemini_reorganize():
    # 配置 API Key
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY not found in environment.")
        return
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    
    data_str = "\n".join([f"- [{item['id']}] {item['content']}" for item in MOCK_DATA])
    
    prompt = f"""
你現在是 Naruvia 系統的 Librarian Agent。
你的任務是根據「知識治理與動態重構協議」對以下碎裂的專案資料進行重構整理。

### 資料：
{data_str}

### 重構要求：
1. **宏觀進度 (Macro Progress)**：識別出屬於核心開發進度的項，並將其整理成「開發日誌脈絡」。
2. **原子坍縮 (Collapse)**：識別出屬於細碎 UI 修正或瑣事修正的項。將它們合併成一個結構化的「Master Note」摘要。
3. **MOC (Map of Content)**：為整個主題提供一個敘事性的宏觀導覽總結。

請以繁體中文輸出結果，體現出「一眼看透大局」的價值感。
"""

    print("=== 正在傳送至 Gemini 2.0 Flash 進行真實語義重構 ===\n")
    try:
        response = model.generate_content(prompt)
        print("=== 重構後的資料輸出 (Librarian View) ===\n")
        print(response.text)
    except Exception as e:
        print(f"Error calling Gemini API: {str(e)}")

if __name__ == "__main__":
    run_gemini_reorganize()
