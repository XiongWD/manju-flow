# Manju Production OS

短视频批量生产操作系统 —— 从剧本到发布的一站式自动化流水线。

**项目路径**: `/home/hand/work/manju/`

---

## 1. 项目目录树

```
manju/
├── AGENTS.md                        # Agent 治理规则
├── CLAUDE.md                        # Claude Code 上下文
├── README.md                        # 本文件
├── backend/                         # FastAPI 后端
│   ├── main.py                      # 入口 + WebSocket 广播
│   ├── requirements.txt
│   ├── manju.db                    # SQLite 数据库
│   ├── alembic.ini
│   ├── alembic/                     # 数据库迁移
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       ├── c9a69f35eefa_phase02_initial_19_models.py
│   │       ├── 9646a84d609a_story_character_enhancement_v2.py
│   │       └── 041b3_analytics_knowledge_feedback.py
│   ├── database/
│   │   ├── connection.py            # 异步引擎 + Base
│   │   └── models.py                # 20 个 ORM 模型
│   ├── routers/                     # API 路由（14 个）
│   │   ├── __init__.py
│   │   ├── projects.py               # 项目 CRUD
│   │   ├── episodes.py              # 剧集管理
│   │   ├── scenes.py                # 场景 + 版本 + 返修 + 剪辑
│   │   ├── characters.py            # 角色管理
│   │   ├── story_bibles.py          # 故事圣经
│   │   ├── assets.py                 # 资产管理
│   │   ├── jobs.py                   # 任务/JobStep
│   │   ├── qa.py                     # QA 检查
│   │   ├── publish.py                # 发布 + 导出重验
│   │   ├── analytics.py             # 数据回流快照
│   │   ├── knowledge.py              # 知识沉淀
│   │   ├── apikeys.py                # API Key 管理
│   │   ├── workspace.py              # workspace 配置
│   │   └── files.py                  # 文件上传/存储
│   ├── schemas/                      # Pydantic 请求/响应模型
│   │   ├── project.py, episode.py, scene.py, character.py
│   │   ├── story_bible.py, asset.py, job.py, qa.py
│   │   ├── publish.py, delivery.py, analytics.py
│   │   ├── knowledge.py, apikey.py, workspace.py, rule.py
│   ├── services/
│   │   ├── pipeline/                 # 流水线核心（18 个模块）
│   │   │   ├── orchestrator.py       # 调度编排 + fallback 链
│   │   │   ├── tier_config.py        # Tier A/S/SS/SSS 分级配置
│   │   │   ├── version_lock.py       # 版本锁定/解锁/切换/回退
│   │   │   ├── rules.py              # 规则定义
│   │   │   ├── rule_loader.py        # 规则加载器
│   │   │   ├── rule_executor.py      # 规则执行器
│   │   │   ├── audio.py              # TTS + BGM 混音
│   │   │   ├── video.py              # 视频合成
│   │   │   ├── compose.py            # 合成引擎
│   │   │   ├── delivery.py           # 交付包构建
│   │   │   ├── publish.py             # 发布状态机
│   │   │   ├── qa.py                 # QA 检查服务
│   │   │   ├── export_recheck.py     # 导出后重验
│   │   │   ├── analytics.py          # 数据回流
│   │   │   ├── knowledge.py          # 知识沉淀
│   │   │   ├── character.py          # 角色一致性
│   │   │   ├── c2pa.py               # C2PA 水印合规
│   │   │   ├── compliance_assets.py  # 合规资产标注
│   │   │   ├── config.py             # 配置加载
│   │   │   └── config_audio.py       # 音频参数配置
│   │   └── storage/
│   │       └── minio_client.py       # MinIO S3 客户端
│   └── .local/bin/
│       ├── ffmpeg                    # 视频处理
│       └── ffprobe
├── frontend-next/                    # Next.js 前端
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # 首页
│   │   │   └── workspace/            # 工作台
│   │   │       ├── layout.tsx        # 侧边栏布局
│   │   │       ├── page.tsx          # 工作台首页/仪表盘
│   │   │       ├── projects/         # 项目列表 + 详情
│   │   │       │   ├── page.tsx      # 项目列表
│   │   │       │   └── [id]/
│   │   │       │       ├── page.tsx  # 项目详情
│   │   │       │       ├── episodes/ # 剧集管理
│   │   │       │       ├── shots/    # 镜头工作台
│   │   │       │       └── story/    # 剧本编辑
│   │   │       ├── episodes/          # 独立剧集页
│   │   │       ├── shots/             # 全局镜头列表
│   │   │       ├── story/             # 全局剧本库
│   │   │       ├── assets/           # 角色资产库
│   │   │       ├── render/           # 渲染监控/任务队列
│   │   │       ├── qa/               # QA 审核面板
│   │   │       ├── delivery/         # 交付/导出
│   │   │       ├── analytics/         # 数据分析
│   │   │       └── settings/         # 系统设置/API Keys
│   │   ├── components/
│   │   │   ├── ui/primitives/         # Glass 设计体系组件
│   │   │   │   ├── GlassButton.tsx
│   │   │   │   ├── GlassChip.tsx
│   │   │   │   ├── GlassEmptyState.tsx
│   │   │   │   ├── GlassField.tsx
│   │   │   │   ├── GlassInput.tsx
│   │   │   │   ├── GlassLoadingBlock.tsx
│   │   │   │   ├── GlassModalShell.tsx
│   │   │   │   ├── GlassSurface.tsx
│   │   │   │   ├── GlassTextarea.tsx
│   │   │   │   └── GlassToast.tsx
│   │   │   └── workspace/             # 业务组件
│   │   │       ├── Sidebar.tsx
│   │   │       ├── PageHeader.tsx
│   │   │       ├── EpisodeListManager.tsx
│   │   │       └── EpisodeQuickCreateButton.tsx
│   │   ├── lib/
│   │   │   ├── api-client.ts         # API 客户端
│   │   │   └── utils.ts              # 工具函数
│   │   └── types/
│   │       └── index.ts             # TypeScript 类型
├── docs/
│   ├── ARCHITECTURE.md               # 系统架构文档（28k）
│   ├── STACK-CATALOG.md              # 技术栈目录
│   ├── planning/                     # 开发计划文档
│   ├── optimize/                     # 优化文档
│   ├── research/                     # 研究文档
│   ├── review/                       # 评审文档
│   └── summary/                      # 总结文档
├── scripts/
│   └── manju.sh                     # 一键启动脚本
├── design/
│   ├── design-system.md             # 设计体系
│   ├── projects-page.md             # 项目页设计
│   └── short-video-platform-ui-reference.md
└── bak/frontend/                    # 已废弃的 Vite 前端备份
```

