# 阿里云OCR配置指南

## 概述

本项目已迁移到阿里云OCR服务,提供更稳定、更灵活的文字识别服务。

## 阿里云OCR优势

- **免费额度充足**: 每月1000次免费调用
- **无超时限制**: 不受云函数3秒超时限制
- **识别准确率高**: 通用文字识别准确率高达98%+
- **配置灵活**: 支持多种参数配置
- **性能优异**: 识别速度快,支持大图片

## 配置步骤

### 1. 注册阿里云账号

1. 访问 [阿里云官网](https://www.aliyun.com/)
2. 点击"免费注册",填写手机号完成注册
3. 完成实名认证(需要上传身份证)

### 2. 开通文字识别服务

1. 登录阿里云控制台
2. 进入"产品" → "人工智能" → "文字识别"
3. 点击"立即开通"
4. 选择"通用文字识别"
5. 点击"免费试用"或"开通服务"

**注意**: 首次开通可享受免费额度,无需付费。

### 3. 创建AccessKey

#### 方法1: 使用主账号AccessKey(快速测试)

1. 鼠标悬停在右上角账号图标上
2. 点击"AccessKey管理"
3. 点击"创建AccessKey"
4. 按照提示完成手机验证
5. 获取 **AccessKey ID** 和 **AccessKey Secret**

**重要**: 请妥善保管这两个密钥,不要泄露!

#### 方法2: 使用RAM子账号AccessKey(推荐,更安全)

1. 进入"访问控制" → "用户"
2. 点击"创建用户"
3. 填写用户信息,选择"编程访问"
4. 创建成功后,获取 **AccessKey ID** 和 **AccessKey Secret**
5. 为用户添加权限:
   - 找到创建的用户
   - 点击"添加权限"
   - 搜索"AliyunOCRFullAccess"
   - 点击确定添加

### 4. 配置云函数环境变量

在微信开发者工具中:

1. **打开云开发控制台**
   - 点击顶部菜单"云开发"
   - 或访问: https://tcb.cloud.tencent.com/dev

2. **进入云函数管理**
   - 左侧菜单选择"云函数"
   - 找到 `ocrGeneral` 云函数

3. **配置环境变量**
   - 点击云函数名称进入详情页
   - 点击"配置" → "环境变量"
   - 添加以下两个环境变量:

| 变量名 | 变量值 | 说明 |
|--------|--------|------|
| `ALIYUN_OCR_ACCESS_KEY_ID` | 你的AccessKey ID | 阿里云AccessKey ID |
| `ALIYUN_OCR_ACCESS_KEY_SECRET` | 你的AccessKey Secret | 阿里云AccessKey Secret |

4. 点击"保存"

### 5. 重新部署云函数

1. 返回微信开发者工具
2. 右键点击 `cloudfunctions/ocrGeneral` 文件夹
3. 选择"上传并部署:云端安装依赖"
4. 等待部署完成(约1-2分钟,因为需要安装阿里云SDK)

## 测试OCR功能

部署完成后,测试一下功能:

1. 打开小程序
2. 进入"添加作业"页面
3. 点击"从聊天导入"或选择图片
4. 上传包含文字的图片
5. 观察是否能正常识别并填充内容

## 阿里云OCR免费额度说明

- **通用文字识别**: 每月1000次免费调用
- **有效期**: 长期有效,按月重置
- **超出后**: 需要付费(约0.001元/次)
- **查看额度**: 在阿里云控制台的"文字识别"服务中查看

### 其他OCR服务的免费额度

阿里云OCR还提供多种识别服务:

| 服务名称 | 免费额度 | 说明 |
|---------|---------|------|
| 通用文字识别 | 1000次/月 | 识别印刷体文字 |
| 通用文字识别(高精版) | 50次/月 | 更高准确率 |
| 身份证识别 | 100次/月 | 识别身份证 |
| 驾驶证识别 | 100次/月 | 识别驾驶证 |
| 行驶证识别 | 100次/月 | 识别行驶证 |
| 营业执照识别 | 100次/月 | 识别营业执照 |

## API参数说明

### 云函数调用参数

```javascript
wx.cloud.callFunction({
  name: 'ocrGeneral',
  data: {
    imgUrl: 'cloud://xxx-xxx.xxx/xxx.jpg'  // 云存储文件ID或临时URL
  }
})
```

### 阿里云OCR接口参数

```javascript
const recognizeRequest = new OcrClient.RecognizeCharacterRequest({
  imageURL: imageUrl,      // 图片URL
  minHeight: 10,          // 最小字符高度(像素)
  outputProbability: false // 是否输出置信度
})
```

**参数说明**:
- `imageURL`: 图片URL,支持:
  - 云存储临时URL
  - HTTP/HTTPS URL(需要公开可访问)
- `minHeight`: 最小字符高度,默认10像素
  - 可以过滤掉较小的噪点
  - 建议值: 10-20像素
- `outputProbability`: 是否输出置信度
  - true: 输出每个文字的置信度
  - false: 只输出文字内容(推荐)

### 返回数据格式

```javascript
{
  errCode: 0,
  errMsg: 'ok',
  items: [
    {
      text: '识别出的文字',
      pos: {
        left_top: { x: 10, y: 20 },
        right_top: { x: 100, y: 20 },
        right_bottom: { x: 100, y: 50 },
        left_bottom: { x: 10, y: 50 }
      }
    }
  ]
}
```

## 常见问题

### Q1: 提示"阿里云OCR凭证未配置"

**原因**: 环境变量未正确配置

**解决方法**:
1. 检查环境变量名称是否正确:
   - `ALIYUN_OCR_ACCESS_KEY_ID`
   - `ALIYUN_OCR_ACCESS_KEY_SECRET`
2. 确认密钥值没有多余的空格
3. 重新部署云函数

### Q2: 提示"AccessKey ID或Secret不正确"

**原因**: AccessKey或Secret错误

**解决方法**:
1. 检查密钥是否复制完整
2. 确认密钥来自阿里云账号
3. 如果使用RAM用户,确认已授权`AliyunOCRFullAccess`权限
4. 重新创建AccessKey

### Q3: 提示"权限不足"

**原因**: RAM用户缺少权限

**解决方法**:
1. 进入阿里云"访问控制" → "用户"
2. 找到使用的RAM用户
3. 点击"添加权限"
4. 搜索并添加`AliyunOCRFullAccess`权限

### Q4: 部署失败,提示依赖安装错误

**原因**: 网络问题或依赖包安装失败

**解决方法**:
1. 检查网络连接是否正常
2. 重新尝试部署
3. 如果仍然失败,可以手动安装依赖:
   ```bash
   cd cloudfunctions/ocrGeneral
   npm install
   ```

### Q5: 识别结果不准确

**建议**:
1. 确保图片清晰,文字可见
2. 图片不要太小,建议宽度 > 500px
3. 文字尽量横向排列,不要歪斜
4. 使用拍照时确保对焦清晰
5. 尝试使用"高精版"API(但免费额度较少)

### Q6: 免费额度用完了怎么办?

**选项1: 等待下个月重置**
- 免费额度每月1号重置

**选项2: 购买付费套餐**
- 在阿里云控制台购买OCR服务套餐
- 价格非常便宜(约0.001元/次)

**选项3: 使用百度OCR**
- 百度OCR也提供免费额度(500次/天)
- 需要修改云函数代码

## 监控使用情况

### 查看阿里云OCR调用次数

1. 登录阿里云控制台
2. 进入"文字识别"服务
3. 查看应用的使用统计
4. 可以看到每月的调用次数和剩余免费额度

### 查看云函数日志

1. 在微信开发者工具中
2. 右键点击 `cloudfunctions/ocrGeneral`
3. 选择"云开发控制台" → "日志"
4. 可以查看OCR调用的详细日志

## 性能优化建议

1. **图片压缩**: 上传前压缩图片可以减少流量和识别时间
2. **缓存结果**: 如果同一图片识别多次,可以缓存结果
3. **使用CDN**: 将图片托管在CDN上,加快下载速度
4. **调整minHeight**: 适当调整最小字符高度,过滤噪点

## 安全建议

1. **不要在代码中硬编码密钥**: 始终使用环境变量
2. **定期更换密钥**: 建议每3-6个月更换一次
3. **使用RAM子账号**: 避免使用主账号AccessKey
4. **最小权限原则**: RAM用户只授予必需的权限
5. **监控异常调用**: 如果发现调用次数异常,立即检查密钥安全性
6. **不要将密钥提交到版本控制**: 确保项目文件中不包含密钥

## 与微信OCR对比

| 特性 | 阿里云OCR | 微信OCR |
|------|-----------|---------|
| 免费额度 | 1000次/月 | 无限制但受云函数限制 |
| 超时限制 | 无 | 云函数默认3秒 |
| 配置难度 | 中等(需要AccessKey) | 简单(云调用) |
| 识别准确率 | 98%+ | 95%+ |
| API调用速度 | 快(1-3秒) | 快(2-5秒) |
| 支持的图片格式 | JPG, PNG, BMP等 | JPG, PNG |
| 云函数依赖 | 需要安装阿里云SDK | 无需额外依赖 |
| 费用 | 超量后约0.001元/次 | 免费 |

**推荐选择**: 阿里云OCR更适合生产环境,因为无超时限制且免费额度充足。

## 技术支持

- **阿里云OCR文档**: https://help.aliyun.com/document_detail/480535.html
- **云开发文档**: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html
- **阿里云工单**: 在控制台可以提交工单咨询

## 注意事项

1. **环境变量配置**: 必须在云开发控制台配置环境变量
2. **重新部署**: 修改代码后必须重新部署云函数
3. **依赖安装**: 首次部署需要安装阿里云SDK,可能需要1-2分钟
4. **AccessKey安全**: 不要泄露AccessKey,定期更换
5. **免费额度**: 注意监控免费额度使用情况
6. **图片URL**: 图片URL必须是公开可访问的HTTP/HTTPS地址
7. **云函数超时**: 建议将云函数超时时间设置为20秒(虽然阿里云OCR无超时,但图片下载可能耗时)

## 故障排查流程

当OCR功能不工作时,按以下顺序检查:

1. ✅ 检查云函数是否已部署成功
2. ✅ 检查环境变量是否正确配置
3. ✅ 检查AccessKey是否有效且有权限
4. ✅ 检查图片URL是否可访问
5. ✅ 检查图片是否清晰可识别
6. ✅ 查看云函数日志获取详细错误信息
7. ✅ 检查阿里云控制台的调用统计
8. ✅ 确认免费额度未用完

如果以上步骤都无法解决问题,建议:
- 查看详细的错误日志
- 检查阿里云控制台的状态
- 联系阿里云技术支持

## 代码示例

### 完整的云函数调用示例

```javascript
// 前端调用
wx.cloud.callFunction({
  name: 'ocrGeneral',
  data: {
    imgUrl: 'cloud://xxx-xxx.xxx/xxx.jpg'
  },
  success: (res) => {
    if (res.result.errCode === 0) {
      // 提取识别到的文字
      const text = res.result.items
        .map(item => item.text)
        .join('\n')
      console.log('识别结果:', text)
    }
  },
  fail: (err) => {
    console.error('调用失败:', err)
  }
})
```

### 阿里云OCR直接调用示例(后端)

```javascript
const OcrClient = require('@alicloud/ocr20191230')
const OpenapiClient = require('@alicloud/openapi-client')
const TeaUtil = require('@alicloud/tea-util')

// 创建客户端
const config = new OpenapiClient.Config({
  accessKeyId: 'your-access-key-id',
  accessKeySecret: 'your-access-key-secret'
})
config.endpoint = 'ocr.cn-shanghai.aliyuncs.com'
const client = new OcrClient.default(config)

// 调用OCR
const request = new OcrClient.RecognizeCharacterRequest({
  imageURL: 'https://example.com/image.jpg',
  minHeight: 10,
  outputProbability: false
})

const response = await client.recognizeCharacterWithOptions(
  request,
  new TeaUtil.RuntimeOptions()
)

console.log(response.body.data.results)
```

## 其他OCR服务选择

如果阿里云OCR不能满足需求,还可以考虑:

### 百度OCR
- **优势**: 免费额度500次/天,识别准确率高
- **缺点**: 需要申请API Key
- **适用**: 需要更高准确率的场景

### 腾讯云OCR
- **优势**: 免费,云调用简单
- **缺点**: 受云函数3秒超时限制
- **适用**: 测试环境或小图片识别

目前阿里云OCR是最适合生产环境的选择,推荐使用。
