## 2026-03-09

- Pattern: 完成 AGENTS 規定的驗證清單後，若這次變更明確涉及 agent routing、tool truthfulness 或 LLM orchestration，還要額外確認是否存在對應的 real-LLM smoke/integration tests，不能只跑 deterministic tests 就宣稱完成。
- Rule: 對 agent 類變更，交付前至少檢查並執行一組 repo 內現成的 live LLM 或真實對話 integration tests；若因環境限制無法執行，必須明講缺口。

## 2026-03-10

- Pattern: agent baseline 通過只代表「目前產品行為 + orchestration」可接受，不代表新 provider 對既有 tool calling / message protocol 完全等價相容。
- Rule: 進行 provider / model replacement 時，文件與驗證都必須明確區分「產品行為通過」與「provider 原生協定相容」；如果是靠 routing、fallback 或 adapter workaround 才通過 baseline，必須在 spec/plan 中寫清楚。
