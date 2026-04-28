# ArcLine 竞品分析

> 版本：1.0
> 目的：确认 ArcLine 的信息架构和交互模式有据可循，而非凭空设计

---

## 1. 分析对象

| 产品 | 类型 | 参考价值 |
|------|------|----------|
| Linear | 项目管理 | 信息密度、键盘操作、状态流 |
| Vercel Dashboard | 部署管理 | 列表+详情模式、实时日志 |
| Raycast | 启动器/工具 | 搜索优先、紧凑布局 |
| ComfyUI Frontend | 节点编辑器 | **反面教材**——不做节点流 UI |
| RunwayML | AI 视频生成 | 生成队列、进度反馈 |
| Midjourney Web | AI 图像生成 | 图片画廊浏览 |

---

## 2. Linear — 信息密度与状态流

### 可借鉴
- **紧凑表格**：40px 行高、最小化垂直留白、右对齐数字
- **状态标签**：小圆点 + 颜色 + 文字，不占多余空间
- **命令面板**：Cmd+K 全局搜索，Phase 0 不做，但预留搜索栏
- **面包屑导航**：Project > Episode > Scene 三级跳转
- **键盘快捷键**：Phase 0 不做，但结构预留

### 不借鉴
- Issues / Projects 混排模式（ArcLine 项目结构不同）
- 左右面板拆分（ArcLine 用侧边栏 + 主内容）

---

## 3. Vercel Dashboard — 队列与实时反馈

### 可借鉴
- **部署列表**：每次部署一行，状态徽章 + 时间 + 触发者，非常类似 ArcLine 的 Job 队列
- **实时日志**：右侧面板展示实时输出，ArcLine 的 Render Queue 可以类似
- **简洁顶栏**：项目名 + 环境选择 + 操作按钮

### 不借鉴
- Git 集成模式（ArcLine 不做版本管理 UI）

---

## 4. 内容管理类（视频/图像）

### RunwayML
- 生成队列 + 进度条 + 缩略图 → ArcLine Render Queue 参考
- 视频预览内嵌 → ArcLine Shot Editor 参考

### Midjourney Web
- 4 图网格 → ArcLine 版本对比参考（Scene Version Diff）
- 生成状态：Pending / Progress / Done → ArcLine Scene 状态机参考

---

## 5. ArcLine 定位总结

| 维度 | Linear | Vercel | ArcLine |
|------|--------|--------|---------|
| 核心动作 | 管状态 | �部署 | **管生产流程** |
| 信息密度 | 高 | 中 | **高**（12 个 QA Gate 每个都是数据点） |
| 实时性 | 中 | 高 | **高**（Job 进度 + QA 结果实时推送） |
| 操作频率 | 频繁切换 | 中低 | **频繁**（创建→生成→QA→返修循环） |
| 资产规模 | 文本为主 | 日志为主 | **大量图片/视频资产** |

---

## 6. 设计决策记录

| 决策 | 依据 |
|------|------|
| 侧边栏固定 240px | Linear 模式，信息密集型产品不折叠 |
| 表格行高 40px | Linear 标准，一屏多行 |
| 不做节点编辑器 UI | 管理界面不是绘图工具，状态流优于画布 |
| 实时用 WebSocket | Vercel 模式，Job 状态必须实时 |
| 版本对比用并排卡片 | Midjourney 网格简化版，不是 overlay |