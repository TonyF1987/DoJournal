// 数据库初始化参考
// 在微信开发者工具 -> 云开发 -> 数据库 中手动创建集合并配置权限
// 详细步骤见 DEPLOYMENT.md

/*
================================================================================
集合清单（当前版本）
================================================================================

必建集合：
  users                  用户账号
  families               家庭（多成员、多孩子）
  homework               作业
  checkins               打卡记录
  point_records          积分流水
  appConfig              应用配置（注册开关、管理员）
  registration_invitations  注册邀请码
  family_invitations     家庭邀请码

可选集合：
  violations             违规规则（也可通过 pages/violations 或 utils/initViolations.js 初始化）
  violationRecords       扣分记录

已废弃（旧版文档中的独立集合，请勿新建）：
  rewards                奖励已嵌入 users.children[] / families.children[]
  exchange_records       已改用 point_records

================================================================================
1. users（用户表）
================================================================================
{
  _openid: String,           // 微信 OpenID（同一 OpenID 可有多条记录，靠 account 区分）
  account: String,           // 账号标识（同 OpenID 多账号时使用）
  nickName: String,
  avatarUrl: String,
  phoneNumber: String,
  unionId: String,
  familyId: String,          // 所属家庭 ID（加入家庭后写入）
  familyRole: String,        // creator | admin | member
  children: Array,           // 未加入家庭时，孩子数据存于此
  currentChildId: String,    // 当前选中的孩子 ID
  createTime: Date,
  updateTime: Date
}

children[] 内嵌结构（与 families.children[] 相同）：
{
  id: String,
  name: String,
  avatarUrl: String,
  gender: String,
  birthDate: String,
  schoolStage: String,
  points: Number,            // 孩子积分
  streak: Number,            // 连续打卡天数
  lastCheckInDate: String,
  subjects: Array,           // 科目列表，如 [{ id, name }]
  rewards: Array,            // 奖励列表，如 [{ id, name, points, stock, image, description }]
  violations: Array,         // 惩罚规则列表
  createTime: Date
}

================================================================================
2. families（家庭表）
================================================================================
{
  name: String,
  members: Array,            // 家庭成员
  children: Array,           // 家庭共享的孩子列表（结构与 users.children[] 相同）
  createTime: Date,
  updateTime: Date
}

members[] 内嵌结构：
{
  openid: String,
  account: String,
  userId: String,
  nickName: String,
  avatarUrl: String,
  role: String,              // creator | admin | member
  readOnly: Boolean,         // 可选，只读成员
  permissions: {             // 细粒度权限，见 shared/cloud-permissions/permissions.js
    checkin: Boolean,
    homework: Boolean,
    subjects: Boolean,
    children: Boolean,
    rewards: Boolean,
    exchange: Boolean,
    ocr: Boolean,
    leaveFamily: Boolean,
    deleteAccount: Boolean
  },
  joinTime: Date
}

================================================================================
3. homework（作业表）
================================================================================
{
  _openid: String,
  childId: String,           // 关联孩子 ID
  title: String,
  content: String,
  subject: String,           // 科目名称
  type: String,              // manual | import | recurring
  recurring: Boolean,
  recurringDays: Array,      // 星期几，0=周日 … 6=周六，如 [1,3,5]
  recurringEndType: String,  // never | date | times
  recurringEndDate: String,  // YYYY-MM-DD（recurringEndType=date 时）
  recurringEndTimes: Number, // 重复次数（recurringEndType=times 时）
  recurringBatchId: String,  // 周期作业批次 ID，同批共享
  images: Array,
  status: String,            // pending | completed
  points: Number,
  homeworkDate: String,      // 作业日期 YYYY-MM-DD
  proofImage: String,
  checkInTime: Date,
  createTime: Date,
  updateTime: Date
}

================================================================================
4. checkins（打卡记录表）
================================================================================
{
  _openid: String,
  homeworkId: String,
  childId: String,
  checkinDate: String,       // YYYY-MM-DD
  proofImage: String,
  rating: Number,            // 评分
  comment: String,
  pointsEarned: Number,
  createTime: Date
}

================================================================================
5. point_records（积分流水表）
================================================================================
{
  _openid: String,
  childId: String,
  type: String,              // earn | spend | violation | cancel 等
  points: Number,            // 正数为获得，负数为消耗
  balance: Number,           // 操作后余额
  description: String,
  relatedId: String,         // 关联 homeworkId / rewardId 等
  createTime: Date
}

================================================================================
6. appConfig（应用配置表）
================================================================================
每条记录为一个 key-value 配置项：

// 注册开关（不存在时默认允许注册）
{
  key: 'registrationEnabled',
  value: true,
  createTime: Date,
  updateTime: Date
}

// 管理员账号（用于控制注册开关等）
{
  key: 'adminAccounts',
  value: [
    { openid: '管理员OpenID', account: '账号标识' }
  ],
  createTime: Date,
  updateTime: Date
}

================================================================================
7. registration_invitations（注册邀请码）
================================================================================
{
  code: String,
  used: Boolean,
  usedBy: String,
  createTime: Date,
  expireTime: Date
}

================================================================================
8. family_invitations（家庭邀请码）
================================================================================
{
  familyId: String,
  code: String,
  creatorOpenid: String,
  creatorAccount: String,
  used: Boolean,
  expireTime: Date,
  createTime: Date
}

================================================================================
9. violations / violationRecords（可选，旧版独立集合）
================================================================================
当前版本的奖励/惩罚主要嵌入在 children[].rewards / children[].violations 中。
violations 与 violationRecords 集合仍被 pages/violations 页面使用，可按需创建。

violations 示例：
{
  _openid: String,
  name: String,
  points: Number,
  icon: String,
  description: String,
  isCustom: Boolean,
  createTime: Date
}

violationRecords 示例：
{
  _openid: String,
  violationId: String,
  violationName: String,
  points: Number,
  icon: String,
  createTime: Date
}

================================================================================
奖励数据说明
================================================================================
奖励不再使用独立的 rewards 集合。首次使用时：
  - 在小程序「积分」页通过 manageRewards 云函数添加奖励
  - 或手动写入 users.children[].rewards / families.children[].rewards

奖励内嵌示例（写入 children[].rewards 数组）：
{
  "id": "reward_001",
  "name": "30分钟游戏时间",
  "description": "可以玩30分钟喜欢的游戏",
  "image": "/images/default-reward.png",
  "points": 50,
  "stock": 999
}

================================================================================
索引建议
================================================================================

homework:
  - _openid (升序)
  - childId (升序)
  - homeworkDate (升序)
  - recurringBatchId (升序)
  - status (升序)
  - createTime (降序)

users:
  - _openid (升序)
  - account (升序)

families:
  - members.openid (升序)

checkins:
  - homeworkId (升序)
  - checkinDate (升序)
  - _openid (升序)

point_records:
  - _openid (升序)
  - childId (升序)
  - createTime (降序)

appConfig:
  - key (升序)

family_invitations:
  - code (升序)
  - familyId (升序)

registration_invitations:
  - code (升序)

================================================================================
数据库权限建议
================================================================================
所有集合默认设置为：「所有用户可读，仅创建者可写」
业务权限校验在云函数层完成（permissions.js）。
*/
