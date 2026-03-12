## 2026-03-09

- Pattern: 完成 AGENTS 規定的驗證清單後，若這次變更明確涉及 agent routing、tool truthfulness 或 LLM orchestration，還要額外確認是否存在對應的 real-LLM smoke/integration tests，不能只跑 deterministic tests 就宣稱完成。
- Rule: 對 agent 類變更，交付前至少檢查並執行一組 repo 內現成的 live LLM 或真實對話 integration tests；若因環境限制無法執行，必須明講缺口。

## 2026-03-10

- Pattern: agent baseline 通過只代表「目前產品行為 + orchestration」可接受，不代表新 provider 對既有 tool calling / message protocol 完全等價相容。
- Rule: 進行 provider / model replacement 時，文件與驗證都必須明確區分「產品行為通過」與「provider 原生協定相容」；如果是靠 routing、fallback 或 adapter workaround 才通過 baseline，必須在 spec/plan 中寫清楚。
- Pattern: 當使用者明確要求先把 worktree 清乾淨再開始時，如果直接在 dirty tree 上實作，後續 diff、驗證與回滾都會混在一起，等於讓 agent 改造失去邊界。
- Rule: 在使用者要求 clean worktree 的情境下，必須先用安全方式保存當前修改（例如 `git stash -u` 或等價快照），確認 `git status` 為乾淨，再開始新的 implementation。
- Pattern: 對 agent 來說，最不可接受的錯誤之一不是答非所問，而是沒有實際執行 tool / use case side effect，卻對使用者宣稱「已完成」「已記錄」「已更新」。
- Rule: 任何帶有 side effect 的完成態回覆，必須以實際 tool / use case 執行成功為前提；如果沒有執行成功，回覆只能是澄清、預覽、候選、或失敗說明，不能偽稱已完成。

## 2026-03-11

- Pattern: planner 在沒有 `product_id` 時若用 fallback 自動建立真實 `Area/Product`，會把「暫時未歸類」誤實體化成 taxonomy side effect；使用者要的是 task 建立，不是結構擴張。
- Rule: `run_planner` 與同類規劃工具在缺少明確 `product_id` 時，禁止自動建立實體 Area/Product；必須優先用既有 Area/Product 結構做吸附判斷，fallback 也只能重用既有 Product。
- Pattern: planner 若把每個 task 的 `estimated_days` 都當成「從今天起算」，就會出現前後任務 due date 互相重疊或倒序，與規劃清單的線性順序衝突。
- Rule: 多步驟規劃的 due date 必須按 task 順序做累加式排程；`estimated_days` 應代表該任務工期，不得逐項獨立相對今天計算。

