import os
import subprocess
from crewai import Agent, Task, Crew, Process
from crewai.tools import tool

# --- 1. 定義系統層級工具 (Tools) ---
# 這些工具的核心思想：Agent 不自己寫 Code 也不自己搜集資料，只負責呼叫 Claude 下包。
# 注意：Tool 命名最好用全英文加底線，以免不同廠商 API Parsing 產生 Duplicate function 錯誤
@tool("claude_research_tool")
def claude_research_tool(task_keyword: str) -> str:
    """
    要求 Claude Code 透過 MCP 取得指定任務內容，並進行代碼庫分析，最後產出實作計畫。
    傳入參數為任務關鍵字 (例如 "IAP")。
    """
    worktree_path = f"./zentropy_workers/task_{task_keyword}"
    plan_file = os.path.join(worktree_path, "plan.md")
    
    print(f"\n[系統操作] 建立/進入 Worktree: {worktree_path}")
    # 這裡實務上會執行 git worktree add
    os.makedirs(worktree_path, exist_ok=True)
    
    # 改為純英文 Prompt，避免在某些 Terminal 中傳遞中文參數會變成亂碼 (ÿffff...)
    prompt = f"Please use Zentropy MCP to fetch the task related to '{task_keyword}'. Then scan the local codebase, research how to implement this feature, formulate an implementation plan, and write the results to {plan_file}. Exit the conversation when done."
    
    print(f"🤖 [發包給 Claude Code] 執行真實指令: claude -p \"{prompt}\"")
    print(f"⏳ (這會需要幾十秒到數分鐘的時間，因為 Claude 正在真實閱讀代碼庫與 MCP...)")
    
    # try:
    #     # 實際呼叫真實的 Claude Code！
    #     result = subprocess.run(["claude", "-p", prompt], cwd=worktree_path, capture_output=True, text=True, check=True)
    #     return f"Claude 已完成研究！這是一份產出的實施草案：\n\n{result.stdout}"
    # except subprocess.CalledProcessError as e:
    #     return f"❌ 呼叫 Claude 發生錯誤！\n錯誤代碼: {e.returncode}\n錯誤內容: {e.stderr}"

    print(f"\n==========================================")
    print(f"👉 請在新終端機手動執行以下指令測試：")
    print(f"mkdir -p {worktree_path}")
    print(f"# 請保持在 Naruvia 專案根目錄執行，避免 Claude 權限報錯！")
    print(f"claude -p \"{prompt}\"")
    print(f"==========================================\n")
    
    return f"Claude 已完成研究！這是一份產出的實施草案：\n(這是一段測試用的 Mock 回覆，請在另一個終端機手動執行上面的指令來確認真實狀況)"


@tool("claude_develop_tool")
def claude_develop_tool(task_keyword: str) -> str:
    """人類同意實作計畫後，喚醒 Claude Code 進行實際寫 code 與測試。傳入任務關鍵字。"""
    worktree_path = f"./zentropy_workers/task_{task_keyword}"
    prompt = "The human manager has approved the implementation plan. Please read the `./plan.md` file in this directory. Implement all the sub-tasks listed in it step-by-step. Use your tools to read the codebase, modify files, run Prisma migrations if needed, and write tests. As you make progress, update the checkboxes in `./plan.md`. Once all steps are done, commit the changes and use Zentropy MCP to update the original task status. Exit when completely finished."
    
    max_retries = 3
    retries = 0
    
    print(f"\n[系統操作] 正在 {worktree_path} 指揮 Claude 進行開發 (限制重試 {max_retries} 次)...")
    
    while retries < max_retries:
        try:
            print(f"🤖 [發包給 Claude Code] 執行指令 (嘗試 {retries+1}/{max_retries})...")
            # 實際執行 Claude Code 開發指令，設定 timeout 防止無限卡死 (例如 20 分鐘)
            result = subprocess.run(
                ["claude", "--worktree", f"task_{task_keyword}", "-p", prompt],
                capture_output=True, 
                text=True, 
                check=True,
                timeout=1200 # 20 分鐘
            )
            return f"Claude 回報開發結果：\n\n{result.stdout}\n\n任務已順利完成。"
        except subprocess.CalledProcessError as e:
            retries += 1
            print(f"❌ [警告] Claude 在寫扣時發生錯誤 (Code: {e.returncode})! 正在嘗試自我修復...")
            # 將錯誤訊息塞回給 Claude 讓它重試
            prompt = f"Previous execution failed with error:\n{e.stderr[-1000:]}\nPlease read the plan, fix the issues, and continue development."
        except subprocess.TimeoutExpired:
            retries += 1
            print("⏳ [警告] Claude 執行超過 20 分鐘未回應，正在強制中斷並重新派發任務...")
            prompt = "Previous execution timed out. Please review where you left off in plan.md and continue."
            
    return f"🚨 [重大失敗] Claude 重試 {max_retries} 次後仍然無法完成開發。請人類主管介入處理。最後一次錯誤訊息：{prompt}"


