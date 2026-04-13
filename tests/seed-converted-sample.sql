SET client_encoding TO 'UTF8';
UPDATE product_samples
SET product_status = '已转报模'
WHERE id = (SELECT id FROM product_samples ORDER BY created_at LIMIT 1)
RETURNING id, name, product_status;