---

## 2. 项目技术信息

### 如何启动

**后端**:
```bash
cd /home/hand/work/manju/backend
pip install -r requirements.txt
cp .env.example .env    # 编辑 .env 填入 API Keys
python main.py           # 启动在 http://localhost:8000
```

**前端**:
```bash
cd /home/hand/work/manju/frontend-next
npm install
npm run dev              # 启动在 http://localhost:3000
```

**一键启动**:
```bash
bash /home/hand/work/manju/scripts/manju.sh
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | FastAPI + SQLAlchemy (async) + SQLite / PostgreSQL |
| 前端框架 | Next.js 16 + React 19 + TypeScript |
| UI 设计体系 | shadcn/ui + Tailwind CSS 4 (Glass 设计语言) |
| 数据库迁移 | Alembic |
| 实时通信 | WebSocket 进度推送 |
| 文件存储 | MinIO (S3 兼容) / 本地文件 fallback |
| 视频处理 | FFmpeg (backend/.local/bin/) |
| 合规标注 | C2PA (c2patool) |
| 任务队列 | Job + JobStep 模型 |
| Agent 调度 | OpenClaw 多 Agent 编排 |

### 已实现功能（Phase 0–5）

- ✅ **项目/剧集/场景 CRUD**：完整的项目层级管理
- ✅ **角色系统**：Character + CharacterAsset，支持角色一致性管理
- ✅ **剧本管理**：StoryBible + Episode outline/script
- ✅ **镜头工作台**：SceneVersion 版本链，支持锁定/解锁/切换/回退
- ✅ **Tier 分级流水线**：A / S / SS / SSS 四级质量体系 + 自动降级 fallback（SSS→SS→S→A_FALLBACK）
- ✅ **音频增强**：TTS（ElevenLabs / Fish Audio）+ BGM 混音，参数级配置继承
- ✅ **视频合成**：compose.py 合成引擎，FFmpeg 调用
- ✅ **规则引擎**：规则定义 + 加载 + 执行，合规自动检查
- ✅ **C2PA 合规**：水印 + 合规标注资产化
- ✅ **QA 检查**：QA Run + Issue，支持证据截图
- ✅ **交付打包**：DeliveryPackage，多平台变体
- ✅ **发布状态机**：PublishJob + PublishVariant（TikTok / 抖音 / YouTube）
- ✅ **导出重验**：ExportRecheck，导出后自动质检回写
- ✅ **数据回流**：AnalyticsSnapshot，publish 后自动快照
- ✅ **知识沉淀**：KnowledgeItem，支持项目级经验积累
- ✅ **WebSocket 实时进度**：后端广播到所有连接的前端
- ✅ **API Key 管理**：独立 apikeys 路由
- ✅ **前端工作台**：7 个主要页面（projects / shots / story / assets / render / qa / delivery / analytics / settings）
- ✅ **Glass 设计体系**：统一的暗色毛玻璃 UI 组件库

### 未实现功能

- 🚧 **真实第三方平台 API 接入**（TikTok / 抖音 / YouTube — 仅状态机框架就绪）
- 🚧 **真实 GPU 训练 / LoRA 部署**（pipeline 占位存在，未接真实 GPU 服务）
- 🚧 **复杂时间线编辑器**（仅列表视图，拖拽/时间线编辑未做）
- 🚧 **真实 FFmpeg 深度检查**（ffmpeg 存在但视频处理细节未全部验证）
- 🚧 **Alembic migration 实际执行**（migration 文件存在但未执行到生产 DB）
- 🚧 **全项目 build + 端到端联调**（前后端各自可跑，串联测试未完成）
- 🚧 **MinIO 真实接入**（minio_client.py 存在，仅本地文件 fallback）
- 🚧 **前端完整 CRUD**：部分页面仅有列表，编辑/创建表单待完善

---

## 3. 数据库模型

### ORM 模型（models.py — 20 个）

```
Base (SQLAlchemy)
├── Project                 # 项目
├── ProjectConfig           # 项目配置 K/V
├── StoryBible              # 故事圣经
├── Character               # 角色
├── CharacterEpisode        # 角色-剧集关联
├── CharacterAsset          # 角色资产
├── Episode                # 剧集
├── Scene                  # 场景
├── SceneCharacter         # 场景-角色关联
├── SceneVersion           # 场景版本链
├── Asset                  # 资产文件
├── AssetLink              # 资产关联
├── Job                    # 任务
├── JobStep                # 任务步骤
├── QARun                  # QA 检查记录
├── QAIssue                # QA 问题
├── PublishJob             # 发布任务
├── PublishVariant         # 发布变体（TikTok/抖音/YouTube）
├── DeliveryPackage         # 交付包
├── AnalyticsSnapshot      # 数据分析快照
├── KnowledgeItem          # 知识条目
└── ApiKey                 # API Key
```

### 主要模型字段

**Project**
```
id, name, genre, market, platform, tier, budget_limit,
status, description, created_at, updated_at
```

**Episode**
```
id, project_id, episode_no, title, outline, script,
duration, status, current_cut_asset_id, created_at, updated_at
```

**Scene**
```
id, episode_id, scene_no, description, shot_list,
status, created_at, updated_at
```

**SceneVersion**
```
id, scene_id, version_no, locked, locked_at,
locked_by, change_summary, created_at
```

**Job / JobStep**
```
Job: id, project_id, job_type, status, priority,
created_at, updated_at, completed_at

