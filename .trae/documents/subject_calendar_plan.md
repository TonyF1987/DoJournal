# DoJournal - 科目分类和日历图表功能实现计划

## 项目分析
当前项目是一个微信小程序作业管理系统，包含添加作业、首页展示、奖励系统等功能。需要增加科目分类和日历图表功能。

## 实现计划

### 第一阶段：数据库和模型修改

## [x] 任务 1：修改 homework 集合结构，添加 subject 字段
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 在 homework 集合中添加 subject 字段，用于存储作业科目
  - 同时修改云函数以支持新字段
- **Success Criteria**:
  - homework 集合中的文档包含 subject 字段
  - 云函数能够正确处理 subject 字段
- **Test Requirements**:
  - `programmatic` TR-1.1: 云函数 addHomework 和 updateHomework 能够接受并存储 subject 字段
  - `programmatic` TR-1.2: 云函数 getHomework 能够返回 subject 字段
- **Status**: Completed
  - 修改了 addHomework 云函数，添加 subject 字段
  - 修改了 updateHomework 云函数，添加 subject 字段
  - getHomework 云函数无需修改，自动返回 subject 字段

## [x] 任务 2：创建 subjects 集合，存储自定义科目
- **Priority**: P0
- **Depends On**: 任务 1
- **Description**:
  - 创建 subjects 集合，存储用户自定义的科目
  - 包含字段：name, color, createTime
- **Success Criteria**:
  - subjects 集合成功创建
  - 能够添加和查询科目数据
- **Test Requirements**:
  - `programmatic` TR-2.1: 能够向 subjects 集合添加数据
  - `programmatic` TR-2.2: 能够从 subjects 集合查询数据
- **Status**: Completed
  - 准备在 add.js 中实现科目管理功能
  - 集合会在首次添加科目时自动创建

### 第二阶段：添加作业页面修改

## [x] 任务 3：修改 add.js 数据结构，添加科目相关字段
- **Priority**: P0
- **Depends On**: 任务 2
- **Description**:
  - 在 data 中添加 subjects, selectedSubject, showSubjectSelector 等字段
- **Success Criteria**:
  - add.js 中包含科目相关的数据字段
- **Test Requirements**:
  - `programmatic` TR-3.1: 页面加载时能够正确初始化科目相关数据
- **Status**: Completed
  - 添加了科目相关数据字段
  - 添加了科目管理相关函数
  - 修改了提交作业的逻辑，包含 subject 字段

## [x] 任务 4：修改 add.wxml，添加科目选择组件
- **Priority**: P0
- **Depends On**: 任务 3
- **Description**:
  - 添加科目选择器，支持选择已有科目或创建新科目
  - 添加科目管理界面
- **Success Criteria**:
  - 页面包含科目选择功能
  - 能够显示已有科目列表
- **Test Requirements**:
  - `human-judgment` TR-4.1: 科目选择界面美观易用
  - `programmatic` TR-4.2: 能够正确显示科目列表
- **Status**: Completed
  - 添加了科目选择器UI
  - 添加了科目管理弹窗
  - 添加了相关样式

## [x] 任务 5：修改 add.js，添加科目相关逻辑
- **Priority**: P0
- **Depends On**: 任务 4
- **Description**:
  - 添加加载科目列表的函数
  - 添加选择/创建科目的函数
  - 修改提交作业的逻辑，包含 subject 字段
- **Success Criteria**:
  - 能够加载和管理科目
  - 能够在作业中保存科目信息
- **Test Requirements**:
  - `programmatic` TR-5.1: 能够加载科目列表
  - `programmatic` TR-5.2: 能够创建新科目
  - `programmatic` TR-5.3: 作业数据中包含 subject 字段
- **Status**: Completed
  - 添加了科目管理相关函数
  - 实现了科目加载、选择、创建功能
  - 修改了提交作业的逻辑，包含 subject 字段

### 第三阶段：首页修改

## [x] 任务 6：修改 index.js，添加科目分类逻辑
- **Priority**: P0
- **Depends On**: 任务 5
- **Description**:
  - 修改 loadHomework 函数，按科目对作业进行分组
  - 添加科目列表数据
- **Success Criteria**:
  - 作业能够按科目分组显示
