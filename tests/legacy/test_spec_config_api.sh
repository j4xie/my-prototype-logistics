#!/bin/bash

# 规格配置API测试脚本

TOKEN="eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJwbGF0Zm9ybV8xIiwic3ViIjoicGxhdGZvcm1fMSIsImlhdCI6MTc2MjI0MDIwMSwiZXhwIjoxNzYyMzI2NjAxfQ.pD6eKgtQYA0O9FwVVB213FXfQJgrwWS0W2wlGRS5ico"
BASE_URL="http://localhost:10010"
FACTORY_ID="F001"

echo "========================================="
echo "原材料规格配置API测试"
echo "========================================="
echo ""

# Test API #4: Reset to default
echo "测试 API #4: 重置肉类规格为默认"
echo "-----------------------------------------"
curl -s -X DELETE "$BASE_URL/api/mobile/$FACTORY_ID/material-spec-config/肉类" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""
echo ""

# Test API #5: Get system defaults
echo "测试 API #5: 获取系统默认配置"
echo "-----------------------------------------"
curl -s "$BASE_URL/api/mobile/$FACTORY_ID/material-spec-config/system/defaults" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""
echo ""

# Verify reset worked - get meat category again
echo "验证重置: 再次获取肉类规格"
echo "-----------------------------------------"
curl -s "$BASE_URL/api/mobile/$FACTORY_ID/material-spec-config/肉类" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "========================================="
echo "测试完成"
echo "========================================="
