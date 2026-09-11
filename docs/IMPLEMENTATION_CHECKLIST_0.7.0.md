# 解压台 0.7.0 实现检查表

状态说明：`完成` 表示已落入源码并通过本次静态检查；`受限完成` 表示核心能力已实现，但受压缩格式或运行环境限制。

| 用户要求 | 状态 | 实现位置与验收依据 |
|---|---|---|
| 1. 应用关闭或崩溃后恢复未完成任务 | 完成 | `src/stores/taskCenter.ts` 将排队、处理中、暂停任务迁移为 `interrupted`；保存无密码 `jobSnapshot`；`src/stores/channels.ts` 提供单个、批量和自动恢复；`src/App.vue` 显示恢复横幅。恢复为任务级重新提交。 |
| 2. 开始前检查密码、磁盘空间、输出路径、冲突、不支持格式 | 完成 | `src-tauri/src/commands.rs::preflight_jobs`；`src-tauri/src/models.rs` 预检查模型；`src/services/tauri.ts` 调用；`RecoverySettings.vue` 提供开关、最低空间和估算倍率。密码检查为“是否填写”提示，正确性由解压器确认。 |
| 3. 树形输出预览 | 完成 | `src/components/StartReviewDialog.vue` 显示源文件、最终输出根目录、路径树、输出容器、层级、冲突策略和空间信息；错误项阻止提交。 |
| 4a. 暂停与继续 | 受限完成 | `src-tauri/src/task_control.rs`、`pause_job`、`resume_job`；内置解压与整理逻辑使用检查点；文件、通道、任务中心均有按钮。外部 RAR/7Z 进程只在调用边界响应。 |
| 4b. 文件优先级 | 完成 | `ArchiveFile.priority`；`ChannelFileQueue.vue` 三级选择；`src/domain/jobPlanner.ts` 全局高→普通→低分层调度。 |
| 4c. 通道模板导入导出 | 完成 | `src/stores/channelConfiguration.ts`、`src/services/tauri.ts`、`MaintenanceSettings.vue`；按名称合并，不覆盖工作区。 |
| 4d. 剩余时间估算 | 完成 | `TaskRecord.etaSeconds`；`taskCenter.ts` 按进度和有效运行时间估算，并扣除暂停时长；任务中心展示。 |
| 4e. 背景图片焦点拖拽 | 完成 | `AppearanceSettings.vue` 拖动预览、X/Y 滑杆和居中按钮；`services/appearance.ts` 生成背景位置。 |
| 5. 修改 README | 完成 | 根目录 `README.md` 已更新到 0.7.0，包含新功能、限制、使用、检查、迁移和隐私说明。 |
| 6. 总设置显示版本 | 完成 | `src/config/version.ts` 统一版本；`SettingsDrawer.vue` 标题版本芯片与侧栏底部；`AboutSettings.vue` 显示版本和配置结构。 |
| 7. 继续优化用户体验并生成结果 | 完成 | 可搜索分类设置、四种设置方案、恢复横幅、阻止项汇总、响应式设置布局、抽屉互斥、Esc 关闭、快捷恢复、错误退化提示。 |
| 8. 添加更多设置按钮、提高自由度 | 完成 | `GeneralSettings.vue` 设置方案和快捷动作；`RecoverySettings.vue` 预检查、恢复、暂停、ETA、优先级开关；`AppearanceSettings.vue` 焦点控制；`MaintenanceSettings.vue` 模板操作。 |
| 9. 逐项实现并最终检查 | 完成 | `scripts/check-config.mjs` 与 `scripts/check-layout.mjs` 已升级为 0.7.0 检查；本文件逐项记录；测试结果见 `TEST_REPORT_0.7.0.md`。 |

## 额外 UX 优化

- 设置抽屉使用搜索和分类侧栏，避免长页面反复滚动。
- “常规”页提供安全、均衡、极速、极简四种配置方案。
- 工作区顶部只在存在可恢复任务时显示恢复横幅。
- 暂停状态在文件、通道、任务中心和底部状态栏保持一致。
- 预检查不可用时退化为前端路径预览，不会静默跳过。
- 恢复任务默认高优先级，并明确提醒密码不会持久化。
- 通道透明度、背景显示、焦点位置都可独立控制。
- 设置、日志和任务中心保持互斥，不再相互遮挡。

## 验收边界

以下能力没有被夸大为“完全实现”：

1. 断点恢复是任务级重跑，不是归档字节级恢复。
2. 密码预检查只检查输入状态，无法在不尝试解压的情况下统一验证所有格式。
3. 输出树展示最终落地根路径和规则，不读取归档内每个条目。
4. 外部解压进程不能保证实时暂停。
5. 本交付环境缺少 Rust 工具链和本地 npm 依赖，未完成真正的 Tauri 二进制编译。
