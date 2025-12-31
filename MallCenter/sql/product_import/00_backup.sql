-- =====================================================
-- 00_backup.sql - 备份现有商品数据
-- 执行前请在服务器上运行以下命令进行备份:
-- mysqldump -u mall_center -p'NMYxnNRGShxb3EZd' mall_center goods_spu goods_category goods_sku goods_spu_spec > /tmp/goods_backup_$(date +%Y%m%d_%H%M%S).sql
-- =====================================================

-- 本文件仅作说明，实际备份使用 mysqldump 命令
-- 备份完成后再执行后续的清空和导入脚本

SELECT 'Please run mysqldump command on server first!' AS reminder;
