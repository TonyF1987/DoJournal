# 云函数超时配置指南

## 问题描述

OCR识别失败,提示错误:
```
errCode: -504003
errMsg: Invoking task timed out after 3 seconds
```

## 原因分析

云函数默认超时时间为3秒,但OCR识别流程需要:
1. 下载图片: 约2-5秒
2. 转换为base64: 约1-2秒
3. OCR识别: 约2-5秒
总计约5-12秒,超过了3秒的限制。

## 解决方案

### 方案1: 增加云函数超时时间(推荐)

#### 步骤1: 在云开发控制台配置超时时间

1. **打开云开发控制台**
   - 方法1: 在微信开发者工具中点击顶部菜单"云开发"
   - 方法2: 直接访问控制台: https://tcb.cloud.tencent.com/dev

2. **进入云函数管理**
   - 左侧菜单选择"云函数"
   - 找到 `ocrGeneral` 云函数

3. **修改超时时间**
   - 点击云函数名称进入详情页
   - 点击右上角"编辑"按钮
   - 找到"超时时间"配置项
   - 将默认的 `3秒` 改为 `20秒`
   - 点击"保存"

4. **重新部署云函数**
   - 返回微信开发者工具
   - 右键点击 `cloudfunctions/ocrGeneral` 文件夹
   - 选择"上传并部署:云端安装依赖"
   - 等待部署完成

#### 步骤2: 增加云函数内存(可选,提升性能)

在云开发控制台:
1. 进入 `ocrGeneral` 云函数详情页
2. 点击"编辑"
3. 将内存从默认的 `256MB` 改为 `512MB` 或 `1024MB`
4. 点击"保存"
5. 重新部署云函数

**注意**: 更高内存会消耗更多资源,但OCR识别速度会更快。

### 方案2: 压缩图片大小

在客户端上传图片前进行压缩:

```javascript
// 在 pages/add/add.js 中添加图片压缩
function compressImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: filePath,
      quality: 80,  // 压缩质量 0-100
      success: (res) => {
        resolve(res.tempFilePath)
      },
      fail: reject
    })
  })
}
```

在上传图片前调用:
```javascript
const compressedPath = await compressImage(originalPath)
```

### 方案3: 使用base64直接传递(绕过下载)

如果图片已经在客户端,可以直接传递base64,避免云函数下载:

1. 客户端将图片转为base64
2. 直接传递base64给云函数
3. 云函数直接调用OCR,无需下载

## 云函数配置说明

### 超时时间配置

云函数超时时间可在云开发控制台配置:
- **默认**: 3秒
- **最小**: 1秒
- **最大**: 60秒
- **推荐值**: 20秒(OCR场景)

### 内存配置

云函数内存影响执行速度:
- **256MB**: 基础配置,速度较慢
- **512MB**: 推荐配置,速度中等
- **1024MB**: 高性能配置,速度快
- **2048MB**: 最高性能,速度快但价格高

**费用说明**:
- 超时时间和内存都会影响云函数调用费用
- OCR功能不频繁时,使用512MB+20秒足够
- 免费额度内不产生费用

## 性能优化建议

### 1. 图片预处理

- 压缩图片到合适大小(建议500KB以内)
- 裁剪无关区域,只保留文字部分
- 调整图片分辨率(建议800-1200px宽度)

### 2. 异步优化

```javascript
// 使用Promise.all并行处理
const [tempFileURL, base64Image] = await Promise.all([
  getTempFileURL(imgUrl),
  convertToBase64(imgUrl)
])
```

### 3. 缓存优化

- 相同图片识别结果缓存30分钟
- 避免重复识别同一图片

### 4. 错误重试

```javascript
// 添加重试机制
async function callOCRWithRetry(base64Image, maxRetries = 2) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await cloud.openapi.ocr.printedText({ img: base64Image })
    } catch (err) {
      if (i === maxRetries - 1) throw err
      console.log(`OCR调用失败,第${i+1}次重试...`)
    }
  }
}
```

## 验证配置

### 检查云函数配置

1. 打开云开发控制台
2. 进入云函数详情页
3. 查看配置信息:
   - 超时时间: 应该显示 20秒
   - 内存: 应该显示 512MB 或更高

### 测试OCR功能

1. 打开小程序
2. 进入"添加作业"页面
3. 选择一张较小的图片(建议<500KB)
4. 观察识别结果和耗时

### 查看云函数日志

1. 云开发控制台 → 云函数 → 日志
2. 查看OCR调用的详细日志
3. 检查各步骤耗时:
   - 下载图片耗时
   - base64编码耗时
   - OCR识别耗时

## 常见问题

### Q1: 配置后仍然超时

**可能原因**:
1. 配置未生效,需要重新部署云函数
2. 图片太大,下载时间过长
3. OCR服务响应慢

**解决方法**:
1. 确认配置已保存并重新部署
2. 压缩图片大小
3. 增加超时时间到30秒

### Q2: 云函数调用费用过高

**可能原因**:
1. 超时时间设置过长
2. 内存设置过大
3. OCR调用过于频繁

**解决方法**:
1. 根据实际需求调整超时时间
2. 使用512MB内存(性价比最高)
3. 添加调用频率限制
4. 启用结果缓存

### Q3: 图片识别失败

**可能原因**:
1. 图片不清晰
2. 图片格式不支持
3. 图片损坏

**解决方法**:
1. 确保图片清晰,文字可见
2. 使用JPG或PNG格式
3. 检查图片是否完整

## 监控和调优

### 查看云函数调用统计

云开发控制台 → 云函数 → 统计分析
- 调用次数
- 成功率
- 平均耗时
- 错误率

### 性能指标参考

**正常指标**:
- 成功率: >95%
- 平均耗时: 5-15秒
- 错误率: <5%

**异常指标**:
- 成功率: <90%
- 平均耗时: >20秒
- 错误率: >10%

## 其他注意事项

1. **免费额度**: 云函数有免费额度,超量后需付费
2. **资源配额**: 每个环境有调用频率限制
3. **并发限制**: 云函数并发数有限制
4. **监控告警**: 建议配置监控和告警

## 技术支持

- 云开发文档: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/
- 云函数文档: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/functions.html
- 错误码文档: https://docs.cloudbase.net/error-code/basic/FUNCTIONS_TIME_LIMIT_EXCEEDED