JobStep: id, job_id, step_order, step_type,
status, input_data, output_data, error_msg, created_at
```

**QAIssue**
```
id, qa_run_id, severity, issue_type, description,
scene_id, frame_time, screenshot_url, resolved, resolved_at
```

**PublishVariant**
```
id, publish_job_id, platform (tiktok/douyin/youtube),
status, output_url, published_at, error_msg
```

### Alembic Migrations

```
backend/alembic/versions/
├── c9a69f35eefa_phase02_initial_19_models.py     # Phase 2 初始 19 表
├── 9646a84d609a_story_character_enhancement_v2.py  # 角色+故事增强
└── 041b3_analytics_knowledge_feedback.py           # analytics + knowledge
```

---

## 4. API 路由

### 后端入口
`backend/main.py` — FastAPI app，注册 14 个路由模块

### 路由总览

| 路由文件 | 前缀 | 说明 |
|---------|------|------|
| `routers/projects.py` | `/api/projects` | 项目 CRUD |
| `routers/episodes.py` | `/api/episodes` | 剧集 CRUD |
| `routers/scenes.py` | `/api/scenes` | 场景 + SceneVersion |
| `routers/characters.py` | `/api/characters` | 角色 + CharacterAsset |
| `routers/story_bibles.py` | `/api/story-bibles` | 故事圣经 |
| `routers/assets.py` | `/api/assets` | 资产管理 |
| `routers/jobs.py` | `/api/jobs` | 任务/JobStep |
| `routers/qa.py` | `/api/qa` | QA 检查 |
| `routers/publish.py` | `/api/publish` | 发布 + PublishVariant |
| `routers/analytics.py` | `/api/analytics` | AnalyticsSnapshot |
| `routers/knowledge.py` | `/api/knowledge` | KnowledgeItem |
| `routers/apikeys.py` | `/api/apikeys` | API Key 管理 |
| `routers/workspace.py` | `/api/workspace` | workspace 配置 |
| `routers/files.py` | `/api/files` | 文件上传/存储 |

### Schema 层

```
schemas/
├── project.py, episode.py, scene.py, character.py
├── story_bible.py, asset.py, job.py, qa.py
├── publish.py, delivery.py, analytics.py
├── knowledge.py, apikey.py, workspace.py, rule.py
```

每个 schema 文件包含 Pydantic `Create` / `Update` / `Response` 模型。

---

## 5. 当前页面列表

### 前端页面（Next.js App Router）

| 路径 | 页面 | 说明 |
|------|------|------|
| `/workspace` | 工作台首页/仪表盘 | 项目概览 + 统计 |
| `/workspace/projects` | 项目列表页 | 所有项目卡片列表 |
| `/workspace/projects/[id]` | 项目详情页 | 项目信息 + 导航到子模块 |
| `/workspace/projects/[id]/episodes` | 剧集管理页 | EpisodeListManager |
| `/workspace/projects/[id]/episodes/[episodeId]` | 剧集详情/场次 | AudioAssetsPanel + AudioConfigPanel + SceneCreateForm + SceneList |
| `/workspace/projects/[id]/shots` | 镜头工作台 | 全局镜头编辑 |
| `/workspace/projects/[id]/story` | 剧本编辑页 | StoryBible + outline + script |
| `/workspace/shots` | 全局镜头列表 | |
| `/workspace/story` | 全局剧本库 | |
| `/workspace/assets` | 角色资产页 | CharacterAsset 管理 |
| `/workspace/render` | 渲染监控页 | 任务队列 + 进度 |
| `/workspace/qa` | QA 审核面板 | QARun + QAIssue 列表 |
| `/workspace/delivery` | 交付/导出页 | DeliveryPackage |
| `/workspace/analytics` | 数据分析页 | AnalyticsSnapshot 可视化 |
| `/workspace/settings` | 系统设置页 | API Key 管理 |

### UI 组件（Glass 设计体系）

```
components/ui/primitives/
├── GlassButton      # 按钮
├── GlassChip        # 标签/状态
├── GlassEmptyState  # 空状态占位
├── GlassField       # 表单字段包装
├── GlassInput       # 输入框
├── GlassLoadingBlock # 加载骨架
├── GlassModalShell  # 模态框容器
├── GlassSurface     # 卡片/面板
├── GlassTextarea    # 文本域
└── GlassToast       # 通知提示

