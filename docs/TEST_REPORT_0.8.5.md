# 0.8.5 测试报告

本版本验收重点：版本一致性、设置项搜索、缩写匹配、一键定位、目标高亮、紧凑侧栏搜索，以及 8 个工作区入口显示开关。

执行项：

- `npm run check:085`：0.8.5 专项静态检查。
- `npm run check:config`：项目配置与关键功能标记检查。
- `npm run build`：Vue/TypeScript 类型检查与 Vite 生产构建。
- `cargo fmt -- --check`、`cargo check`、`cargo test`：Rust 格式、编译与测试。

最终结果以 `docs/VALIDATION_0.8.5.txt` 中的实际执行记录为准。

## 本次实际结果

项目静态检查与 0.8.5 专项检查全部通过；设置搜索索引共 65 项，逐项检查目标文字均能在对应设置页面找到。变更 TypeScript / Vue script setup 通过语法检查。

完整前端生产构建与 Rust 编译测试受当前执行环境限制：上传包未包含 node_modules，依赖安装超时且离线缓存不完整；环境中也没有 cargo。详见 `VALIDATION_0.8.5.txt`。