@tool("claude_review_tool")
def claude_review_tool(task_keyword: str) -> str:
    """開發完成後，喚醒另一個乾淨無偏見的 Claude Session 進行 Code Review。傳入任務關鍵字。"""
    worktree_path = f"./zentropy_workers/task_{task_keyword}"
    prompt = "As an independent senior reviewer, please review the latest commit logic in this branch, check if it complies with the project's architectural standards, check for security vulnerabilities, and fix them if necessary. Exit the conversation when done."
    
    print(f"\n[系統操作] 在 {worktree_path} 啟動 真實 Claude Reviewer...")
    print(f"🤖 [發包給 Claude Code] 執行指令: claude -p \"{prompt}\"")
    print(f"⏳ (審查中，請稍候...)")
    
    # try:
    #     result = subprocess.run(["claude", "-p", prompt], cwd=worktree_path, capture_output=True, text=True, check=True)
    #     return f"獨立 Claude Reviewer 審查報告：\n\n{result.stdout}"
    # except subprocess.CalledProcessError as e:
    #     return f"❌ 呼叫 Claude 審查時發生錯誤！\n錯誤內容: {e.stderr}"

    print(f"\n==========================================")
    print(f"👉 請在 Naruvia 根目錄下手動執行以下指令測試：")
    print(f"claude --worktree task_{task_keyword} -p \"{prompt}\"")
    print(f"==========================================\n")
    
    return "獨立 Claude Reviewer 審查報告：\n(這是一段測試用的 Mock 回覆，審查通過)"


# --- 2. 配置團隊成員 (Agents) ---
# 使用 Gemini
# 注意：執行時請確保系統中有 export GEMINI_API_KEY="AIzaSy..."
from crewai import LLM
gemini_llm = LLM(
    model="gemini/gemini-2.5-flash-lite",
    api_key=os.environ.get("GEMINI_API_KEY")
)

zentropy_pm = Agent(
    role="Zentropy AI Manager (Tech Lead)",
    goal="你的目標是完美協調軟體工廠。你絕對不自己寫 Code。遇到 Zentropy 的票，你只呼叫 Claude 工具去拿票、去理解 codebase。等 Claude 產出報告後，你整理報告給人類。人類同意後，你再調用其它 Claude 實體進行後續的實施與審查。",
    backstory="你是最高指揮官。你手下有無數個 Claude Code 機器打字員。當被要求處理 'IAP' 功能時，你會按部就班：1號去調研 -> 人類點頭 -> 2號去寫 Code -> 3號去 Review。",
    tools=[claude_research_tool, claude_develop_tool, claude_review_tool],
    verbose=True,
    llm=gemini_llm
)


# --- 3. 定義任務流 (Tasks) ---

# 任務 1: 調研與匯報
investigate_task = Task(
    description="人類主管想要開發 Zentropy 系統內的 'IAP' 相關功能。請呼叫『claude_research_tool』，讓 Claude Code 透過 MCP 拿票並理解程式碼。將拿到的實施草案整理成清晰的 Markdown 報告。",
    expected_output="一份整理好的 Markdown 實施計畫報告。",
    agent=zentropy_pm,
    human_input=True # 人類停等點：PM 把報告端出來，你點頭它才進行下一步！
)

# 任務 2: 實施與審查
execute_task = Task(
    description="在取得人類同意後，立刻呼叫『claude_develop_tool』進行開發。當開發完成後，立刻無縫接軌呼叫『claude_review_tool』進行審查。",
    expected_output="最終的開發與審查綜合狀態報告。",
    agent=zentropy_pm
)

# --- 4. 啟動 CrewAI 組裝流水線 ---
zentropy_crew = Crew(
    agents=[zentropy_pm],
    tasks=[investigate_task, execute_task],
    process=Process.sequential,
    # 暫時關閉預設的記憶庫。因為開啟記憶後會預設使用 OpenAI 的向量轉換模型 (Embeddings)，這會導致找不到 OPENAI_API_KEY 的錯誤。
    # 若要開啟，需要設定 embedder 指向 Google 的 Embedding 模型。
    memory=False
)

if __name__ == "__main__":
    import sys
    print("啟動 Zentropy AI Manager - IAP 工作流調度中...")
    try:
        result = zentropy_crew.kickoff()
        print("\n" + "#"*40)
        print("✨ 全部流程執行完畢！最終報告：")
        print(result)
    except Exception as e:
        print("\n❌ 錯誤發生！")
        print(f"詳細錯誤訊息: {str(e)}")

