# 贡献指南

感谢你对 DoJournal 的关注！欢迎通过 Issue 和 Pull Request 参与贡献。

## 开始之前

1. 阅读 [README.md](README.md) 了解项目架构
2. 按 [START.md](START.md) 完成本地搭建
3. 在 Issue 中讨论较大改动，避免重复劳动

## 开发流程

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 完成修改并本地测试（参考 [TESTING.md](TESTING.md)）
4. 提交 Pull Request，说明改动内容与测试方式

## 代码规范

- 遵循项目现有风格：微信小程序原生 JS，云函数使用 `wx-server-sdk`
- 保持改动范围最小，不做无关重构
- 云函数内业务权限校验使用 `permissions.js`，不要绕过

## 修改云函数

每次修改 `cloudfunctions/` 下的代码后，需在微信开发者工具中重新 **上传并部署：云端安装依赖**，并在 PR 描述中注明需要部署的函数名。

## 修改权限模块

权限定义源码位于 [shared/cloud-permissions/permissions.js](shared/cloud-permissions/permissions.js)。

修改后需同步到所有含 `permissions.js` 的云函数目录，例如：

```bash
for dir in cloudfunctions/*/; do
  if [ -f "${dir}permissions.js" ]; then
    cp shared/cloud-permissions/permissions.js "${dir}permissions.js"
  fi
done
```

同步后重新部署相关云函数。前端拦截逻辑在 [utils/permissions.js](utils/permissions.js)，两处需保持一致。

## 修改数据库结构

- 在 [database/init.js](database/init.js) 中更新字段说明
- 在 [DEPLOYMENT.md](DEPLOYMENT.md) 中更新集合与索引说明
- 考虑旧数据兼容性

## 文档

若改动影响搭建、部署或使用方式，请同步更新 README.md 或相关指南。

## 提交信息

使用清晰的中文或英文提交说明，例如：

- `fix: 修复周期作业编辑后首页列表不刷新`
- `docs: 更新云函数部署清单`

## 问题反馈

提交 Issue 时请包含：

- 微信开发者工具版本
- 基础库版本
- 复现步骤
- 期望行为 vs 实际行为
- 相关云函数日志（如有）

## 许可证

贡献的代码将按 [MIT License](LICENSE) 发布。
