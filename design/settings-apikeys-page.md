# ArcLine Settings / API Keys 页面设计

> 版本：1.0
> 路由：`/settings`
> 参考：Vercel Settings + Linear Settings

---

## 1. 页面结构

Settings 页使用 Tab 布局：

```
┌──────────────────────────────────────────────────────┐
│ Header                                                │
│ Settings                                              │
├──────────────────────────────────────────────────────┤
│ [General]  [API Keys]  [Pipeline]  [GPU]             │
├──────────────────────────────────────────────────────┤
│                                                       │
│  (Tab 内容区)                                         │
│                                                       │
└──────────────────────────────────────────────────────┘
```

Phase 0 只实现 **API Keys** Tab，其余 Tab 显示占位内容。

---

## 2. API Keys Tab

```
┌──────────────────────────────────────────────────────┐
│ API Keys                          [+ Create Key]     │
├──────────────────────────────────────────────────────┤
│                                                       │
│ Name            │ Key          │ Created    │ Actions  │
├─────────────────┼──────────────┼────────────┼─────────┤
│ Kling Prod      │ sk-...8f2a   │ 2026-04-26 │ [Revoke]│
│ ComfyUI Dev     │ sk-...c4d1   │ 2026-04-25 │ [Revoke]│
│                 │              │            │         │
└──────────────────────────────────────────────────────┘
```

### 列表规则
- Key 值只显示前缀 `sk-` + 后 4 位（如 `sk-...8f2a`）
- 创建时完整 Key 只显示一次（Modal 内可复制）
- 排序：按创建时间倒序

### 创建 API Key（Modal）

```
┌─────────────────────────────────────────┐
│ Create API Key                     [×]  │
├─────────────────────────────────────────┤
│                                         │
│  Key Name *                              │
│  [                              ]        │
│                                         │
│              [Cancel]  [Create]          │
│                                         │
└─────────────────────────────────────────┘
```

点击 Create 后，弹出成功 Modal：

```
┌─────────────────────────────────────────┐
│ API Key Created                    [×]  │
├─────────────────────────────────────────┤
│                                         │
│  ⚠️ 请立即复制，此 Key 仅显示一次       │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ sk-prod-a8f2a9c4d1e7b3...      │    │
│  └─────────────────────────────────┘    │
│                                         │
│              [📋 Copy]  [Done]           │
│                                         │
└─────────────────────────────────────────┘
```

### 撤销 API Key
- 点击 `Revoke` → 确认弹窗 → 不可恢复
- 撤销后该行变灰 + 标记 `Revoked`

---

## 3. General Tab（占位）

```
┌──────────────────────────────────────────────────────┐
│                                                       │
│  General settings coming soon.                        │
│                                                       │
│  Phase 1 will include:                                │
│  • Default project preferences                        │
│  • Notification settings                              │
│  • Theme preference                                   │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 4. Pipeline Tab（占位）

```
┌──────────────────────────────────────────────────────┐
│                                                       │
│  Pipeline configuration coming in Phase 1.            │
│                                                       │
│  Will include:                                        │
│  • Default model routing                              │
│  • QA threshold configuration                         │
│  • Fallback policy settings                           │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 5. GPU Tab（占位）

```
┌──────────────────────────────────────────────────────┐
│                                                       │
│  GPU instance management coming in Phase 1.           │
│                                                       │
│  Will include:                                        │
│  • Vast.ai instance connection                        │
│  • ComfyUI health monitoring                          │
│  • Instance auto-scaling                              │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 6. API 映射

| 操作 | Method | Endpoint |
|------|--------|----------|
| 列表 | GET | `/api/apikeys` |
| 创建 | POST | `/api/apikeys` |
| 详情 | GET | `/api/apikeys/:id` |
| 更新 | PUT | `/api/apikeys/:id` |
| 删除/撤销 | DELETE | `/api/apikeys/:id` |