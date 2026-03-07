# OCR服务开通指南

## 问题说明

错误码 `-604100 API not found` 表示OCR服务未在云开发环境中开通。

常见错误还包括:
- `Error: Cannot find module 'react'` - 云函数中包含了不必要的依赖

## 解决方案

### 方案1: 在云开发控制台开通OCR服务(推荐)

**步骤:**

1. **打开云开发控制台**
   - 在微信开发者工具中,点击顶部菜单"云开发"
   - 或访问: https://tcb.cloud.tencent.com/dev?envId=cloudbase-6gdin2lj657adc8c

2. **开通OCR服务**
   - 进入"设置" → "环境设置"
   - 找到"API服务"或"扩展能力"
   - 点击"开通"或"启用"OCR相关服务
   - 可能需要:
     - 开通"AI"服务
     - 启用"OCR通用印刷体识别"

3. **配置权限**
   - 确保config.json中配置了正确的权限:
   ```json
   {
     "permissions": {
       "openapi": [
         "ocr.general"
       ]
     }
   }
   ```

4. **重新部署云函数**
   - 右键 `cloudfunctions/ocrGeneral`
   - 选择"上传并部署:云端安装依赖"

### 方案2: 使用其他OCR服务

如果腾讯云OCR服务无法开通,可以考虑:

**选项A: 使用百度OCR**
1. 注册百度智能云账号
2. 开通OCR服务
3. 获取API Key和Secret Key
4. 修改云函数调用百度OCR API

**选项B: 使用阿里云OCR**
1. 注册阿里云账号
2. 开通文字识别服务
3. 获取AccessKey
4. 修改云函数调用阿里云OCR API

**选项C: 暂时禁用OCR功能**
使用当前代码,如果OCR服务未开通,会自动降级为手动输入模式。

### 方案3: 联系腾讯云技术支持

如果以上方法都不行:
1. 提交工单到腾讯云
2. 说明需要开通OCR服务
3. 提供环境ID: `cloudbase-6gdin2lj657adc8c`

## 当前临时方案

当前代码已经实现了降级处理:

**行为:**
1. 尝试调用OCR服务
2. 如果失败(OFR未开通),返回模拟数据
3. 前端检测到模拟数据,提示用户手动输入
4. 用户可以正常使用添加作业功能,只是不能自动识别

**用户体验:**
- 图片会正常上传和预览
- OCR识别失败时会友好提示
- 用户可以手动输入作业内容
- 不影响核心功能使用

## 测试步骤

### 测试1: OCR服务已开通
1. 选择图片
2. 点击"确定"识别
3. 看到"识别成功"提示
4. 内容自动填充

### 测试2: OCR服务未开通
1. 选择图片
2. 点击"确定"识别
3. 看到提示"OCR服务未开通,请手动输入作业内容"
4. 点击"手动输入"
5. 手动输入作业内容
6. 正常提交

## 长期建议

1. **优先开通OCR服务**
   - OCR服务可以大幅提升用户体验
   - 自动识别节省手动输入时间

2. **监控服务状态**
   - 定期检查OCR服务可用性
   - 做好降级方案

3. **用户引导**
   - 在首次使用时说明OCR功能
   - 如果服务不可用,清晰告知用户

## 技术细节

### OCR API调用方式

```javascript
// 方式1: 使用openapi(需要开通服务)
const ocrResult = await cloud.openapi.ocr.general({
  imgUrl: imageUrl
})

// 方式2: 直接调用腾讯云OCR API(需要Secret ID和Key)
const ocrResult = await tencentcloud.ocr.v20181119.GeneralBasicOCR({
  ImageBase64: base64Image
})
```

### 错误码说明

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| -604100 | API未找到 | 开通OCR服务 |
| -604101 | 参数错误 | 检查参数格式 |
| -604102 | 图片过大 | 压缩图片 |
| -604103 | 图片格式不支持 | 使用jpg/png格式 |

## 故障排除

### 常见错误及解决方案

**错误1: `Error: Cannot find module 'react'`**

- 问题原因: 云函数中包含了不必要的依赖
- 解决方案: 检查云函数代码，移除不需要的模块引用

**错误2: `API not found`**

- 问题原因: OCR服务未开通
- 解决方案: 按照上述方法开通服务

**错误3: `InvalidVersion: code: 400, Specified parameter Version is not valid`**

- 问题原因: API版本参数设置不正确或使用了错误的API调用方式
- 解决方案: 使用正确的API方法调用，如使用recognizeCharacter而非recognizeCharacterWithOptions

## 相关文档

- 腾讯云云开发OCR文档: https://cloud.tencent.com/document/product/636/39379
- 腾讯云OCR API文档: https://cloud.tencent.com/document/product/866/33526
- 微信小程序云函数文档: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html
- 部署脚本: deploy_ocr_fix.sh (用于修复常见的部署问题)
