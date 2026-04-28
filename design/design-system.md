# ArcLine 设计系统

> 版本：1.0
> 基准：现代 SaaS（Linear / Vercel / Raycast）
> 禁止：AI 风格（渐变紫蓝、装饰插图、过度动画）

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| 功能优先 | 每个像素必须为操作服务，装饰最小化 |
| 信息密度 | 一屏呈现足够信息，减少滚动和跳转 |
| 状态清晰 | 任何操作必须是 3 种状态之一：空闲 / 进行中 / 完成（或失败） |
| 一致性 | 同一概念在全站用同一组件，不搞花式变体 |

---

## 2. 色彩系统

### 2.1 中性色（核心）

| Token | 亮色 | 暗色 | 用途 |
|-------|------|------|------|
| `bg-primary` | `#FFFFFF` | `#0A0A0A` | 页面背景 |
| `bg-secondary` | `#F5F5F5` | `#141414` | 卡片/面板背景 |
| `bg-tertiary` | `#EBEBEB` | `#1C1C1C` | 悬浮/激活态 |
| `border` | `#E5E5E5` | `#262626` | 分割线/边框 |
| `text-primary` | `#171717` | `#FAFAFA` | 主文本 |
| `text-secondary` | `#737373` | `#A3A3A3` | 辅助文本 |
| `text-tertiary` | `#A3A3A3` | `#525252` | 占位/禁用 |

### 2.2 语义色

| Token | 亮色 | 暗色 | 用途 |
|-------|------|------|------|
| `accent` | `#2563EB` | `#3B82F6` | 主操作/链接/选中 |
| `accent-hover` | `#1D4ED8` | `#60A5FA` | 主操作悬浮 |
| `success` | `#16A34A` | `#22C55E` | 通过/成功/已完成 |
| `warning` | `#D97706` | `#F59E0B` | 待审/需关注 |
| `error` | `#DC2626` | `#EF4444` | 失败/阻塞/删除 |
| `info` | `#0891B2` | `#06B6D4` | 提示/信息 |

### 2.3 QA 状态色（专用）

| 状态 | 色值 | 用途 |
|------|------|------|
| `qa-pass` | `#16A34A` | Gate 通过 |
| `qa-fail` | `#DC2626` | Gate 失败 |
| `qa-review` | `#D97706` | 人工复核 |
| `qa-pending` | `#737373` | 等待检测 |
| `qa-skipped` | `#A3A3A3` | 跳过 |

---

## 3. 排版

### 3.1 字体栈

```
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", monospace;
```

### 3.2 字号体系

| Token | Size | Weight | Line Height | 用途 |
|-------|------|--------|-------------|------|
| `display` | 36px | 700 | 1.2 | 数字看板 |
| `h1` | 24px | 600 | 1.3 | 页面标题 |
| `h2` | 20px | 600 | 1.3 | 区块标题 |
| `h3` | 16px | 600 | 1.4 | 卡片/面板标题 |
| `body` | 14px | 400 | 1.5 | 正文 |
| `caption` | 12px | 400 | 1.4 | 标签/时间/辅助 |
| `mono` | 13px | 400 | 1.4 | 代码/ID/参数 |

---

## 4. 间距系统

基于 8px 栅格：

| Token | Value | 用途 |
|-------|-------|------|
| `1` | 4px | 图标与文本间距 |
| `2` | 8px | 紧凑元素间距 |
| `3` | 12px | 列表项间距 |
| `4` | 16px | 卡片内边距 |
| `5` | 20px | 区块间距 |
| `6` | 24px | 组件间距 |
| `8` | 32px | 区块间距 |
| `10` | 40px | 页面段落间距 |
| `12` | 48px | 大区块分隔 |

---

## 5. 组件规范

### 5.1 按钮

| 变体 | 样式 | 用途 |
|------|------|------|
| Primary | accent 填充 + 白字 | 主操作（创建、确认） |
| Secondary | 透明 + border + 文字色 | 次操作（取消、返回） |
| Ghost | 透明 + 无 border | 三级操作 |
| Danger | error 填充 + 白字 | 删除、阻断 |
| Icon | 正方形 + 图标居中 | 工具栏操作 |

