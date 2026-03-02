#!/usr/bin/env bash
# governance-eval.sh — 抓取 Zentropy Flywheel 治理指標，供 Claude 分析
# 使用方式：./scripts/governance-eval.sh
# 前置：Cloud SQL Proxy 需在 port 5433 執行
#   cloud-sql-proxy zentropy-4f7a5:asia-east1:zentropy-db --port=5433 &

set -euo pipefail

# 從 api/.env 載入 DB URL（不污染 shell 環境）
if [[ -f "api/.env" ]]; then
  DB_URL=$(grep -E "^(DATABASE_URL|CLOUDSQL_DATABASE_URL)=" api/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
fi
DB="${DB_URL:-$DATABASE_URL}"

if [[ -z "$DB" ]]; then
  echo "ERROR: DATABASE_URL not found. 請確認 api/.env 存在且 Cloud SQL Proxy 在 port 5433 執行。"
  exit 1
fi

# 確認 psql 可用（支援 Homebrew libpq 未加入 PATH 的情況）
PSQL=$(command -v psql 2>/dev/null \
  || ls /opt/homebrew/opt/libpq/bin/psql 2>/dev/null \
  || ls /usr/local/opt/libpq/bin/psql 2>/dev/null \
  || echo "")
if [[ -z "$PSQL" ]]; then
  echo "ERROR: psql 未安裝。請執行 brew install libpq"
  exit 1
fi

TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
echo "======================================================="
echo " Zentropy Flywheel Governance Eval — $TIMESTAMP"
echo "======================================================="

# -------------------------------------------------------
# 1. Brain Dump 全域概覽
# -------------------------------------------------------
echo ""
echo "=== [1] Brain Dump 全域概覽 ==="
$PSQL "$DB" -t -A -F'|' -c "
  SELECT
    COUNT(*)                                                        AS total_dumps,
    COUNT(DISTINCT user_id)                                         AS active_users,
    COUNT(*) FILTER (WHERE user_action = 'APPLIED')                 AS applied,
    COUNT(*) FILTER (WHERE user_action = 'EDITED')                  AS edited,
    COUNT(*) FILTER (WHERE user_action = 'CANCELLED')               AS cancelled,
    COUNT(*) FILTER (WHERE user_action = 'PENDING')                 AS pending,
    ROUND(COUNT(*) FILTER (WHERE user_action = 'EDITED')::numeric
      / NULLIF(COUNT(*),0)*100, 1)                                  AS edit_rate_pct,
    MIN(created_at)::date                                           AS first_date,
    MAX(created_at)::date                                           AS last_date,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS last_7d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30d
  FROM system_evaluation_logs
  WHERE type = 'BRAIN_DUMP'
" 2>&1

# -------------------------------------------------------
# 2. Per-User Brain Dump 明細
# -------------------------------------------------------
echo ""
echo "=== [2] Per-User Brain Dump 明細 ==="
echo "email|total|applied|cancelled|last_7d|last_active"
$PSQL "$DB" -t -A -F'|' -c "
  SELECT
    COALESCE(u.email, LEFT(sel.user_id::text, 8))                   AS email,
    COUNT(*)                                                        AS total,
    COUNT(*) FILTER (WHERE sel.user_action = 'APPLIED')             AS applied,
    COUNT(*) FILTER (WHERE sel.user_action = 'CANCELLED')           AS cancelled,
    COUNT(*) FILTER (WHERE sel.created_at >= NOW()-INTERVAL '7 days') AS last_7d,
    MAX(sel.created_at)::date                                       AS last_active
  FROM system_evaluation_logs sel
  LEFT JOIN users u ON u.id = sel.user_id
  WHERE sel.type = 'BRAIN_DUMP'
  GROUP BY u.email, sel.user_id
  ORDER BY total DESC
" 2>&1

# -------------------------------------------------------
# 3. 每日 Brain Dump 趨勢（近 14 天）
# -------------------------------------------------------
echo ""
echo "=== [3] 每日趨勢（近 14 天）==="
echo "date|count"
$PSQL "$DB" -t -A -F'|' -c "
  SELECT DATE(created_at) AS date, COUNT(*) AS count
  FROM system_evaluation_logs
  WHERE type = 'BRAIN_DUMP'
    AND created_at >= NOW() - INTERVAL '14 days'
  GROUP BY DATE(created_at)
  ORDER BY date
" 2>&1

# -------------------------------------------------------
# 4. Librarian Corrections（蒸餾觸發進度）
# -------------------------------------------------------
echo ""
echo "=== [4] Librarian Corrections（蒸餾門檻 = 10）==="
echo "email|corrections|last_correction"
$PSQL "$DB" -t -A -F'|' -c "
  SELECT
    COALESCE(u.email, LEFT(c.user_id::text, 8)) AS email,
    COUNT(*)                                     AS corrections,
    MAX(c.created_at)::date                      AS last_correction
  FROM poc_librarian.corrections c
  LEFT JOIN users u ON u.auth_provider_id = c.user_id
  GROUP BY u.email, c.user_id
  ORDER BY corrections DESC
" 2>&1 || echo "(poc_librarian.corrections 不可用)"

# -------------------------------------------------------
# 5. Librarian Rules（蒸餾品質）
# -------------------------------------------------------
echo ""
echo "=== [5] Librarian Rules 品質 ==="
echo "email|active_rules|total_rules|avg_confidence|applied_count|correct_count"
$PSQL "$DB" -t -A -F'|' -c "
  SELECT
    COALESCE(u.email, LEFT(r.user_id::text, 8)) AS email,
    COUNT(*) FILTER (WHERE r.is_active)          AS active_rules,
    COUNT(*)                                     AS total_rules,
    ROUND(AVG(r.confidence)::numeric, 3)         AS avg_confidence,
    SUM(r.times_applied)                         AS applied_count,
    SUM(r.times_correct)                         AS correct_count
  FROM poc_librarian.rules r
  LEFT JOIN users u ON u.auth_provider_id = r.user_id
  GROUP BY u.email, r.user_id
  ORDER BY active_rules DESC
" 2>&1 || echo "(poc_librarian.rules 不可用)"

# -------------------------------------------------------
# 6. 最近 15 筆 Tag 修正（Flywheel 原料樣本）
# -------------------------------------------------------
echo ""
echo "=== [6] 最近 15 筆 Tag 修正（Flywheel 原料）==="
echo "date|user_email|input_snippet|ai_predicted|user_corrected"
$PSQL "$DB" -t -A -F'|' -c "
  SELECT
    c.created_at::date                                                    AS date,
    COALESCE(u.email, LEFT(c.user_id::text, 8))                          AS user_email,
    LEFT(c.original_input, 60)                                           AS input_snippet,
    LEFT(c.ai_prediction::text, 60)                                      AS ai_predicted,
    LEFT(c.user_correction::text, 60)                                    AS user_corrected
  FROM poc_librarian.corrections c
  LEFT JOIN users u ON u.auth_provider_id = c.user_id
  ORDER BY c.created_at DESC
  LIMIT 15
" 2>&1 || echo "(poc_librarian.corrections 不可用)"


# -------------------------------------------------------
# 7. Episodic Memory L1：DailyPlanItem 估時偏差（report_done）
# -------------------------------------------------------
echo ""
echo "=== [7] Episodic Memory L1 — DailyPlanItem 估時偏差（近 90 天）==="
echo "email|total_samples|completed_with_actual|avg_ratio|overall_bias"
$PSQL "$DB" -t -A -F'|' -c "
  SELECT
    COALESCE(u.email, LEFT(dp.user_id::text, 8))     AS email,
    COUNT(dpi.id)                                     AS total_samples,
    COUNT(*) FILTER (WHERE dpi.actual_minutes IS NOT NULL)  AS completed_with_actual,
    ROUND(
      AVG(dpi.actual_minutes::numeric / NULLIF(dpi.estimated_minutes,0))
        FILTER (WHERE dpi.actual_minutes IS NOT NULL AND dpi.estimated_minutes > 0)
    , 2)                                              AS avg_ratio,
    CASE
      WHEN COUNT(*) FILTER (WHERE dpi.actual_minutes IS NOT NULL AND dpi.estimated_minutes > 0) < 3
        THEN 'cold_start'
      WHEN AVG(dpi.actual_minutes::numeric / NULLIF(dpi.estimated_minutes,0))
            FILTER (WHERE dpi.actual_minutes IS NOT NULL AND dpi.estimated_minutes > 0) > 1.3
        THEN 'underestimate'
      WHEN AVG(dpi.actual_minutes::numeric / NULLIF(dpi.estimated_minutes,0))
            FILTER (WHERE dpi.actual_minutes IS NOT NULL AND dpi.estimated_minutes > 0) < 0.7
        THEN 'overestimate'
      ELSE 'calibrated'
    END                                               AS overall_bias
  FROM daily_plan_items dpi
  JOIN daily_plans dp ON dp.id = dpi.plan_id
  LEFT JOIN users u ON u.id = dp.user_id
  WHERE dpi.completed = true
    AND dpi.estimated_minutes IS NOT NULL
    AND dpi.created_at >= NOW() - INTERVAL '90 days'
  GROUP BY dp.user_id, u.email
  ORDER BY total_samples DESC
" 2>&1

echo ""
echo "=== [7b] Episodic Memory L1 — 分 Area 偏差明細 ==="
echo "email|area|samples|avg_ratio"
$PSQL "$DB" -t -A -F'|' -c "
  SELECT
    COALESCE(u.email, LEFT(dp.user_id::text, 8))     AS email,
    dpi.area_name                                     AS area,
    COUNT(*)                                          AS samples,
    ROUND(
      AVG(dpi.actual_minutes::numeric / NULLIF(dpi.estimated_minutes,0))
    , 2)                                              AS avg_ratio
  FROM daily_plan_items dpi
  JOIN daily_plans dp ON dp.id = dpi.plan_id
  LEFT JOIN users u ON u.id = dp.user_id
  WHERE dpi.completed = true
    AND dpi.actual_minutes IS NOT NULL
    AND dpi.estimated_minutes > 0
  GROUP BY dp.user_id, u.email, dpi.area_name
  HAVING COUNT(*) >= 2
  ORDER BY u.email, samples DESC
" 2>&1

# -------------------------------------------------------
# 8. Episodic Memory L2：Task 層級估時偏差（auto-calc on ARCHIVE）
# -------------------------------------------------------
echo ""
echo "=== [8] Episodic Memory L2 — Task 估時偏差（estimated_duration_hours）==="
echo "email|tasks_with_estimate|tasks_with_actual|avg_ratio"
$PSQL "$DB" -t -A -F'|' -c "
  SELECT
    COALESCE(u.email, LEFT(t.user_id::text, 8))          AS email,
    COUNT(*) FILTER (WHERE t.estimated_duration_hours IS NOT NULL)   AS tasks_with_estimate,
    COUNT(*) FILTER (WHERE t.actual_duration_hours IS NOT NULL)      AS tasks_with_actual,
    ROUND(
      AVG(t.actual_duration_hours / NULLIF(t.estimated_duration_hours,0))
        FILTER (WHERE t.actual_duration_hours IS NOT NULL AND t.estimated_duration_hours > 0)
      ::numeric
    , 2)                                                             AS avg_ratio
  FROM tasks t
  LEFT JOIN users u ON u.id = t.user_id
  WHERE t.deleted_at IS NULL
  GROUP BY t.user_id, u.email
  HAVING COUNT(*) FILTER (WHERE t.estimated_duration_hours IS NOT NULL) > 0
  ORDER BY tasks_with_actual DESC
" 2>&1

# -------------------------------------------------------
# 9. coaching_memory 表（Episodic Memory 持久化層）
# -------------------------------------------------------
echo ""
echo "=== [9] coaching_memory 表狀況（Episodic Memory 持久化層）==="
$PSQL "$DB" -t -A -F'|' -c "
  SELECT
    COUNT(*)                                                        AS total_memories,
    COUNT(DISTINCT user_id)                                         AS unique_users,
    COUNT(*) FILTER (WHERE agent_type = 'rizo')                     AS rizo_memories,
    COUNT(*) FILTER (WHERE embedding IS NOT NULL)                   AS with_embedding,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS last_7d,
    MIN(created_at)::date                                           AS first_date,
    MAX(created_at)::date                                           AS last_date
  FROM coaching_memory
" 2>&1 || echo "(coaching_memory 表不可用)"

echo ""
echo "=== [9b] coaching_memory 分 category 分佈 ==="
echo "category|agent_type|count|avg_confidence"
$PSQL "$DB" -t -A -F'|' -c "
  SELECT
    category,
    agent_type,
    COUNT(*)                              AS count,
    ROUND(AVG(confidence)::numeric, 3)    AS avg_confidence
  FROM coaching_memory
  GROUP BY category, agent_type
  ORDER BY count DESC
" 2>&1 || echo "(coaching_memory 表不可用)"

# -------------------------------------------------------
# 10. report_done 閉環追蹤（MCP 工具使用）
# -------------------------------------------------------
echo ""
echo "=== [10] report_done 閉環追蹤（tasks ARCHIVE 近 30 天）==="
echo "email|archived_tasks|with_actual_hours|avg_actual_hrs"
$PSQL "$DB" -t -A -F'|' -c "
  SELECT
    COALESCE(u.email, LEFT(t.user_id::text, 8))                   AS email,
    COUNT(*) FILTER (WHERE t.status = 'ARCHIVE')                   AS archived_tasks,
    COUNT(*) FILTER (WHERE t.actual_duration_hours IS NOT NULL)    AS with_actual_hours,
    ROUND(AVG(t.actual_duration_hours)::numeric, 1)                AS avg_actual_hrs
  FROM tasks t
  LEFT JOIN users u ON u.id = t.user_id
  WHERE t.deleted_at IS NULL
    AND t.status = 'ARCHIVE'
    AND t.completed_at >= NOW() - INTERVAL '30 days'
  GROUP BY t.user_id, u.email
  ORDER BY archived_tasks DESC
" 2>&1

echo ""
echo "======================================================="
echo " End of Data"
echo "======================================================="
