#!/bin/bash
# OCR云函数修复和部署脚本

echo "开始修复OCR云函数..."

# 检查node_modules是否存在，不存在则安装依赖
if [ ! -d "node_modules" ]; then
  echo "安装项目依赖..."
  npm install
fi

# 检查云函数目录
if [ -d "cloudfunctions/ocrGeneral" ]; then
  echo "修复OCR云函数依赖问题..."
  
  # 进入云函数目录
  cd cloudfunctions/ocrGeneral
  
  # 重新安装云函数依赖
  rm -rf node_modules
  npm install
  
  # 验证阿里云OCR依赖是否正确安装
  if [ ! -d "node_modules/@alicloud/ocr20191230" ]; then
    echo "错误：阿里云OCR依赖未正确安装"
    echo "尝试重新安装 @alicloud/ocr20191230 ..."
    npm install @alicloud/ocr20191230 --save
  fi
  
  echo "OCR云函数修复完成"
  
  # 返回主目录
  cd ../..
else
  echo "错误：找不到云函数目录 cloudfunctions/ocrGeneral"
  exit 1
fi

echo "部署云函数..."
# 这里可以添加实际的部署命令
echo "请在微信开发者工具中右键点击 cloudfunctions/ocrGeneral 目录，选择'上传并部署'"

echo "修复完成！请确保已在云开发控制台配置阿里云OCR的环境变量："
echo "- ALIYUN_OCR_ACCESS_KEY_ID"
echo "- ALIYUN_OCR_ACCESS_KEY_SECRET"
echo ""
echo "注意：如果仍然出现'InvalidVersion'错误，请确保使用正确的API调用方法"