// 数据库初始化脚本
// 在微信开发者工具 -> 云开发 -> 数据库 中手动执行以下操作

/*
数据表结构：

1. users (用户表)
{
  _openid: String,        // 微信openid
  nickName: String,       // 昵称
  avatarUrl: String,      // 头像
  points: Number,         // 积分
  streak: Number,         // 连续打卡天数
  lastCheckInDate: String, // 最后打卡日期
  createTime: Date,       // 创建时间
  updateTime: Date        // 更新时间
}

2. homework (作业表)
{
  _openid: String,        // 微信openid
  title: String,          // 作业标题
  content: String,        // 作业内容
  type: String,           // 类型: 'manual'(手动), 'import'(导入), 'recurring'(周期)
  recurring: Boolean,     // 是否周期作业
  recurringDays: Array,   // 周期日: [1,3,5] 周一三五
  images: Array,          // 作业图片
  status: String,         // 状态: 'pending'(待完成), 'completed'(已完成)
  points: Number,         // 作业积分
  proofImage: String,     // 完成凭证图片
  checkInTime: Date,      // 打卡时间
  createTime: Date,       // 创建时间
  updateTime: Date        // 更新时间
}

3. rewards (奖励表)
{
  name: String,           // 奖励名称
  description: String,    // 奖励描述
  image: String,          // 奖励图片
  points: Number,         // 所需积分
  stock: Number,          // 库存
  createTime: Date        // 创建时间
}

4. exchange_records (兑换记录表)
{
  _openid: String,        // 微信openid
  userId: String,         // 用户ID
  rewardId: String,       // 奖励ID
  rewardName: String,     // 奖励名称
  rewardImage: String,    // 奖励图片
  pointsUsed: Number,     // 使用积分
  createTime: Date        // 创建时间
}

5. violations (违规行为表)
{
  _openid: String,        // 微信openid
  name: String,           // 违规行为名称
  points: Number,         // 扣除积分
  icon: String,           // 违规图标
  description: String,    // 违规描述
  isCustom: Boolean,      // 是否自定义
  createTime: Date,       // 创建时间
  updateTime: Date        // 更新时间
}

6. violationRecords (扣分记录表)
{
  _openid: String,        // 微信openid
  violationId: String,    // 违规行为ID
  violationName: String,  // 违规行为名称
  points: Number,         // 扣除积分
  icon: String,           // 违规图标
  createTime: Date        // 创建时间
}
*/

// 初始化奖励数据示例
/*
在微信开发者工具 -> 云开发 -> 数据库 -> 添加集合 "rewards"
然后在 rewards 集合中点击 "添加记录"，手动添加以下 5 条记录：

注意：在云开发控制台 GUI 中添加数据时，日期字段使用普通字符串格式，不要用 {"$date": "..."} 格式

记录 1：
{
  "name": "30分钟游戏时间",
  "description": "可以玩30分钟喜欢的游戏",
  "image": "/images/reward-game.png",
  "points": 50,
  "stock": 999,
  "createTime": "2026-01-16T00:00:00.000Z"
}

记录 2：
{
  "name": "看一部动画片",
  "description": "选择一部喜欢的动画片观看",
  "image": "/images/reward-tv.png",
  "points": 80,
  "stock": 999,
  "createTime": "2026-01-16T00:00:00.000Z"
}

记录 3：
{
  "name": "去游乐园",
  "description": "周末去一次游乐园",
  "image": "/images/reward-park.png",
  "points": 500,
  "stock": 10,
  "createTime": "2026-01-16T00:00:00.000Z"
}

记录 4：
{
  "name": "买一个心仪的玩具",
  "description": "价格100元以内的玩具",
  "image": "/images/reward-toy.png",
  "points": 1000,
  "stock": 5,
  "createTime": "2026-01-16T00:00:00.000Z"
}

记录 5：
{
  "name": "周末出去玩",
  "description": "可以选择去公园、博物馆等",
  "image": "/images/reward-weekend.png",
  "points": 300,
  "stock": 20,
  "createTime": "2026-01-16T00:00:00.000Z"
}
*/

// 索引建议：
/*
homework 集合添加索引：
- _openid: 1
- createTime: -1
- status: 1

users 集合添加索引：
- _openid: 1

rewards 集合添加索引：
- points: 1
- createTime: -1

exchange_records 集合添加索引：
- _openid: 1
- createTime: -1

violations 集合添加索引：
- _openid: 1
- createTime: -1

violationRecords 集合添加索引：
- _openid: 1
- createTime: -1
*/

// 初始化违规行为数据示例
/*
在微信开发者工具 -> 云开发 -> 数据库 -> 添加集合 "violations" 和 "violationRecords"

首先在 violations 集合中添加以下默认违规行为（如果代码自动初始化失败）：

记录 1：
{
  "name": "迟到",
  "points": 5,
  "icon": "⚠️",
  "description": "上学迟到或不按时完成作业",
  "isCustom": false,
  "createTime": "2026-01-16T00:00:00.000Z"
}

记录 2：
{
  "name": "未完成作业",
  "points": 10,
  "icon": "❌",
  "description": "未按时完成指定作业",
  "isCustom": false,
  "createTime": "2026-01-16T00:00:00.000Z"
}

记录 3：
{
  "name": "不认真听讲",
  "points": 5,
  "icon": "😠",
  "description": "上课不认真听讲或注意力不集中",
  "isCustom": false,
  "createTime": "2026-01-16T00:00:00.000Z"
}

记录 4：
{
  "name": "忘记带物品",
  "points": 5,
  "icon": "💢",
  "description": "忘记带课本、文具或其他必要物品",
  "isCustom": false,
  "createTime": "2026-01-16T00:00:00.000Z"
}

记录 5：
{
  "name": "表现差",
  "points": 20,
  "icon": "🚫",
  "description": "整体表现不佳或存在严重行为问题",
  "isCustom": false,
  "createTime": "2026-01-16T00:00:00.000Z"
}
*/
