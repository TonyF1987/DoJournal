#!/bin/bash

echo "正在部署更新后的OCR云函数..."

# 进入项目目录
cd "$(dirname "$0")"

# 安装cloudbase CLI（如果未安装）
if ! command -v cloudbase &> /dev/null; then
    echo "安装CloudBase CLI..."
    npm install -g @cloudbase/cli
fi

# 登录（需要手动操作）
echo "请在浏览器中完成登录认证..."
cloudbase login

# 部署云函数
echo "部署ocrGeneral云函数..."
cloudbase fn deploy ocrGeneral --force

echo "部署完成！请在微信开发者工具中测试OCR功能。"