components/workspace/
├── Sidebar              # 侧边导航
├── PageHeader           # 页面标题
├── EpisodeListManager   # 剧集列表管理
└── EpisodeQuickCreateButton  # 快速创建剧集
```

### 页面截图说明

> 截图功能未集成，以下为页面功能说明，实际 UI 以 `npm run dev` 后访问 `http://localhost:3000/workspace` 为准。

- **工作台首页** (`/workspace`)：显示项目统计、近期活动、快捷入口
- **项目列表** (`/workspace/projects`)：项目卡片网格，支持 genre/market/tier 筛选
- **镜头工作台** (`/workspace/projects/[id]/shots`)：镜头列表 + SceneVersion 版本链
- **渲染队列** (`/workspace/render`)：Job/JobStep 实时进度（WebSocket 驱动）
- **QA 审核** (`/workspace/qa`)：QAIssue 列表 + severity + 截图证据
- **交付导出** (`/workspace/delivery`)：DeliveryPackage + PublishVariant 状态

---

## 技术栈详情（来自 docs/ARCHITECTURE.md）

- **Phase 0**：环境准备 + Web UI 骨架（2026-04-26）
- **Phase 1**：A级 Demo 流水线 + 生产调度面板
- **Phase 2**：SSS 级流水线 + Tier 管理 + 版本链 + fallback
- **Phase 3**：音频增强 + QA 证据 + 前端面板
- **Phase 4a**：规则引擎 + 合规标注
- **Phase 4b**：交付打包 + 发布链 + analytics 回流
- **Phase 5**：后期剪辑中心（返修/字幕/混音/导出重验）

---

*最后更新：2026-04-29*