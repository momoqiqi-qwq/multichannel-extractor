# 解压台 0.7.0 测试与验证报告

## 已执行

### 静态配置检查

命令：

```bash
node scripts/check-config.mjs
```

覆盖：

- package、Tauri、Cargo 版本一致且为 0.7.0；
- 新增组件、后端模块和文档是否存在；
- 预检查、恢复、暂停、优先级、ETA、模板、背景焦点和版本显示关键标记；
- Tauri 命令注册、磁盘空间依赖、资源权限和图标；
- Vue 顶层脚本/模板结构；
- CSS 花括号、抽屉层级和响应式布局；
- 关键文件规模约束。

### 层级与可靠性检查

命令：

```bash
node scripts/check-layout.mjs
```

覆盖：

- 保留、展平、保留 N 层、跳过外层的路径示例；
- 同名根目录去重、覆盖策略、路径安全和垃圾文件过滤标记；
- 安全删除清单；
- 预检查磁盘空间、保留空间和冲突提示；
- `TaskControl` 暂停/取消检查点；
- 高、普通、低全局优先级调度；
- v2 任务历史和中断恢复快照。

### TypeScript 语法扫描

使用本机全局 TypeScript `transpileModule` 扫描全部 `.ts` 和 Vue `<script setup lang="ts">` 区块，结果为 0 个语法错误。

### 轻量语义类型检查

将全部 TypeScript 和 Vue 脚本区块镜像到临时目录，并使用最小 Vue、Pinia、Tauri 类型桩执行严格 `tsc --noEmit`。该检查用于发现跨文件类型错误，结果无诊断。

这不是 `vue-tsc` 的替代品，不检查模板表达式与真实依赖类型的全部细节。

### 归档与校验

最终交付前执行：

- 删除临时类型检查目录；
- 生成源码 SHA-256 清单；
- 创建 ZIP；
- 使用 `unzip -t` 检查 ZIP 完整性；
- 计算交付 ZIP 的 SHA-256。

## 未执行

### 前端正式构建

未执行完整：

```bash
npm install
npm run build
```

原因：当前环境没有项目本地 npm 依赖，先前安装尝试超时。虽然系统有全局 TypeScript，但没有可替代真实 `vue-tsc`、Vite 和 Vue 插件依赖的完整构建环境。

### Rust 编译、格式与测试

未执行：

```bash
cargo fmt --check
cargo check
cargo test
```

原因：当前环境没有 `cargo`、`rustc` 和 `rustfmt`。

### Tauri 二进制构建

未执行：

```bash
npm run tauri build
```

因此本交付为**经过静态和轻量类型验证的源码包**，不是已验证可运行的 EXE 或安装器。

## 建议的发布前门禁

在 Windows 发布机执行：

```powershell
npm install
npm run check
npm run tauri build
```

并人工验证以下流程：

1. 启动多个任务，暂停其中一个，关闭应用，再启动并恢复；
2. 测试无密码和有密码任务的恢复差异；
3. 选择空间不足的目标盘，确认开始按钮被阻止；
4. 测试覆盖、改名、跳过三种冲突策略提示；
5. 测试高优先级任务跨通道先运行；
6. 导出模板、修改、重新导入，确认按名称合并；
7. 拖动背景焦点并重启，确认设置持久化；
8. 分别测试 ZIP、TAR、7Z、RAR 暂停行为；
9. 运行安全删除，确认旧被替换文件按设置保留或删除；
10. 在 100%、125%、150% Windows 缩放下检查设置抽屉与开始确认页。