尺寸：`sm`(28px) / `default`(32px) / `lg`(36px)

圆角：6px

### 5.2 卡片

- 圆角 8px
- 亮色：`bg-secondary` + `1px border`
- 暗色：`bg-secondary` + `1px border`
- 悬浮：`bg-tertiary` 或轻微 shadow
- 无大阴影，无渐变

### 5.3 表格

- 紧凑行高 40px
- 表头 `text-secondary` + `caption` 字号
- 行悬浮 `bg-tertiary`
- 内联操作（右侧按钮组），不用省略号菜单

### 5.4 状态徽章（Badge）

| 状态类别 | 显示 |
|----------|------|
| 状态机 | 实心圆点 + 文字（如 🟢 LOCKED） |
| QA Gate | 方形标签 + 对应色 |
| 进度 | 细进度条 + 百分比 |

### 5.5 表单

- 标签在输入框上方
- 错误信息在输入框下方，红色
- 下拉使用原生 select + 少量自定义样式
- 不用花式 date picker，用标准 input[type=date]

### 5.6 骨架屏

- 加载时显示灰色块，不高 350ms 以上的白屏
- 骨架块的圆角与真实组件一致

### 5.7 空状态

每个列表页必须有空状态插画（极简线条）+ 引导文字 + CTA 按钮

### 5.8 Toast 通知

- 右下角弹出
- 分 success / error / warning / info
- 自动 4s 消失，error 可点击查看详情
- 不用 modal 弹窗做通知

---

## 6. 布局系统

### 6.1 全局布局

```
┌─────────────────────────────────────────────────┐
│ Sidebar (240px, 固定) │ Main Content (flex-1)   │
│                       │                         │
│ Logo                  │ Header (56px)           │
│ ────                  │ ────                     │
│ Dashboard             │ Breadcrumb + Actions     │
│ Projects              │ ────                     │
│ Story & Characters    │ Page Content (scrollable)│
│ Shot Editor           │                          │
│ Render Queue          │                          │
│ QA Center             │                          │
│ Asset Browser         │                          │
│ Edit & Delivery        │                          │
│ Analytics              │                          │
│ ────                  │                          │
│ Settings              │                          │
└─────────────────────────────────────────────────┘
```

### 6.2 Sidebar

- 固定左侧，不折叠（Phase 0 不做 responsive 缩窄）
- 分组：生产 / 管理 / 系统
- 当前页高亮 `accent` 色
- 图标 + 文字，不用纯图标模式

### 6.3 页面 Header

- 56px 高
- 左：面包屑 + 页面标题
- 右：主操作按钮（如"新建项目"）

### 6.4 内容区

- 最大宽度不限（数据密集型页面）
- 内边距 24px
- 列表页：上方搜索栏 + 下方表格
- 详情页：上方信息卡片 + 下方标签页

---

## 7. 深色模式

- 尊重系统偏好 `prefers-color-scheme`
- 提供手动切换开关（Header 右上角）
- 所有组件必须支持亮暗双模式
- 暗色背景不用纯黑（用 `#0A0A0A` / `#141414`）
- 暗色下 border 用 `#262626`，不是更浅

---

## 8. 图标

- 使用 Lucide Icons（React）
- 尺寸：16px（默认）/ 20px（导航）/ 24px（空状态）
- 不用自制图标，不用 emoji 做图标
- 每个一级导航必须配图标

---

## 9. 动效

| 场景 | 动效 | 时长 |
|------|------|------|
| 页面切换 | 淡入 | 150ms |
| 列表项展开 | slide-down | 200ms |
| 按钮反馈 | background transition | 150ms |
| 加载态 | 骨架屏脉冲 | 1.5s loop |
| Toast 弹出 | slide-in-right | 200ms |
| 模态弹窗 | scale + fade | 200ms |

禁止：
- 弹跳动画
- 大范围位移动画
- 自动轮播

---

## 10. 响应式

Phase 0 最低支持：
- 桌面 1440px+（主目标）
- 笔记本 1280px（基本可用）

Phase 1 以后再支持平板和手机。