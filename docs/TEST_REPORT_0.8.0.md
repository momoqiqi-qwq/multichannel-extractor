# 0.8.0 测试与验证报告

## 已执行检查

- `node scripts/check-config.mjs`
  - 版本与配置结构为 0.8.0 / schema 8。
  - 关键词收件、最高版本选择、Claude 解压目录启动和背景高级参数均有静态覆盖。
  - Claude BAT 资源哈希、PATH 检测命令和“不得包含个人绝对路径”检查通过。
- `node scripts/check-layout.mjs`
  - 路径映射、安全删除、预检查、任务恢复、暂停检查点、全局优先级和 ETA 静态检查通过。
  - 关键词自动加入/仅预览、打开扫描目录、逐文件 Claude 按钮和自定义背景入口检查通过。
- 使用 TypeScript 5.8 `transpileModule` 扫描 43 个 TS / Vue script 单元，0 个语法诊断。
- 使用临时 Tauri、Vue、Pinia 类型声明对全部纯 TypeScript 源文件执行 `tsc --strict --noEmit`，0 个诊断。
- 自定义 Vue 模板结构检查通过：22 个组件。
- Rust 字符串、注释和括号分隔符检查通过：15 个源文件。
- 两份 Claude BAT 字节一致；文件为 UTF-8 BOM + CRLF，并使用 `where claude`、`cd /d "%~dp0"` 与 `call claude --dangerously-skip-permissions`。
- 全项目扫描未发现开发机用户名或 Claude 的个人绝对安装路径。
- 最终源码 ZIP 创建后执行 `unzip -t`，并生成 SHA-256 文件。

## 重点实现检查

### 关键词收件与最高版本

- 每个通道独立保存目录、关键词、全部/任一匹配、递归、预发布和版本优先规则。
- 后端只保留受支持压缩格式，递归深度上限为 12。
- 版本比较按数字段进行，因此 `2.10.0` 高于 `2.9.9`；版本相同时回退到修改时间。
- Rust 源码包含 `2.10 > 2.9`、日期版本和忽略 `1080p` 干扰的单元测试；由于当前环境没有 Cargo，这些 Rust 单元测试未实际执行。
- 自动加入与仅预览两种模式、候选展开、手动加入、打开目录和清除结果均已接入。

### Claude 启动

- 通道按钮只读取最近成功任务的 `outputPath`。
- 文件按钮只读取对应成功文件自己的 `outputPath`。
- 后端再次要求目录真实存在并进行规范化，不会创建或回退到其他目录。
- Windows 启动器设置 `current_dir`，使用 `CREATE_NEW_CONSOLE | CREATE_NEW_PROCESS_GROUP` 创建新控制台，执行固定命令 `claude --dangerously-skip-permissions`，并返回 PID。
- 启动前可执行 `where claude` 和 `claude --version` 检测；生成的 BAT 同样通过系统 PATH 查找 Claude。

### 自定义背景

- 背景图片复制到应用数据目录，并限制格式与 25 MB 大小。
- 支持 cover / contain / stretch、焦点拖拽、X/Y、缩放、亮度、对比度、饱和度、模糊、透明度、暗化、暗角和遮罩颜色。
- 背景主开关在没有图片时禁用；移除图片时同步关闭，避免“开关打开但没有背景”的状态。
- 通道穿透和通道不透明度保持独立。

## 未完成的运行级验证

当前交付环境没有 Rust/Cargo 工具链，因此未执行 `cargo fmt`、`cargo check`、`cargo test` 和 Windows 原生进程启动测试。npm 依赖安装在超时前未完成，因此未执行 `vue-tsc`、Vite 生产构建和 Tauri 安装包构建。

因此，本次交付是经过静态、语法、纯 TS 语义、结构、资源和压缩包完整性检查的**源码包**，不是已运行验证的 Windows EXE。Claude 启动路径和命令已按 Windows API 逻辑修复，但仍需在安装了 Claude CLI 的 Windows 机器上进行最终冒烟测试。
