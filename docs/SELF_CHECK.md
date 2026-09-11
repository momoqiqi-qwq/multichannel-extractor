# 自检查记录（0.6.0）

## 已执行的静态检查

- `package.json`、`tauri.conf.json`、`Cargo.toml` 版本一致性。
- `mainBinaryName = JieYaTai`、窗口任务栏、NSIS 图标和 capability 配置。
- 11 套主题和拆分后的 Vue、Store、CSS、Rust 文件存在性。
- 全部 Vue 文件唯一 `<script setup lang="ts">` 和顶层 `<template>` 检查。
- TypeScript 源文件及 Vue 脚本块严格类型桩检查。
- CSS 花括号平衡和主要文件行数阈值。
- 层级路径矩阵、根目录去重、默认替换、路径安全和结果清单标记检查。
- Rust 回归测试函数存在性和源码分隔符扫描。
- 上传 BAT 与内嵌资源逐字节 SHA-256 核对。
- Windows ICO 文件头和多尺寸目录检查。
- 最终 ZIP 完整性和 SHA-256 校验。

## Rust 测试源码覆盖

### 层级和落地

- `preserve_materializes_full_structure`
- `flatten_materializes_requested_depth`
- `flatten_zero_places_file_at_destination_root`
- `skip_outer_materializes_without_single_root`
- `matching_archive_wrapper_does_not_double_nest`
- `overwrite_policy_replaces_existing_file`
- `unsafe_archive_paths_are_rejected`

### 处理管线

- `tar_pipeline_applies_skip_outer`
- `corrupt_archive_does_not_create_destination`

## 安全删除检查点

- 每个成功任务写入独立 manifest。
- manifest 位置必须位于应用数据目录。
- 删除目标必须位于清单记录的输出根目录。
- 默认跳过曾替换旧内容的文件。
- 只删除本任务创建且已经为空的目录。
- 输出根目录缺失时按“已经删除”处理。

## BAT 一致性

资源文件与文档副本的 SHA-256 均应为：

```text
d27c8077620137c437f67da0e71e7bafe0f4846911c3cef23a3eb1bc5fe8c0e6
```

## 当前环境未能执行

- 当前容器没有 `cargo` / `rustc`，因此未执行 `cargo fmt`、`cargo check` 和真正的 `cargo test`。已额外检查归档子模块可见性、错误类型 Debug 派生、事件参数数量和 Rust 分隔符计数，并修正静态审查中发现的问题。
- 项目没有可用的 `node_modules`，因此未执行真实 `vue-tsc`、Vite 生产构建和 Tauri dev。
- Chromium 无头预览因容器缺少 D-Bus 而在 25 秒后超时，未生成截图；HTML 解析、内嵌 JavaScript 语法和 CSS 静态检查均通过。
- 未生成或实机启动 Windows EXE、NSIS、MSI。
- 未实际运行 `claude --dangerously-skip-permissions`，仅检查命令参数、工作目录和确认逻辑。

## Windows 发布前必须执行

```powershell
npm install
npm run check
npm run tauri dev
npm run tauri build
```

## 手工验收清单

1. ZIP、7Z、TAR 分别执行保留、展平 0/1/2 层和跳过外层。
2. 两个任务写入同一目标目录，确认按目标锁串行落地。
3. 重名文件确认后导入内容直接替换旧文件。
4. 损坏归档不留下空目标目录。
5. 完成、失败、取消和强制关闭应用后，任务中心状态正确。
6. 删除新增文件时不影响目标目录其他文件。
7. 覆盖旧文件后，默认删除结果仍保留该文件。
8. 显式开启高风险删除后，确认界面二次提示。
9. 在测试目录生成 BAT，并与上传原件进行二进制比较。
10. Claude 一键启动默认出现安全确认，并在选择目录作为工作目录启动。
11. 检查 EXE、任务栏、安装器、开始菜单和卸载器图标。
12. 确认最终 EXE 文件名是否接受 `JieYaTai.exe`。
