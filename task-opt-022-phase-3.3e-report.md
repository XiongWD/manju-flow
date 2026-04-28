# Phase 3.3e 完成报告：版本状态视图收口（只读）

## 修改文件清单

- `/home/hand/work/manju/frontend-next/src/app/workspace/projects/[id]/episodes/[episodeId]/SceneList.tsx`

## 状态视图统一说明

### 1. 新增组件与函数

#### `getStatusTone(status: string | null | undefined): 'neutral' | 'info' | 'success' | 'warning' | 'danger'`
将 Scene/SceneVersion 状态映射到 GlassChip 的 UI tone：

| 状态 | Tone | 颜色语义 | 说明 |
|------|------|----------|------|
| `DRAFT`, `draft` | `neutral` | 灰色/中性 | 草稿状态 |
| `READY`, `ready`, `completed` | `success` | 绿色 | 就绪/完成状态 |
| `GENERATING`, `generating` | `warning` | 黄色 | 生成中 |
| `QA_PASSED`, `qa_passed` | `success` | 绿色 | QA 通过 |
| `LOCKED`, `locked` | `info` | 蓝色 | 已锁定 |
| `FAILED`, `failed` | `danger` | 红色 | 失败 |
| 未知/空 | `neutral` | 灰色/中性 | 默认 fallback |

#### `SceneStatusBadge({ status })`
Scene 状态徽章组件，使用 `GlassChip` 渲染。

#### `VersionStatusBadge({ status })`
SceneVersion 状态徽章组件，使用 `GlassChip` 渲染。

### 2. 替换位置统计

| 位置 | 原实现 | 新实现 | 行号 |
|------|--------|--------|------|
| 场景列表中的场景状态 | 内联条件 className | `<SceneStatusBadge>` | 491 |
| 场景列表中的版本状态 | 内联条件 className | `<VersionStatusBadge>` | 505 |
| 版本选择器中的状态 | 括号内纯文本 | `<VersionStatusBadge>` | 218 |
| 当前预览状态 | 纯文本 | `<VersionStatusBadge>` | 227 |

### 3. 统一效果

✅ **统一视觉表达**：所有状态均使用 `GlassChip` 组件，颜色和样式由统一的 tone 系统控制
✅ **统一文案处理**：空状态显示 "未知"
✅ **大小写兼容**：支持大写和小写状态值（如 `DRAFT` / `draft`）
✅ **中文界面**：保持现有中文界面，无英文状态值暴露

## 最小静态校验结果

### TypeScript 类型检查
```bash
cd /home/hand/work/manju/frontend-next && npx tsc --noEmit --pretty
```
✅ **通过** - 无类型错误

### ESLint 代码检查
```bash
cd /home/hand/work/manju/frontend-next && npx eslint src/app/workspace/projects/[id]/episodes/[episodeId]/SceneList.tsx --max-warnings=0
```
⚠️ **警告 1 条**（非本次修改引入）
- `@next/next/no-img-element`：使用了 `<img>` 而非 Next.js 的 `<Image />`
- **说明**：此警告存在于原始代码，与本次状态视图收口无关

## 已知未完成项 / 风险

### 1. 未修改项（超出本次任务范围）
- ❌ 未添加动作按钮（生成、QA 等）- 按任务要求只做只读
- ❌ 未修改版本详情弹层中的其他字段 - 只收口了状态展示
- ❌ 未处理其他页面的状态展示 - 仅限 SceneList.tsx

### 2. 潜在风险
- **状态值扩展**：如后续新增状态值，需要在 `getStatusTone` 函数中添加映射，否则会 fallback 到 `neutral`
- **GlassChip 样式依赖**：当前实现依赖 `glass-chip-*` CSS 类，如后续样式系统变更需同步调整

### 3. 建议后续优化
- 考虑将状态映射逻辑提取到共享的 `@/lib/status-utils.ts`，便于跨页面复用
- 可考虑添加状态描述提示（tooltip），增强可读性

## 总结

本次 Phase 3.3e 任务已完成 SceneList.tsx 中 Scene 和 SceneVersion 状态展示的统一收口：

1. ✅ 创建了统一的状态映射函数和状态徽章组件
2. ✅ 替换了所有 4 处状态展示位置
3. ✅ 覆盖了所有要求的状态类型（`DRAFT`, `READY`, `GENERATING`, `QA_PASSED`, `LOCKED`, `FAILED` 及未知状态）
4. ✅ 保持了中文界面，使用现有 Glass 组件
5. ✅ 通过 TypeScript 类型检查
6. ✅ 未引入新的 ESLint 错误

任务目标达成，可进入下一阶段。
