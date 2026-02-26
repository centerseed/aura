-- Rollback: remove blueprint columns from products
-- 執行方式：連接 Cloud SQL 後直接跑這個 SQL

ALTER TABLE products
  DROP COLUMN IF EXISTS blueprint_text,
  DROP COLUMN IF EXISTS blueprint_embedding,
  DROP COLUMN IF EXISTS blueprint_updated_at,
  DROP COLUMN IF EXISTS task_count_at_blueprint;

-- 同時需要從 _prisma_migrations 表移除這筆紀錄
DELETE FROM _prisma_migrations
  WHERE migration_name = '20260225000000_add_product_blueprint';
