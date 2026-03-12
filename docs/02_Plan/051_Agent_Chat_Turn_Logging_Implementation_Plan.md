# Agent Chat Turn Logging Implementation Plan

**版本**: v0.1
**更新日期**: 2026-03-12
**對應 Spec**: [`019_Agent_Chat_Turn_Logging_Spec.md`](../01_Specification/019_Agent_Chat_Turn_Logging_Spec.md)

## 1. Implementation Steps

1. 新增 Prisma schema 與 migration
2. 建立共用 `AgentChatTurnLogger`
3. 在 `LifecycleAwareAgent` 內記錄 success / error turn
4. 讓 API 與 LINE 共用同一條記錄路徑
5. 補 unit tests 驗證成功與失敗 turn 都會落 logger
6. 提供可重用的查詢 API 與 MCP tool
7. 跑 API lint / test / build

## 2. Initial Shape

首版欄位先保留後續評估需要的原始材料：

1. request / response 原文
2. intent / trace
3. tool_calls
4. usage / timings
5. status / error_message

## 3. Deferred Work

後續再做：

1. 每週 evaluator script
2. 問題聚類與樣本抽取
3. 後台查詢 UI
4. 自動產出測試案例與修正 task
