# Version: 1.0 | 2026-03-15
# Ticket: b7bbd859 — 簡化 Reorganize UI 降低使用門檻

Feature: 簡化 Reorganize UI 降低使用門檻

  Background:
    Given 用戶已登入且有一個 Product 內含多個任務

  @ac1
  Scenario: 主題重組 Section 只顯示有變動的任務
    Given AI 建議將 3 個任務從「未分類」移到「技術開發」，其餘 7 個任務保持不動
    When 用戶查看重組建議
    Then 主題重組 Section 只顯示被移動的 3 個任務
    And 不顯示保持不動的 7 個任務
    And 顯示摘要文字說明不動的任務數量

  @ac2
  Scenario: Topic 改名與合併操作以 diff 方式呈現
    Given AI 建議將「其他」改名為「技術債」，並合併「UI 開發」+「前端修復」為「前端開發」
    When 用戶查看重組建議
    Then 顯示改名操作的前後對比
    And 顯示合併操作的來源與目標
    And 未變動的 Topic 不出現在操作列表中

  @ac3
  Scenario: 任務整合 Section 只在有合併建議時顯示
    Given AI 沒有任務整合建議
    When 用戶查看重組建議
    Then 不顯示任務整合 Section

  @ac4
  Scenario: 任務整合 Section 顯示合併預覽
    Given AI 建議將 2 個細碎任務合併為 1 個主任務
    When 用戶查看重組建議
    Then 顯示合併後的標題
    And 顯示主任務和子任務的關係
    And 顯示合併理由

  @ac5
  Scenario: 用戶可分別勾選套用主題重組與任務整合
    When 用戶取消勾選主題重組但保留任務整合
    Then 套用按鈕只執行任務整合
    And 主題重組 Section 視覺上呈現半透明

  @ac6
  Scenario: 無任何變動時顯示乾淨的空白態
    Given AI 分析後認為不需要調整
    When 用戶查看重組建議
    Then 顯示「任務已整理好了」的正面回饋
    And 不顯示套用按鈕

  @ac7
  Scenario: Flutter App 與 Web 的視覺邏輯一致
    When 用戶在 App 和 Web 分別查看同一個重組建議
    Then 兩邊顯示相同的 Section 結構和資訊密度
    And 兩邊都只顯示差異、不顯示不動的任務
