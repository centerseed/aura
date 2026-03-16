# Feature: 當日限定任務（date_locked）
# Version: 1.0 — 2026-03-15
# Author: wubaizong
#
# 背景：每日代辦會往後掃 15 天內的任務排進計畫。
# 但「去看展」這類事件型任務（occurrence）只有在到期日當天才能執行，
# 提前出現在代辦清單毫無意義。本功能引入 date_locked 概念加以區分。

Feature: 當日限定任務不提前列入每日代辦

  Background:
    Given 用戶已登入 Zentropy
    And 今日為 2026-03-18

  @ac1
  Scenario: date_locked 任務在到期日之前不出現在每日計畫
    Given 用戶有一個任務「去看展」，到期日為 2026-03-20，date_locked 為 true
    When 系統生成 2026-03-18 的每日計畫
    Then 「去看展」不出現在 2026-03-18 的代辦清單中

  @ac2
  Scenario: date_locked 任務在到期日當天正常列入每日計畫
    Given 用戶有一個任務「去看展」，到期日為 2026-03-20，date_locked 為 true
    When 系統生成 2026-03-20 的每日計畫
    Then 「去看展」出現在 2026-03-20 的代辦清單中

  @ac3
  Scenario: Brain Dump 自動判斷事件型任務並設定 date_locked
    When 用戶透過 Brain Dump 輸入「下週五去看設計展」
    Then 系統建立的任務 date_locked 為 true
    And 到期日被設定為下週五

  @ac3
  Scenario: Brain Dump 判斷截止型任務不設定 date_locked
    When 用戶透過 Brain Dump 輸入「下週五前完成提案報告」
    Then 系統建立的任務 date_locked 為 false

  @ac4
  Scenario: 用戶可手動將任務切換為當日限定
    Given 用戶有一個 date_locked 為 false 的任務
    When 用戶在任務編輯畫面開啟「當日限定」開關
    And 儲存任務
    Then 任務的 date_locked 變更為 true

  @ac4
  Scenario: 用戶可手動取消當日限定
    Given 用戶有一個 date_locked 為 true 的任務
    When 用戶在任務編輯畫面關閉「當日限定」開關
    And 儲存任務
    Then 任務的 date_locked 變更為 false

  @ac5
  Scenario: 現有任務不設定 date_locked 時行為不變
    Given 用戶有一個到期日為 2026-03-22 且未設定 date_locked 的任務
    When 系統生成 2026-03-18 的每日計畫
    Then 該任務依原有邏輯（15 天內到期）列入代辦清單
