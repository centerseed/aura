-- AlterTable
-- Add display_order column to products table
ALTER TABLE "products" ADD COLUMN "display_order" INTEGER NOT NULL DEFAULT 0;

-- Update existing products to have sequential display_order based on name
-- This ensures existing products maintain their current alphabetical order
WITH ordered_products AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY area_id ORDER BY name ASC) as row_num
  FROM products
  WHERE deleted_at IS NULL
)
UPDATE products
SET display_order = ordered_products.row_num
FROM ordered_products
WHERE products.id = ordered_products.id;
