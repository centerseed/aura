-- Fix: 安裝 pgvector 擴充
-- 用於支援 tasks 和 products 表的 embedding 欄位向量搜尋

CREATE EXTENSION IF NOT EXISTS vector;

-- 驗證安裝
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- 測試向量查詢（應該不會報錯）
-- SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector AS distance;
