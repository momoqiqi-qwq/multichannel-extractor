# 代码结构审查（0.6.0）

## 本轮完成的拆分

### Rust 解压模块

原 `archive.rs` 同时负责格式识别、解码、路径校验、层级映射和冲突处理，已拆成：

| 模块 | 约行数 | 责任 |
|---|---:|---|
| `archive/mod.rs` | 229 | 管线编排、输出报告、集成测试 |
| `archive/extractors.rs` | 336 | ZIP、7Z、RAR、TAR 与流格式原始提取 |
| `archive/layout.rs` | 401 | 路径重映射、根目录去重、落地及层级测试 |
| `archive/collision.rs` | 138 | 覆盖、重命名、跳过和原子式落地 |
| `archive/path_safety.rs` | 86 | 归档路径、目标符号链接与垃圾文件过滤 |
| `archive/kind.rs` | 92 | 格式识别 |
| `archive/error.rs` | 22 | 统一错误类型 |

拆分后单个 Rust 归档模块均低于 600 行。

### 前端状态

原 `channels.ts` 中的通用逻辑已拆出：

- `taskCenter.ts`：任务历史、异常中断恢复、结果删除。
- `settings.ts`：全局设置入口。
- `notifications.ts`：Toast 队列。
- `channelSelectors.ts`：筛选、排序与分组。
- `channelOutputActions.ts`：打开与安全删除结果。
- `channelProjectTools.ts`：BAT 生成和 Claude 启动。
- `channelConfiguration.ts`：预设、配置导入导出和恢复默认。

`channels.ts` 从约 958 行降至约 814 行，目前主要作为工作区编排门面，保持组件调用接口稳定。

### Vue 组件与样式

- `ChannelCard.vue` 从约 443 行降至约 318 行。
- 文件队列、输出位置、层级设置拆成三个子组件。
- `SettingsDrawer.vue` 从约 416 行降至约 45 行，六个设置页签独立组件化。
- `style.css` 从约 2,947 行降为 7 行导入入口，规则拆到 `src/styles/`。

## 可靠性设计审查

### 已完成

1. **结果清单删除**：删除范围由每个成功任务的 manifest 决定，不执行“清空目标目录”。
2. **替换文件保护**：被覆盖的旧路径默认不进入可删除范围。
3. **同目标目录串行化**：完全相同的最终目标路径使用独立信号量。
4. **原子式替换**：临时文件写完后再替换目标，并尽力恢复备份。
5. **符号链接防护**：目标路径组件存在符号链接时拒绝落地和删除。
6. **失败不留空目录**：原始归档提取成功后才建立最终输出位置。
7. **异常退出恢复**：持久化中的活动任务恢复为“异常中断”。
8. **危险命令确认**：Claude 高权限模式默认显示确认。

## 仍值得优化的结构

### 1. `channels.ts` 仍是最大的业务编排文件

当前约 814 行，仍包含：

- 通道 CRUD；
- 文件导入和重复策略；
- 路径对话框；
- 批次启动、取消和重跑；
- Tauri 事件映射；
- 工作区状态同步。

建议下一步拆成：

- `channelWorkspace.ts`：CRUD、分类、排序、折叠；
- `channelImports.ts`：文件发现、格式过滤、重复项；
- `taskRuntime.ts`：批次提交、事件监听、取消和重跑；
- `channels.ts`：只组合各模块并提供兼容门面。

### 2. `commands.rs` 约 398 行

建议拆为：

- `commands/extraction.rs`
- `commands/filesystem.rs`
- `commands/project_tools.rs`
- `runtime/task_registry.rs`

这样目标锁、取消令牌和命令参数不会继续集中在一个文件。

### 3. `archive/extractors.rs` 仍集合全部格式

虽然已从主模块拆出，但下一次增加格式或密码逻辑时仍会扩大。建议按格式拆为 `zip.rs`、`tar.rs`、`sevenz.rs`、`rar.rs`、`streams.rs`，并由统一 trait 或枚举分派。

### 4. `archive/layout.rs` 仍同时承担计划和执行

可进一步拆为：

- `layout/planner.rs`：目录深度与公共根目录分析；
- `layout/materializer.rs`：目录创建和文件落地；
- `layout/report.rs`：写入/替换统计。

### 5. `base.css` 约 1,121 行

样式入口已经拆开，但 `base.css` 仍过大。建议继续分为：

- `tokens.css`
- `buttons.css`
- `forms.css`
- `drawers.css`
- `feedback.css`

### 6. 历史数据应从 localStorage 迁移到 SQLite

任务记录继续增长时，localStorage 的同步序列化会阻塞 UI，也不适合保存大量错误文本。建议采用 Tauri SQL/SQLite，并增加分页和索引。

### 7. 路径锁只识别完全相同路径

`D:\output` 与 `D:\output\project` 仍可能并发写入。建议使用规范化路径树或祖先/后代冲突检测，形成“目标范围锁”。

### 8. 真正的解压暂停尚未实现

当前支持取消和重新运行，但不是可恢复暂停。内部 Rust 解压器可在文件边界暂停，外部 RAR 工具则需要进程控制；应先定义统一能力模型，不要让 UI 对所有格式承诺相同行为。

## 建议你确认的下一轮优化

推荐将 0.7.0 聚焦为“可发布验证版”，优先级如下：

1. Windows CI 自动构建 EXE、NSIS 和 MSI。
2. 真实 ZIP/7Z/TAR/加密包/损坏包测试夹具。
3. 目标范围锁和结果清单篡改测试。
4. 任务历史 SQLite 化与分页。
5. 解压前真实归档结构预览。

“真正暂停恢复”和“更多压缩格式”建议在上述可靠性基础完成后再做。
