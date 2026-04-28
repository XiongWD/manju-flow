# ArcLine Projects 页面设计

> 版本：1.0
> 路由：`/projects`
> 参考：Linear 的 Project List

---

## 1. 页面结构

```
┌──────────────────────────────────────────────────────┐
│ Header                                                │
│ Projects                    [+ New Project]            │
├──────────────────────────────────────────────────────┤
│ Search: [搜索项目名/题材...]                           │
├──────────────────────────────────────────────────────┤
│ Name          │ Market │ Genre   │ Tier │ Episodes │ Status    │ Actions │
├──────────────┼────────┼─────────┼──────┼──────────┼───────────┼─────────┤
│ Vampire King  │ US     │ Revenge │ A    │ 0/12     │ 🟢 Active │ ···     │
│ 都市霸总      │ CN     │ CEO     │ SSS  │ 3/15     │ 🟡 Prod   │ ···     │
│ ...          │        │         │      │          │           │         │
└──────────────────────────────────────────────────────┘
```

---

## 2. 交互规范

### 列表
- 默认按更新时间倒序
- 搜索过滤项目名和题材
- 表格行高 40px

### 创建项目（Modal）
点击 `+ New Project` 弹出 Modal：

```
┌─────────────────────────────────────────┐
│ Create New Project                  [×]  │
├─────────────────────────────────────────┤
│                                         │
│  Project Name *                          │
│  [                              ]        │
│                                         │
│  Market                                  │
│  [US          ▼]                         │
│                                         │
│  Genre                                   │
│  [Revenge     ▼]                         │
│                                         │
│  Tier                                    │
│  [A           ▼]                         │
│                                         │
│  Budget (USD)                            │
│  [              ]                        │
│                                         │
│  Description                             │
│  [                             ]         │
│  [                             ]         │
│                                         │
│              [Cancel]  [Create]          │
└─────────────────────────────────────────┘
```

字段说明：
- Project Name：必填，2-100 字符
- Market：下拉（US / UK / SEA / CN / JP / KR）
- Genre：下拉（Revenge / Werewolf / Mafia / CEO / Custom...）
- Tier：下拉（A / SSS）
- Budget：可选，number
- Description：可选，textarea

### 编辑项目
- 行内 Actions → `Edit` 打开 Modal（同创建，预填数据）
- 行内 Actions → `Delete` 弹确认弹窗

### 项目详情跳转
- 点击项目名 → `/projects/:id/episodes`

---

## 3. 空状态

```
┌─────────────────────────────────────────┐
│                                         │
│        🎬                               │
│                                         │
│   No projects yet                       │
│   Create your first production project   │
│                                         │
│          [+ New Project]                │
│                                         │
└─────────────────────────────────────────┘
```

---

## 4. 状态显示

| 状态 | 徽章 | 说明 |
|------|------|------|
| Active | 🟢 Active | 有未完成剧集 |
| In Production | 🟡 In Prod | 正在生产 |
| Completed | ✅ Completed | 所有剧集已交付 |
| Archived | ⚪ Archived | 已归档 |

---

## 5. API 映射

| 操作 | Method | Endpoint |
|------|--------|----------|
| 列表 | GET | `/api/projects` |
| 创建 | POST | `/api/projects` |
| 详情 | GET | `/api/projects/:id` |
| 更新 | PUT | `/api/projects/:id` |
| 删除 | DELETE | `/api/projects/:id` |