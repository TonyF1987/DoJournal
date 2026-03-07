#!/bin/bash
# 部署 ocrGeneral 云函数的脚本

echo "开始部署 ocrGeneral 云函数..."

# 检查是否在项目根目录
if [ ! -f "project.config.json" ]; then
    echo "错误: 请在项目根目录下运行此脚本"
    exit 1
fi

# 检查云函数目录是否存在
if [ ! -d "cloudfunctions/ocrGeneral" ]; then
    echo "错误: cloudfunctions/ocrGeneral 目录不存在"
    exit 1
fi

echo "请按照以下步骤在微信开发者工具中部署:"
echo ""
echo "1. 在微信开发者工具中打开项目"
echo "2. 在左侧文件树中找到 cloudfunctions/ocrGeneral 文件夹"
echo "3. 右键点击 ocrGeneral 文件夹"
echo "4. 选择 '上传并部署:云端安装依赖'"
echo "5. 等待部署完成"
echo ""
echo "或者使用命令行部署(需要配置微信开发者工具CLI):"
echo ""
echo "macOS:"
echo '  /Applications/wechatwebdevtools.app/Contents/MacOS/cli upload --project "$(pwd)" --version "1.0.0" --desc "部署OCR云函数" -f ocrGeneral'
echo ""
echo "Windows:"
echo '  "C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" upload --project "%cd%" --version "1.0.0" --desc "部署OCR云函数" -f ocrGeneral'
echo ""
echo "部署完成后,可以在云开发控制台的云函数页面查看"