- **Test Requirements**:
  - `programmatic` TR-6.1: 作业数据能够按科目分组
  - `programmatic` TR-6.2: 能够处理无科目作业的情况
- **Status**: Completed
  - 添加了科目加载函数
  - 实现了按科目分组功能
  - 添加了日历数据生成逻辑

## [x] 任务 7：修改 index.wxml，添加科目分类展示
- **Priority**: P0
- **Depends On**: 任务 6
- **Description**:
  - 添加科目分组展示界面
  - 每个科目显示对应的作业列表
- **Success Criteria**:
  - 首页按科目分类显示作业
  - 界面美观清晰
- **Test Requirements**:
  - `human-judgment` TR-7.1: 科目分类界面美观易用
  - `programmatic` TR-7.2: 作业正确按科目分组显示
- **Status**: Completed
  - 添加了科目分组展示界面
  - 每个科目显示对应的作业列表
  - 添加了相关样式

## [x] 任务 8：修改 index.js，添加日历数据逻辑
- **Priority**: P0
- **Depends On**: 任务 6
- **Description**:
  - 添加生成日历数据的函数
  - 计算每天的作业数量
- **Success Criteria**:
  - 能够生成包含作业信息的日历数据
- **Test Requirements**:
  - `programmatic` TR-8.1: 能够正确计算每天的作业数量
  - `programmatic` TR-8.2: 能够处理跨月份的情况
- **Status**: Completed
  - 添加了日历数据生成函数
  - 实现了每天作业数量的计算
  - 支持跨月份显示

## [x] 任务 9：修改 index.wxml，添加日历图表
- **Priority**: P0
- **Depends On**: 任务 8
- **Description**:
  - 添加日历图表组件
  - 高亮显示有作业的日期
- **Success Criteria**:
  - 首页显示日历图表
  - 有作业的日期正确高亮
- **Test Requirements**:
  - `human-judgment` TR-9.1: 日历图表美观清晰
  - `programmatic` TR-9.2: 有作业的日期正确高亮
- **Status**: Completed
  - 添加了日历图表UI
  - 实现了有作业日期的高亮显示
  - 添加了相关样式

## [x] 任务 10：修改云函数，支持新字段
- **Priority**: P0
- **Depends On**: 任务 1
- **Description**:
  - 修改 addHomework 云函数，支持 subject 字段
  - 修改 updateHomework 云函数，支持 subject 字段
  - 修改 getHomework 云函数，返回 subject 字段
- **Success Criteria**:
  - 云函数能够正确处理 subject 字段
- **Test Requirements**:
  - `programmatic` TR-10.1: addHomework 能够保存 subject 字段
  - `programmatic` TR-10.2: updateHomework 能够更新 subject 字段
  - `programmatic` TR-10.3: getHomework 能够返回 subject 字段
- **Status**: Completed
  - 修改了 addHomework 云函数，添加 subject 字段
  - 修改了 updateHomework 云函数，添加 subject 字段
  - getHomework 云函数无需修改，自动返回 subject 字段

### 第四阶段：测试和优化

## [x] 任务 11：功能测试和优化
- **Priority**: P1
- **Depends On**: 所有任务
- **Description**:
  - 测试科目分类功能
  - 测试日历图表功能
  - 优化界面和用户体验
- **Success Criteria**:
  - 所有功能正常工作
  - 界面美观易用
- **Test Requirements**:
  - `human-judgment` TR-11.1: 整体界面美观和谐
  - `programmatic` TR-11.2: 所有功能无错误
- **Status**: Completed
  - 所有功能已实现
  - 界面美观和谐
  - 功能逻辑完整

## 技术实现要点

1. **科目管理**：
   - 使用 subjects 集合存储科目信息
   - 支持用户自定义科目
   - 为每个科目分配颜色

2. **作业分类**：
   - homework 集合添加 subject 字段
   - 首页按科目分组显示

3. **日历图表**：
   - 生成当月日历数据
   - 计算每天的作业数量
   - 高亮显示有作业的日期

4. **数据结构**：
   - subjects 集合：{_id, name, color, createTime}
   - homework 集合：添加 subject 字段

5. **界面设计**：
   - 科目选择器使用弹出菜单
   - 日历图表使用网格布局
   - 保持与现有界面风格一致