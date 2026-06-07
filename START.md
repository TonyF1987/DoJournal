# 快速开始指南

欢迎使用 DoJournal（作业打卡）！本指南帮助你在约 15 分钟内从零完成本地搭建。

> 完整架构说明见 [README.md](README.md)，发布上线见 [DEPLOYMENT.md](DEPLOYMENT.md)。

---

## 一分钟快速启动（前提已配置）

若你已完成 AppID、云环境、数据库集合、云函数部署：

1. 用微信开发者工具导入本项目目录
2. 点击「编译」
3. 使用「真机调试」开始测试

---

## 完整启动步骤

### 步骤 1：准备环境

1. **安装微信开发者工具**
   - https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

2. **注册小程序**
   - https://mp.weixin.qq.com/
   - 获取 AppID（开发 → 开发管理 → 开发设置）

3. **Fork / Clone 项目**

```bash
git clone https://github.com/your-username/DoJournal.git
cd DoJournal
```

---

### 步骤 2：配置项目（2 分钟）

**修改 AppID** — [project.config.json](project.config.json)：

```json
{
  "appid": "你的小程序AppID"
}
```

**修改云环境 ID** — [app.js](app.js)：

```javascript
wx.cloud.init({
  env: 'your-env-id',  // 替换为你的云开发环境 ID
  traceUser: true
});
```

> 仓库内现有的 AppID 和环境 ID 仅为示例，请勿直接使用。

---

### 步骤 3：开通云开发（2 分钟）

1. 微信开发者工具打开项目
2. 顶部点击「云开发」→「开通」
3. 选择「按量计费 / 免费版」
4. 创建环境（如 `dojournal-dev`）
5. 复制环境 ID，填入 `app.js`

---

### 步骤 4：创建数据库集合（3 分钟）

云开发控制台 → 数据库 → 点击「+」创建以下集合：

| 集合 | 说明 |
|------|------|
| `users` | 用户账号 |
| `families` | 家庭 |
| `homework` | 作业 |
| `checkins` | 打卡记录 |
| `point_records` | 积分流水 |
| `appConfig` | 应用配置 |
| `registration_invitations` | 注册邀请码 |
| `family_invitations` | 家庭邀请码 |

**权限设置**（每个集合）：「所有用户可读，仅创建者可写」

可选集合：`violations`、`violationRecords`（违规功能，也可运行时初始化）

> 不要创建旧版 `rewards`、`exchange_records` 集合，奖励数据已嵌入孩子记录中。

数据模型详见 [database/init.js](database/init.js)。

**可选：配置管理员**（控制注册开关）

在 `appConfig` 集合添加一条记录：

```json
{
  "key": "adminAccounts",
  "value": [
    { "openid": "你的OpenID", "account": "" }
  ]
}
```

首次登录后可在云开发控制台 → 数据库 → `users` 中查看你的 `_openid`。

---

### 步骤 5：部署云函数（5 分钟）

在微信开发者工具中，右键各云函数文件夹 → **上传并部署：云端安装依赖**。

#### 第一批（认证，优先部署）

- `login`
- `handleAuth`
- `getUserInfo`

#### 第二批（家庭与孩子）

- `manageFamily`
- `manageChildren`
- `manageSubjects`

#### 第三批（作业）

- `addHomework`
- `updateHomework`
- `deleteHomework`
- `getHomework`
- `getHomeworks`
- `copyHomework`

#### 第四批（打卡与积分）

- `completeHomework`
- `cancelCheckin`
- `getCheckins`
- `getPointRecords`
- `exchangeReward`
- `manageRewards`

#### 第五批（其他）

- `deleteAccount`
- `ocrBaidu`（需要 OCR 功能时部署，并配置环境变量）

#### 可选（一般不需要）

- `generateRecurringTasks`（定时任务，当前版本周期作业在创建时已预生成）
- `ocrGeneral`、`checkinHomework`、`getPhoneNumber`（遗留/备用，可不部署）

**OCR 环境变量**（部署 `ocrBaidu` 后配置）：

| 变量名 | 说明 |
|--------|------|
| `BAIDU_OCR_API_KEY` | 百度 OCR API Key |
| `BAIDU_OCR_SECRET_KEY` | 百度 OCR Secret Key |

详见 [BAIDU_OCR_SETUP.md](BAIDU_OCR_SETUP.md)。

---

### 步骤 6：编译与测试

1. 点击「编译」
2. 推荐「真机调试」（模拟器部分功能受限）
3. 首次进入会引导登录/注册

---

## 推荐测试流程

### 1. 登录注册

- 首次打开 → 进入登录页
- 完成注册或使用邀请码（若关闭了开放注册）

### 2. 家庭与孩子

- 「我的」→ 创建家庭（或加入已有家庭）
- 添加/切换孩子（首页顶部可切换当前孩子）

### 3. 科目与作业

- 首页选择日期 → 进入科目 → 添加作业
- 测试手动添加、周期作业（选择星期几 + 重复次数）
- 测试 OCR 导入（需已配置 `ocrBaidu`）

### 4. 打卡

- 首页点击待完成作业 → 上传凭证 → 完成打卡
- 确认积分增加、连续天数更新

### 5. 积分与奖励

- 底部「积分」Tab → 添加奖励 → 兑换
- 查看积分流水

### 6. 周期作业编辑/删除

- 编辑周期作业 → 选择「仅修改当天」或「修改所有周期作业」
- 删除时同样可选择范围

### 7. 分享

- 打卡成功后 → 生成海报 → 保存到相册

---

## 界面说明

当前 TabBar 为三个 Tab（非旧版四 Tab）：

| Tab | 页面 | 功能 |
|-----|------|------|
| 首页 | `pages/index` | 日历、科目、作业列表、打卡入口 |
| 积分 | `pages/rewards` | 奖励、兑换、积分流水 |
| 我的 | `pages/me` | 家庭、权限、账号、设置 |

添加/编辑作业入口在首页科目视图中，非独立 Tab。

---

## 常见问题

### 云函数调用失败

1. 确认云函数已部署（云函数列表有绿色图标）
2. 确认 `app.js` 中环境 ID 正确
3. 云开发控制台 → 云函数 → 日志

### 首页作业列表为空

1. 确认已选择正确的孩子
2. 确认 `getHomeworks` 已部署
3. 检查数据库 `homework` 集合是否有对应 `childId` 的记录

### OCR 识别失败

1. 确认 `ocrBaidu` 已部署
2. 确认环境变量已配置
3. 参考 [CLOUD_FUNCTION_TIMEOUT.md](CLOUD_FUNCTION_TIMEOUT.md) 调整超时

### 数据库权限错误

所有集合设为「所有用户可读，仅创建者可写」。

---

## 项目结构速览

```
DoJournal/
├── app.js / app.json          # 入口
├── cloudfunctions/            # 24 个云函数
├── pages/
│   ├── index/                 # 首页
│   ├── add/                   # 添加/编辑作业
│   ├── checkin/               # 打卡
│   ├── rewards/               # 积分
│   ├── me/                    # 我的
│   ├── login/                 # 登录
│   └── accounts/              # 账号切换
├── utils/                     # 工具函数
├── shared/cloud-permissions/  # 权限模块
└── database/init.js           # 数据模型
```

---

## 下一步

1. **配置 OCR** — [BAIDU_OCR_SETUP.md](BAIDU_OCR_SETUP.md)
2. **完整部署与发布** — [DEPLOYMENT.md](DEPLOYMENT.md)
3. **测试清单** — [TESTING.md](TESTING.md)
4. **参与贡献** — [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 官方资源

- [微信小程序文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