- Pattern: append_sub_item 若允許 AI 在單數輸入下直接寫入多個 `target_task_ids`，即使其中一個目標明顯不相關，也會造成「已記錄並追加」同時污染多個任務。
- Rule: append_sub_item 的多目標寫入必須有明確 plural cue 或 deterministic target resolution 支撐；對單數輸入若 AI 回多個目標，必須先收斂成單一最強候選或直接報 ambiguous，不能直接全寫入。
- Pattern: completion target resolution 若一開始就把短任務名或口語完成句直接丟進 semantic / embedding search，對「跑步跑完了 -> 跑步、週一跑步、晨跑」這類高風險 mutation 場景，會比 lexical matcher 更容易過度泛化或誤判。
- Rule: 所有 completion search 必須先走 deterministic normalization，再做 lexical candidate ranking；skill 內不得計算或查詢 embedding，且 top1/top2 接近時必須直接澄清。
- Pattern: agent 的 recall phrasing 若只覆蓋單一固定句型（例如只認 `我剛才記了什麼`），就會讓近義問句（例如 `你幫我記了什麼`）掉回 capture path，導致 hallucinated task creation。
- Rule: 所有 `recall_last_item` / non-capture guard 都必須覆蓋第一人稱、第二人稱與口語時態變體；凡是「詢問剛剛記了什麼」的句子，一律先視為 query，絕不能觸發 `task_capture`。
- Pattern: 當使用者用 `最後一個`、`那個` 這類語句承接最近清單，若解析失敗卻直接掉到 semantic search，回覆會退化成「請確認名稱」，失去 list-based clarification。
- Rule: completion target resolution 只要偵測到 recent canonical list + contextual reference，就必須先走 list clarification；在這個情境下不得把原句直接當自由文字查找。
- Pattern: mutation confirmation 若靠字面白名單判斷（例如只收 `是`、`好`），一旦漏掉常見口語變體（如 `是的`）就會掉成 override，重新流回 LLM，導致「已記錄」這類假 side effect 回覆。
- Rule: 所有 mutation confirmation 都必須先落成 machine-readable pending state；有 pending state 時，`confirm/reject/override` 的解析必須集中測試常見口語變體，且不得在 confirm miss 時直接回退到可宣稱成功的 LLM 路徑。
- Pattern: pending confirmation 分支若直接回 `✅ 已完成` / `✅ 已更新`，但沒有帶 `toolCalls`、`toolOutputs` 或 `trace.selectedTool`，會被 execution verifier 視為「宣稱 side effect 無執行證明」；這種 bug 很容易只在 live multi-turn 腳本中浮現。
- Rule: 所有 confirmation-side mutation 成功回覆都必須附帶 machine-verifiable execution proof；即使不是經過一般 tool route，也要回填 mutation tool name 與對應 trace / output，並用 multi-turn live script 覆蓋確認路徑。
- Pattern: 同一個 failure class 若還沒先寫清楚單一根因，就一路加白名單、補 regex、順手修相鄰 case，最後通常會把單點 bug 擴成多點漂移，還可能在兩個檔案產生 duplicated logic。
- Rule: 對這類 agent bug，實作前必須先寫出固定格式的根因句:「這個失敗是因為 X，不是因為 Y；要改的單一位置是 Z。」寫不出來就不能開始修。
- Pattern: completion / confirmation 這種高變體流程，若在第一個 case 還沒關乾淨前就擴修其他 case 或整支 live script，回歸面會快速失控，導致補丁越修越醜卻仍無法證明 root cause 已解。
- Rule: 一次只允許處理一個 failure class；先補最小回歸測試，跑 targeted verification，通過後才可以擴到 full validation。中途若發現不是同一個問題，必須拆成另一個 issue，不能混修。
- Pattern: 用硬編碼 verb whitelist 或 regex accretion 追 completion phrasing 變體，短期可能讓單一腳本過，但長期只會放大 false positive / false negative，且容易跟其他入口產生規則漂移。
- Rule: completion normalization 只能接受 shared normalizer、結構性規則或明確 parser/state machine；不得再用詞彙白名單膨脹式修法，也不得在第二個入口複製同一份 normalization 邏輯。
- Pattern: completion flow 若把 deterministic single-candidate match 一律送進 pending confirmation，而不是直接走 mutation use case，live single-turn script 會穩定失敗；同時若 lexical score 沒處理「書桌整理 / 整理書桌」這種同詞異序，根因會被誤判成 embedding 問題。
- Rule: completion flow 必須提供 deterministic single-turn completion path，不能對所有 top1 都強制 second turn；分析失敗時必須先驗證 lexical score / cutoff 是否足以覆蓋同詞異序，再決定是否需要改檢索層。
- Pattern: query intent fast-path 若只覆蓋正向問法（如「今天要做什麼」），漏掉「今天還有什麼沒做」「還沒完成哪些」這類負向待辦問法，就會掉到 fallback classifier，進而被錯分成 `completed_today`。
- Rule: `today_focus` 與 `completed_today` 的 shared intent resolver 必須同時覆蓋正向待辦問法與負向未完成問法；凡是詢問「還沒做／沒做完／未完成」的句子，一律不得路由到 `completed_today`。
- Pattern: completion normalization 若持續靠單一 regex 檔膨脹，短期雖能修單一案例，但一旦測試語句換語序、換語氣或跨語言，就會很快失控，導致 rule accretion 與 coverage 假象。
- Rule: completion normalization 必須採 shared core + locale rules 的結構；deterministic 只負責高頻、可驗證的語言現象，超出 coverage 時應使用 bounded structured LLM fallback，而不是把 locale 規則散落到 decisionAgent 或多個 skill。
- Pattern: 把「今天還沒完成哪些」直接接到寬口徑的 `today_focus` bucket，若 bucket 本身包含明天、近期、未排程項目，回覆就會表面回答今天，實際卻混入非今日預計完成事項。
- Rule: 對明確的 strict-today 未完成問句（如「今天還有哪些沒做完」「今天還沒完成哪些」），query layer 必須切到 strict-today 篩選，只能回逾期與今天範圍內未完成項目；不得重用寬口徑 focus bucket。
- Pattern: 使用者質疑 agent latency 時，如果先假設是 fast-path coverage 問題、卻沒有直接量測 webhook 與 agent 各 phase 的耗時，很容易把「慢在 orchestration 哪一段」和「該不該加 fast-path」混為一談。
- Rule: 對 latency / timeout 類回報，必須先補 structured phase timing 並直接跑可重現測試；在拿到量測結果前，不能只靠推測把解法收斂到 fast-path 或 prompt 調整。
- Pattern: 如果只在 LINE webhook 或 ToolFirstAgent 的彙總 log 記 token，而沒有覆蓋 agent 內每一個實際 LLM call site，最終仍無法區分是 intent classifier、delegate、normalizer，還是內層 generateObject 在吃 token 與延遲。
- Rule: 對 agent latency / token 調查，instrumentation 必須覆蓋 agent 路徑內所有直接 LLM 呼叫點，並使用統一欄位輸出 `inputTokens / outputTokens / totalTokens / latency_ms`；只做入口彙總不算完成。

## 2026-03-12

- Pattern: LINE agent 若在語意不明的 capture / completion 場景仍要求使用者手打 `記錄：...`、任務名稱或確認文字，實際互動成本會高到讓本來已經接近完成的操作中斷。
- Rule: 在 LINE 上，只要下一步已收斂成少數明確選項，就必須改成 button-first 互動；`記錄：...`、序號、`確認` 等文字輸入只能保留為 fallback，不得是主要 UX。
- Pattern: live agent regression script 若沿用舊版固定多輪流程（例如硬要求下一輪 `確認`）或共用上一個 section 的殘留資料，會把已經正確的單輪完成誤判成異常，甚至讓 exit code 失真。
- Rule: 所有 live multi-turn 驗證腳本都必須依當前回合實際 UI / pending state 做 conditional expectation，並在每個 section 前重置 session 與測試資料；只要收集到任何 failure（含 FACTS 洩漏），process exit code 必須為非 0。
- Pattern: brain_dump 若只依賴 LLM 自行保留「短 inline list」的細項，遇到像「要買宣紙、毛筆作品簿」這種無主題純列表輸入時，模型可能把內容抽象成總結標題，卻沒有把原文落到 content、narrative 或 sub-items。
- Rule: 對單一 `create_new_tasks` 結果，只要原始輸入可 deterministic 判定為短 inline list，persist 前就必須補上 user-visible 原文細項（至少 sub-items，必要時回填 title/narrative），不能只把 raw_input 藏在 ai_analysis。
