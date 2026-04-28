# ArcLine 布局与导航设计

> 版本：1.0

---

## 1. 一级导航

```
┌──────────────┐
│ 🎬 ArcLine   │  ← Logo + 品牌名
│              │
│ 生产         │  ← 分组标签
│ ├ Dashboard  │
│ ├ Projects   │
│ ├ Shot Editor│
│ ├ Render Q.  │
│ └ QA Center  │
│              │
│ 管理         │
│ ├ Story      │
│ ├ Assets     │
│ ├ Edit & Del.│
│ └ Analytics  │
│              │
│ 系统         │
│ └ Settings   │
└──────────────┘
  Sidebar 240px
```

### 导航项与图标（Lucide）

| 路由 | 图标 | 名称 |
|------|------|------|
| `/` | `LayoutDashboard` | Dashboard |
| `/projects` | `FolderKanban` | Projects |
| `/projects/:id/story` | `BookOpen` | Story & Characters |
| `/projects/:id/shots` | `Clapperboard` | Shot Editor |
| `/render` | `Cpu` | Render Queue |
| `/qa` | `ShieldCheck` | QA Center |
| `/assets` | `Image` | Asset Browser |
| `/delivery` | `Package` | Edit & Delivery |
| `/analytics` | `BarChart3` | Analytics |
| `/settings` | `Settings` | Settings |

---

## 2. 全局布局骨架

```
┌───────────────────────────────────────────────────────────┐
│ Sidebar (240px)  │  Main Area                             │
│                  │  ┌──────────────────────────────────┐   │
│  [Nav Items]     │  │ Header (56px)                    │   │
│                  │  │ Breadcrumb       [Actions]        │   │
│                  │  ├──────────────────────────────────┤   │
│                  │  │                                  │   │
│                  │  │  Content (scroll)                │   │
│                  │  │                                  │   │
│                  │  │                                  │   │
│                  │  │                                  │   │
│                  │  └──────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

- Sidebar 固定左侧
- Main Area 占满剩余宽度
- Header 固定顶部，不随内容滚动
- Content 区域独立滚动

---

## 3. 页面层级

```
/                            → Dashboard（项目概览）
/projects                    → 项目列表
/projects/:id                → 项目详情（重定向到 episodes）
/projects/:id/episodes       → 剧集列表
/projects/:id/episodes/:eid   → 剧集详情（含场景列表）
/projects/:id/story           → Story Bible + Characters
/projects/:id/shots           → Shot Editor（场景列表 + 版本）
/projects/:id/shots/:sid      → 单个场景详情 + Version Diff
/render                      → Render Queue（全局任务队列）
/qa                          → QA Center
/assets                      → Asset Browser
/delivery                    → Edit & Delivery
/analytics                   → Analytics
/settings                    → Settings（含 API Keys）
```

---

## 4. 侧边栏交互

- 当前项目上下文：Sidebar 顶部显示当前项目名（可切换）
- 没有选中项目时：部分导航项灰置（Story / Shots 需要项目上下文）
- 分组标签 `text-tertiary` 字号 `caption`，不可点击
- 活跃项：`accent` 左边框 2px + 文字 `accent` 色 + `bg-tertiary` 背景
- 悬浮项：`bg-tertiary` 背景

---

## 5. 响应式断点

Phase 0 只支持：
- **1440px+**：完整 Sidebar + Main
- **1280-1439px**：Sidebar 缩窄到 200px（图标 + 短名）
- **<1280px**：Phase 0 不适配，显示提示横幅