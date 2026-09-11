# 0.8.2 代码结构与体验复审

## 本次已采用的低风险优化

项目管理没有继续塞进 `channels.ts`，而是拆为：

- `src/stores/projectCenter.ts`：项目记录、去重、筛选、状态与独立持久化；
- `src/components/ProjectCenterDrawer.vue`：项目管理界面和用户操作；
- `src/styles/project-center.css`：独立样式；
- `channels.ts` 只在任务成功事件中把真实输出路径交给项目中心。

这样可以在不迁移现有工作区配置的情况下增加项目功能，也避免项目状态和解压队列生命周期互相污染。

## 仍建议优化，但本次没有擅自大改

### 1. 拆分 `channels.ts`（建议优先）

当前约 1249 行，已经接近静态检查上限，同时承担：

- 通道 CRUD；
- 文件导入与去重；
- 批次计划和预检查；
- 暂停、恢复、重试、取消；
- 后端事件回写；
- 工作区持久化；
- 多个子模块装配。

建议下一步拆出：

- `channelQueueActions.ts`：文件队列和优先级；
- `channelBatchActions.ts`：开始、预检查、批次、暂停恢复；
- `channelEventHandlers.ts`：进度、任务完成、批次完成；
- `workspacePersistence.ts`：状态保存和迁移入口。

预期收益是降低回归范围、减少循环依赖风险，并让单元测试可以直接覆盖每个动作模块。

### 2. 将 `AppSettings` 从扁平结构改为分域结构（收益高、迁移风险较高）

`AppSettings` 目前有大量扁平字段，外观、输出、可靠性、收件、项目工具混在同一接口中。建议目标结构：

```ts
settings.appearance
settings.output
settings.reliability
settings.inbox
settings.projectTools
settings.behavior
```

这会提升可读性，但需要配置 schema v10、旧配置迁移、设置页和导入导出同步修改。建议单独做一个版本，不与功能开发混在一起。

### 3. 统一确认弹窗与危险操作反馈（体验优先）

代码中仍有多处 `window.confirm`，样式、键盘行为和风险信息不统一。建议实现应用级确认对话框服务，支持：

- 危险级别与明确主按钮；
- 路径、文件数量、覆盖数量等结构化摘要；
- “本次不再提示”与设置项联动；
- 焦点管理、Esc 和 Enter 行为；
- 异步操作中的不可重复提交状态。

这是用户能直接感知的体验升级，也便于后续统一删除、恢复、覆盖和 Claude 危险参数确认。

### 4. 拆分 Rust `commands.rs`

`src-tauri/src/commands.rs` 约 613 行，建议按领域拆分：

- `commands/files.rs`
- `commands/extraction.rs`
- `commands/preflight.rs`
- `commands/project_tools.rs`

现有归档提取器已经有子模块，命令层也应采用相同边界。

### 5. 增加真正的自动化测试与可复现构建

当前专项检查主要验证字符串标记和静态结构，适合防止功能文件丢失，但不能证明行为正确。建议补充：

- Vitest：项目路径去重、状态排序、迁移与队列策略；
- Vue Test Utils：项目中心筛选、按钮忙碌态和空状态；
- Rust 单元测试：DAT 解析、路径校验、命令构造；
- Windows CI：`npm ci`、`vue-tsc`、`cargo test`、`tauri build`；
- 提交 `package-lock.json` 与 `Cargo.lock`，保证发布可复现。

## 项目中心后续可选能力

项目中心当前覆盖目录、状态、置顶、标签、备注和 Claude 操作。下一批可选：

- 项目配置导入导出与备份；
- 负责人、截止日期和下一步任务；
- Git 仓库状态、分支与未提交变更摘要；
- 最近文件、README 和常用命令快捷入口；
- 项目模板与批量归档；
- 目录失效检测和重新定位。

这些功能需要先确认项目中心要偏“轻量启动器”，还是逐步发展为“本地项目工作台”。
