# jieyatai-2 代码结构复查

## 本版已经处理

1. **撤销状态独立**：最近操作与快照放到 `src/stores/workspaceHistory.ts`，避免继续塞进 `channels.ts`。
2. **工作区动作独立**：自动化方案与撤销恢复放到 `src/stores/channelWorkspaceActions.ts`。
3. **命令面板独立**：`CommandPalette.vue` 只负责命令搜索与执行入口，不把搜索 UI 塞进 `App.vue`。
4. **自动化 UI 独立**：`ChannelAutomationSettings.vue` 避免 `ChannelCard.vue` 继续膨胀。
5. **主 Store 体积控制**：`channels.ts` 保持在 1250 行项目警戒线以内。

## 仍值得继续优化，但建议下一轮再做

### 1. channels.ts 继续拆任务生命周期

当前 `channels.ts` 仍约 1200+ 行。下一步可把：

- preflight / StartReview；
- pause / resume / cancel；
- backend progress / batch finished 事件；

拆成 `channelTaskLifecycle.ts`。收益高，但涉及任务状态和恢复流程，建议单独一版做并补完整构建测试。

### 2. AppearanceSettings.vue 改成配置驱动

工作区开关越来越多，现在模板里仍是一项一项手写。可以改成配置数组：

- label；
- description；
- AppSettings key；
- 默认值；
- 搜索别名；

由一份元数据同时生成 UI、搜索索引和恢复默认逻辑。这样以后加一个开关，不需要改 3~4 个文件。

### 3. 统一确认/输入弹窗

项目仍有多处 `window.confirm` / `window.prompt`。建议做 `ConfirmDialog` / `PromptDialog`：

- 与主题一致；
- 支持危险级别；
- 支持 Enter / Esc；
- 可显示更详细的影响说明；
- 以后可以加入“本次不再提示”。

### 4. UI 面板状态集中管理

设置、日志、任务、项目、最近操作、命令面板的开关目前分散在不同 Store 和 `App.vue`。可以新增 `uiShellStore.ts`，统一保证“同一时间只打开一个主浮层”，减少互相关闭的重复代码。

### 5. 设置搜索改为自动索引

jieyatai-2 已有约 90 个具体设置搜索项，但 `settingsSearch.ts` 仍需要手动维护。建议让设置元数据自动生成搜索条目，避免以后新增开关后忘记加入搜索。

## 建议顺序

优先级建议：

1. 统一确认弹窗；
2. Appearance 设置配置驱动 + 自动搜索索引；
3. UI Shell Store；
4. channels.ts 任务生命周期继续拆分。

前两项最直接改善用户体验和后续新增设置的效率。
