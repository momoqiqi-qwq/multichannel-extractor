# 解压台 0.8.3 发布说明

## 通道项目目录直用

- 通道级“生成 Claude DAT”和“用 DAT 打开 Claude”不再弹出额外目录选择器。
- 指定目录模式直接使用通道的 `destination`。
- 跟随压缩包模式直接使用队列中压缩包的所在目录。
- 若通道尚未配置可用目录，只显示明确提示，不擅自改变通道设置。
- 文件级 Claude 按钮继续使用该文件成功解压返回的实际 `outputPath`。

## npm Claude CLI 探测

- 先通过 `where claude` 查找系统 PATH。
- 再读取 `NPM_CONFIG_PREFIX`、`APPDATA\npm`、`npm prefix -g` 和 `npm root -g`。
- 支持 npm 全局命令目录中的 `claude.cmd` / `claude.exe`。
- 支持读取官方 `@anthropic-ai/claude-code` 的 `package.json` bin 入口。
- 支持查找官方 Windows x64 / ARM64 原生包。
- 启动时使用已解析出的实际命令，不再要求桌面进程的 PATH 已刷新。
- 状态卡显示来源与实际可执行文件；未找到时提示 `npm install -g @anthropic-ai/claude-code`。

## 工程结构

- 新增独立 `src-tauri/src/claude_cli.rs`，把 npm 探测、包入口解析和版本检测从 `system_tools.rs` 中拆出。
- `system_tools.rs` 只保留 DAT 管理、启动命令窗口和外观资源工具。

## 版本

- npm、Tauri、Cargo 与应用内版本统一为 `0.8.3`。
- 配置架构保持 v9，本次无需迁移已有配置。
