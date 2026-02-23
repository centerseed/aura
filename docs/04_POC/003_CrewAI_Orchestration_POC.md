# CrewAI Orchestration POC (Proof of Concept) Plan

## 1. 實驗目標 (Objective)
本 POC 旨在驗證 **CrewAI** 作為 Zentropy 任務協調中間層（Zentropy AI Planner, ZAP）的可行性。重點測試其「角色扮演 (Agents)」、「內建任務停等 (Human-in-the-Loop)」以及「工具委派 (Tool Delegation)」三大核心能力，以確認它能否在不寫複雜狀態機腳本的情況下，優雅地接管 Zentropy 到 Claude Code 之間的排程工作。

## 2. 實驗範圍 (Scope)
為保持 POC 輕量，我們不直接接取真實的 Zentropy API 或真實的 Claude Code，而是採用「Mock (模擬)」的方式來印證流程流轉是否如我們預期設計：

*   **Mock Input**: 寫死一則 Zentropy 任務 JSON（例如：修復登入頁面的 Button 顏色）。
*   **Mock Claude CLI**: 不真敲 `claude -p`，而是寫一個 Python Mock Tool，當被呼叫時只是在終端機印出 `[模擬喚醒 Claude Code 進行平行處理: <填入的策略>]`。
*   **真實的 CrewAI 邏輯**: 使用真實的 Anthropic API Key 驅動 CrewAI 框架。

## 3. 實驗架構設計 (Architecture)

我們將設定兩個 Agent 與兩個 Task，形成一條單向工作流：

### Agents (專業經理人)
1.  **Tech Lead (架構師)**:
    *   **角色設定**: 資深系統架構師，負責閱讀任務需求並規劃修改範圍。
    *   **任務**: 讀取 Mock Input，產出詳細的《修改策略書》。
2.  **Execution Supervisor (發包督導)**:
    *   **角色設定**: 專案執行長，只負責拿著策略書去開機器。
    *   **配備工具**: `mock_claude_cli_tool` (模擬喚醒 Claude)。

### Tasks (工作流)
1.  **Planning Task**:
    *   指派給 Tech Lead。
    *   **關鍵設定**: `human_input=True`。這將強制 CrewAI 產出策略後，在終端機暫停並詢問人類是否同意。
2.  **Execution Task**:
    *   指派給 Execution Supervisor。
    *   負責將人類同意的策略丟給 Mock Tool 執行。

## 4. 實作步驟 (Implementation Steps)

### Step 1: 環境準備 (使用 Conda)
在我們進行測試前，我們先用 conda 建立一個乾淨且獨立的環境：
```bash
conda create -n zentropy-crew python=3.11 -y
conda activate zentropy-crew

# CrewAI 內建強大的 LiteLLM 支援，不須綁死 Anthropic
pip install crewai

# 填入您想用的便宜 API Key (例如 OpenAI)
export OPENAI_API_KEY="your-openai-api-key-here"
```

### Step 2: 撰寫 POC 腳本 (`crewai_poc.py`)
這是一支涵蓋所有邏輯的獨立腳本。我們會導入 `Crew`, `Agent`, `Task`, 以及自訂的 `@tool`。
**注意：我們不必使用昂貴的 Claude 3.5 Sonnet 模型！** Planner 的工作只是文字分析，我們可以用最便宜的 `gpt-4o-mini`，甚至是用 Groq 提供的免費開源模型。

```python
import os
from crewai import Agent, Task, Crew, Process
from crewai.tools import tool

# --- 1. 定義工具 Tools ---
@tool("Mock Claude CLI Starter")
def mock_claude_cli_tool(strategy: str) -> str:
    """當確認策略後，呼叫此工具來建立 Worktree 並在背景啟動 Claude Code。"""
    print("\n" + "="*50)
    print("🚀 [系統層級呼叫] 正在建立隔離 Git Worktree...")
    print(f"🤖 [系統層級呼叫] 正在喚醒背景 Claude Code，並餵入以下策略：\n{strategy}")
    print("="*50 + "\n")
    return "已成功發包給背景工作者。"

# --- 2. 定義代理 Agents ---
# 使用極為便宜的 OpenAI gpt-4o-mini 模型 (只需設定好 OPENAI_API_KEY)
# 若想用語法切換其他便宜/免費模型，可改為 "gemini/gemini-1.5-flash" 或是 "groq/llama3-8b-8192"
cheap_llm = "gpt-4o-mini"

tech_lead = Agent(
    role="資深架構師 (Tech Lead)",
    goal="分析 Zentropy 傳來的任務，並制定清晰、安全的修改策略書，絕不盲目修改。",
    backstory="你是一位極度謹慎的軟體架構師。在動手寫 code 前，你一定會先規劃清單，並要求人類 PM 同意。",
    verbose=True,
    llm=cheap_llm
)

supervisor = Agent(
    role="發包督導 (Execution Supervisor)",
    goal="精準地拿著架構師開出且經人類同意的策略書，去喚醒終端機底層的 Claude CLI 工具。",
    backstory="你是一台無情的發包機器。你只負責把確認無誤的文件丟給工具去執行，不帶個人情感。",
    tools=[mock_claude_cli_tool],
    verbose=True,
    llm=cheap_llm
)

# --- 3. 模擬外界輸入 ---
mock_zentropy_task = """
任務 ID: TASK-99
標題: 修正首頁 Hero Section 圖片在手機版被裁切的問題
描述: 客戶回報在 iPhone 上看首頁，最上面的大圖左右會被切斷。請修改為 cover 或 contain 模式。
"""

# --- 4. 定義任務 Tasks ---
planning_task = Task(
    description=f"請針對以下 Zentropy 任務，擬定一份《修改策略書》。包含預計修改的元件、CSS 屬性。\n\n任務內容：{mock_zentropy_task}",
    expected_output="一份包含 3 個步驟的 Markdown 格式《修改策略書》。",
    agent=tech_lead,
    human_input=True  # 關鍵：開啟 Human-in-the-Loop
)

execution_task = Task(
    description="將架構師的《修改策略書》傳遞給 Mock Claude CLI Starter 工具進行實體發包。",
    expected_output="發包成功的系統確認訊息。",
    agent=supervisor
)

# --- 5. 組裝並啟動 CrewAI ---
zentropy_crew = Crew(
    agents=[tech_lead, supervisor],
    tasks=[planning_task, execution_task],
    process=Process.sequential # 順序執行：Task 1 -> Task 2
)

if __name__ == "__main__":
    print("啟動 Zentropy CrewAI 協調層 POC...")
    result = zentropy_crew.kickoff()
    print("\n######################")
    print("POC 執行完畢，最終結果：")
    print(result)
```

## 5. 驗證標準 (Success Criteria)
執行 `python crewai_poc.py` 後，我們應觀察到以下現象：
1.  終端機首先印出 Tech Lead 的推理過程，並產出一份策略書。
2.  **核心驗證點**：終端機會暫停，並出現類似 `Please provide feedback:` 的提示，等待您輸入。
3.  您可以故意輸入 `請加上 '需通知設計師' 的字眼`，觀察 Tech Lead 是否重新修改策略。
4.  當您輸入 `yes` 等同意字眼後，流程才往 Supervisor 推進。
5.  Supervisor 會正確地呼叫 `Mock Claude CLI Starter` 工具，並在螢幕上印出 `[系統層級呼叫]` 等字樣。
