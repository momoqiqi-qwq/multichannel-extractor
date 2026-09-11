# 0.8.1 测试报告

## 已执行

- `scripts/check-config.mjs`：版本、命令注册、配置、功能标记和界面结构检查通过。
- `scripts/check-layout.mjs`：层级映射、路径安全、恢复、暂停、优先级和 ETA 静态检查通过。
- `scripts/check-081.mjs`：每通道自动开始、Claude DAT、版本显示和 v8 迁移专项检查通过。
- 22 个 Vue 组件与 21 个 TypeScript 文件完成脚本语法检查。
- 使用本地类型桩完成 TypeScript/Vue 脚本轻量语义检查，0 个诊断。
- 15 个 Rust 文件完成字符串、注释、生命周期与分隔符词法结构检查。
- 最终源码清单、补丁应用比对、ZIP 完整性与 SHA-256 校验。

## 重点验证

- 自动开始只选择本次导入的文件 ID，并以 `pending` 状态自动提交，不会重跑旧失败项。
- `autoStartEnabled` 已覆盖通道默认值、旧工作区迁移、预设、配置导入导出、复制、恢复默认和应用到全部。
- `我的Claude项目.dat` 不存在时生成、存在时复用；Claude 工作目录固定为 DAT 所在的实际解压目录。
- DAT 中的命令字段仅作说明，后端实际执行命令固定为 `claude --dangerously-skip-permissions`。
- 应用版本在总设置标题、常用设置页和关于页显示为 0.8.1。

## 环境限制

npm 依赖安装在当前环境中超时，且环境没有 Rust/Cargo 工具链，因此未执行 `vue-tsc`、Vite/Tauri 完整构建、`cargo fmt`、`cargo check`、`cargo test` 和 Windows 原生 Claude 启动冒烟测试。交付物为经过静态、结构与轻量类型验证的源码包，不是 EXE。
