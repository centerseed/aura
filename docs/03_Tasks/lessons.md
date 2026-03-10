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
