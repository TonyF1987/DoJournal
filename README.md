# README.md
# 儿童作业打卡小程序

一个有趣的儿童作业打卡小程序，帮助家长管理孩子的学习任务，通过积分奖励系统激励孩子完成作业。

## 功能特点

1. ✅ 手动添加作业
2. 📱 从微信群导入作业（支持图片/文字）
3. 📅 设置周期作业（自动重复）
4. ✅ 作业打卡并获取积分
5. 📤 分享打卡情况到朋友圈
6. 🎁 积分兑换奖励
7. 🔥 连续打卡奖励

## 技术栈

- 微信小程序原生框架
- 微信云开发（免费版）
- Canvas 2D 绘制分享海报

## 快速开始

### 1. 环境准备

- 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 注册微信小程序账号：[小程序注册](https://mp.weixin.qq.com/)
- 开通微信云开发

### 2. 项目配置

1. 打开 `project.config.json`
2. 将 `appid` 替换为你的小程序 AppID
3. 将 `app.js` 中的 `env: 'your_env_id'` 替换为你的云开发环境ID

### 3. 创建云开发环境

1. 在微信开发者工具中打开项目
2. 点击顶部菜单「云开发」
3. 开通云开发（选择免费版）
4. 记下环境ID，填入 `app.js`

### 4. 创建数据库集合

在云开发控制台的数据库中，创建以下4个集合：

- `users` - 用户表
- `homework` - 作业表
- `rewards` - 奖励表
- `exchange_records` - 兑换记录表

参考 `database/init.js` 文件中的详细表结构说明。

### 5. 初始化数据

在 `rewards` 集合中添加初始奖励数据（参考 `database/init.js`）。

### 6. 部署云函数

右键点击 `cloudfunctions` 目录下的每个云函数文件夹，选择「上传并部署」：
- login
- addHomework
- completeHomework
- exchangeReward
- generateRecurringTasks

### 7. 本地测试

1. 在微信开发者工具中点击「编译」
2. 使用真机预览或模拟器测试功能

## 功能使用说明

### 添加作业

1. 点击底部「添加作业」标签
2. 选择「手动添加」或「从聊天导入」
3. 填写作业标题和内容
4. 可选择设置周期作业
5. 设置作业积分（5/10/20/50分）
6. 点击「添加作业」

### 作业打卡

1. 在首页找到待完成的作业
2. 点击作业进入打卡页面
3. 拍照或从相册选择完成凭证
4. 点击「完成打卡」
5. 自动计算并发放积分

### 奖励兑换

1. 点击底部「奖励」标签
2. 查看可用奖励和所需积分
3. 点击「兑换」按钮
4. 确认后扣除积分

### 分享打卡

1. 打卡成功后点击「去分享」
2. 自动生成打卡海报
3. 保存到相册后可分享到朋友圈

## 积分规则

- 完成作业获得基础积分（5-50分）
- 连续打卡3天额外奖励5分
- 连续打卡天数越多，奖励越丰厚

## 周期作业

设置周期作业后，系统会在指定日期自动生成作业任务：
- 每日、每周等灵活设置
- 选择周一至周日任意组合
- 作业内容自动复制

## 数据库表结构

### users（用户表）
```json
{
  "_openid": "微信openid",
  "nickName": "昵称",
  "avatarUrl": "头像",
  "points": 积分,
  "streak": 连续打卡天数,
  "lastCheckInDate": "最后打卡日期",
  "createTime": "创建时间",
  "updateTime": "更新时间"
}
```

### homework（作业表）
```json
{
  "_openid": "微信openid",
  "title": "作业标题",
  "content": "作业内容",
  "type": "类型：manual/import/recurring",
  "recurring": true/false,
  "recurringDays": [1,3,5],
  "images": ["图片URL"],
  "status": "pending/completed",
  "points": 作业积分,
  "proofImage": "完成凭证",
  "checkInTime": "打卡时间",
  "createTime": "创建时间",
  "updateTime": "更新时间"
}
```

### rewards（奖励表）
```json
{
  "name": "奖励名称",
  "description": "奖励描述",
  "image": "奖励图片URL",
  "points": 所需积分,
  "stock": 库存,
  "createTime": "创建时间"
}
```

### exchange_records（兑换记录表）
```json
{
  "_openid": "微信openid",
  "userId": "用户ID",
  "rewardId": "奖励ID",
  "rewardName": "奖励名称",
  "rewardImage": "奖励图片",
  "pointsUsed": 使用积分,
  "createTime": "创建时间"
}
```

## 注意事项

1. **云开发免费版限制**：
   - 数据库容量：2GB
   - 存储容量：5GB
   - CDN流量：5GB/月
   - 云函数调用：15万次/月

2. **聊天导入功能**：
   - 需要在 `app.json` 中配置 `supportedMaterials`
   - 场景值：1173

3. **Canvas绘制**：
   - 小程序基础库版本 >= 2.9.0

## 定时任务

`generateRecurringTasks` 云函数需要配置定时触发器：
1. 在云开发控制台 -> 云函数 -> 定时触发器
2. 添加定时触发器，设置为每天凌晨执行

## 开发说明

### 目录结构

```
├── cloudfunctions/    # 云函数
│   ├── login/
│   ├── addHomework/
│   ├── completeHomework/
│   ├── exchangeReward/
│   └── generateRecurringTasks/
├── database/          # 数据库初始化脚本
├── images/            # 图片资源
├── pages/             # 页面文件
│   ├── index/         # 首页
│   ├── add/           # 添加作业
│   ├── checkin/       # 打卡
│   ├── rewards/       # 奖励商城
│   └── share/         # 分享海报
├── utils/             # 工具函数
├── app.js             # 小程序逻辑
├── app.json           # 小程序配置
├── app.wxss           # 全局样式
└── project.config.json # 项目配置
```

### 图标资源

需要在 `images/` 目录下准备以下图标：
- home.png / home-active.png（首页）
- add.png / add-active.png（添加）
- checkin.png / checkin-active.png（打卡）
- reward.png / reward-active.png（奖励）
- default-avatar.png（默认头像）
- default-reward.png（默认奖励图片）

## 常见问题

### 1. 云函数调用失败
检查环境ID是否正确，云函数是否已部署

### 2. 数据库查询失败
检查数据库权限设置，确保用户有读取权限

### 3. 图片上传失败
检查云存储是否开启，是否有足够的存储空间

### 4. Canvas绘制失败
检查小程序基础库版本是否 >= 2.9.0

## 后续优化建议

1. 添加家长监督功能
2. 引入OCR识别作业内容
3. 增加数据统计和图表
4. 添加成就系统
5. 支持多孩子账户
6. 增加更多奖励类型

## 许可证

MIT License

## 联系方式

如有问题，欢迎提Issue
