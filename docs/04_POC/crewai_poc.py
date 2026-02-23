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
# 使用 Google Gemini 模型 (需設定好 GEMINI_API_KEY 環境變數)
# 這裡指定使用免費又快速的 gemini-1.5-flash 模型
llm_model = "gemini/gemini-1.5-flash"

tech_lead = Agent(
    role="資深架構師 (Tech Lead)",
    goal="分析 Zentropy 傳來的任務，並制定清晰、安全的修改策略書，絕不盲目修改。",
    backstory="你是一位極度謹慎的軟體架構師。在動手寫 code 前，你一定會先規劃清單，並要求人類 PM 同意。",
    verbose=True,
    llm=llm_model
)

supervisor = Agent(
    role="發包督導 (Execution Supervisor)",
    goal="精準地拿著架構師開出且經人類同意的策略書，去喚醒終端機底層的 Claude CLI 工具。",
    backstory="你是一台無情的發包機器。你只負責把確認無誤的文件丟給工具去執行，不帶個人情感。",
    tools=[mock_claude_cli_tool],
    verbose=True,
    llm=llm_model
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
