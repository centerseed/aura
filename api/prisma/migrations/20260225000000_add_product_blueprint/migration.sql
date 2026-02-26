-- Add dynamic blueprint columns to products for improved brain dump classification
-- blueprint_text: concatenated text used to generate the embedding
-- blueprint_embedding: vector(768) computed from blueprint_text
-- blueprint_updated_at: when the blueprint was last refreshed
-- task_count_at_blueprint: task count when blueprint was last computed (for staleness check)

ALTER TABLE products
  ADD COLUMN blueprint_text TEXT,
  ADD COLUMN blueprint_embedding vector(768),
  ADD COLUMN blueprint_updated_at TIMESTAMPTZ,
  ADD COLUMN task_count_at_blueprint INT DEFAULT 0;
