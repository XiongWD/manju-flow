# Manju Production OS

短视频批量生产操作系统 —— 从剧本到发布的一站式自动化流水线。

---

## 快速启动

**后端**：
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
DB_AUTO_CREATE=true ENVIRONMENT=development uvicorn main:app --host 0.0.0.0 --port 8000
```

**前端**：
```bash
cd frontend-next
npm install
npm run dev    # http://localhost:3000
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | FastAPI + SQLAlchemy async + SQLite / PostgreSQL |
| 前端 | Next.js 16 + React 19 + TypeScript (strict) |
| UI | Tailwind CSS 4 + Glass 设计语言 |
| 迁移 | Alembic（8 个 migration 文件） |
| 认证 | JWT（python-jose + passlib/bcrypt）+ 可选中间件保护 |
| 缓存 | 后端内存 TTLCache + 前端 SWR 缓存 |
| 实时 | WebSocket 频道广播 + BroadcastChannel 多标签同步 |
| 存储 | MinIO (S3) / 本地 fallback — StorageService 统一入口 |
| 视频 | FFmpeg + ffprobe 硬指标 QA |
| 虚拟滚动 | @tanstack/react-virtual |
| Agent | OpenClaw 多 Agent 编排 |

---

## 系统架构

```
Project → Episode → Scene(Shot) → SceneVersion → Asset
    ↕           ↕          ↕
 Location   Character   PropState
    ↕           ↕
PromptTemplate  StillCandidate ← 静帧审核闭环
```

**核心生产链路**：

```
剧本导入/解析 → 镜头结构化 → Location/Prop/Prompt 可追溯
→ 静帧候选生成 → 静帧审核锁图 → 图生视频 → ffprobe QA → 交付
```

---

## 后端

### 数据模型（34 张表）

| 模块 | 模型 |
|------|------|
| 认证 | User |
| 项目 | Project, ProjectConfig |
| 剧本 | StoryBible, Episode |
| 镜头 | Scene(Shot), SceneCharacter, SceneVersion |
| 角色 | Character, CharacterEpisode, CharacterAsset |
| 地点 | Location |
| 道具 | Prop, PropState |
| Prompt | PromptTemplate |
| 资产 | Asset, AssetLink |
| 静帧 | StillCandidate |
| 任务 | Job, JobStep, JobEvent |
| QA | QARun, QAIssue |
| 发布 | PublishJob, DeliveryPackage |
| 解析 | ScriptParseReport, ShotImportReport, ScriptIssue |
| 评分 | ComplexityProfile |
| 成本 | CostRecord |
| 其他 | AnalyticsSnapshot, KnowledgeItem, ApiKey |

### API（140+ 端点 / 23 个路由模块）

| 路由 | 说明 |
|------|------|
| `/api/auth` | 注册/登录/刷新/用户信息/登出 |
| `/api/projects` | 项目 CRUD |
| `/api/episodes` | 剧集 CRUD |
| `/api/scenes` | 镜头 + SceneVersion |
| `/api/characters` | 角色 + CharacterAsset |
| `/api/locations` | 地点 CRUD |
| `/api/story-bibles` | 故事圣经 |
| `/api/assets` | 资产管理 |
| `/api/jobs` | 任务/JobStep/进度 |
| `/api/qa` | QA 检查 |
| `/api/publish` | 发布 + 导出 |
| `/api/analytics` | 数据分析 |
| `/api/knowledge` | 知识沉淀 |
| `/api/apikeys` | API Key 管理 |
| `/api/files` | 文件上传 |
| `/api/workspace` | 工作台配置 |
| `/api/episodes/{id}/parse-script` | 剧本解析 |
| `/api/scenes/{id}/still-candidates` | 静帧候选 |
| `/api/projects/{id}/props` | 道具管理 |
| `/api/projects/{id}/prompt-templates` | Prompt 模板 |
| `/api/prompt-templates/build` | Prompt 构建 |
| `/api/scenes/{id}/complexity` | 复杂度评分 |
| `/api/episodes/{id}/timeline` | Timeline 导出 |
| `/api/projects/{id}/costs/summary` | 成本追踪 |
| `/api/scenes/{id}/propagate-status` | 状态传播 |

### 服务层（10+ 个核心服务）

| 服务 | 说明 |
|------|------|
| AuthService | JWT 签发/验证 + 密码哈希 + get_current_user 依赖 |
| BroadcastService | WebSocket 频道级广播（按 project 粒度） |
| TTLCache | 线程安全内存缓存 + @cached 装饰器 |
| StorageService | 统一存储（MinIO + local fallback） |
| ScriptParser | 剧本规则解析器（正则，不接 LLM） |
| PromptBuilder | Prompt 拼接 + 来源追踪 |
| ComplexityService | 镜头复杂度评分（5 维度，0-10 分） |
| TimelineService | Timeline 导出（JSON / CSV） |
| CostTrackerService | 成本记录与汇总 |
| StatusPropagationService | Scene → Episode → Project 状态传播 |

### VideoProvider 抽象层

```
VideoProvider (ABC)
├── MockVideoProvider      — 测试/开发用
├── KlingVideoProvider     — Kling API（从 video.py 提取）
├── SeedanceVideoProvider   — Seedance API（从 video.py 提取）
└── VideoProviderRegistry   — 注册中心 + fallback 链
```

### 状态机

```
Scene.shot_stage:
  draft → script_parsed → still_generating → still_review → still_locked
  → video_generating → video_review → video_locked → compose_ready → delivery
```

视频生成入口硬阻断：`shot_stage < still_locked` 或 `locked_still_id` 为空时拒绝提交。

---

## 前端

### 页面（16 个路由）

| 路径 | 说明 |
|------|------|
| `/` | 首页 |
| `/workspace` | 工作台仪表盘 |
| `/workspace/projects` | 项目列表 |
| `/workspace/projects/[id]` | 项目详情 |
| `/workspace/projects/[id]/episodes/[id]` | 剧集详情 |
| `/workspace/projects/[id]/shots` | 镜头编辑器（含静帧审核面板） |
| `/workspace/projects/[id]/story` | 剧本编辑 |
| `/workspace/shots` | 分镜选择器 |
| `/workspace/story` | 故事与角色 |
| `/workspace/assets` | 资产浏览 |
| `/workspace/render` | 渲染队列 |
| `/workspace/qa` | QA 中心 |
| `/workspace/delivery` | 剪辑与交付 |
| `/workspace/analytics` | 数据分析 |
| `/workspace/settings` | 系统设置 |

### 响应式

- Desktop (1920px) ✅
- Laptop (1366px) ✅
- Tablet (768px) ✅ — sidebar 隐藏，hamburger menu
- Mobile (375px) ✅ — overlay sidebar + backdrop

### UI 组件

Glass 设计体系：GlassButton / GlassSurface / GlassInput / GlassModalShell / GlassEmptyState / GlassLoadingBlock / GlassChip / GlassField / GlassTextarea / GlassToast

静帧审核组件：StillCandidateReviewPanel（集成在镜头详情模态框中）

---

## 项目结构

```
manju/
├── backend/
│   ├── main.py                          # FastAPI 入口
│   ├── requirements.txt
│   ├── config.py                       # 集中环境变量管理
│   ├── alembic/versions/                # 8 个 migration
│   ├── database/models.py               # 34 个 ORM 模型
│   ├── middleware/auth.py               # 可选鉴权中间件
│   ├── routers/ (23 个)                 # API 路由
│   ├── schemas/ (18 个)                 # Pydantic schemas（含 auth）
│   └── services/
│       ├── auth.py                      # JWT + 密码哈希
│       ├── broadcast.py                 # WebSocket 广播
│       ├── cache.py                     # 内存 TTL 缓存
│       ├── cache_decorator.py           # @cached 装饰器
│       ├── storage/service.py           # StorageService
│       ├── script_parser.py             # 剧本解析
│       ├── prompt_builder.py            # Prompt 构建
│       ├── complexity.py                # 复杂度评分
│       ├── timeline.py                  # Timeline 导出
│       ├── cost_tracker.py              # 成本追踪
│       ├── status_propagation.py        # 状态传播
│       └── pipeline/
│           ├── orchestrator.py          # 流水线编排（260 行）
│           ├── steps.py                  # Pipeline step 实现
│           ├── state.py                  # 状态管理
│           ├── config.py                 # Pipeline 配置
│           ├── runner.py                # 后台任务执行
│           ├── video.py                 # 视频生成
│           ├── audio.py                 # 音频处理
│           ├── qa.py                    # QA 检查（含 ffprobe）
│           ├── compose.py               # 合成引擎
│           ├── version_lock.py          # 版本锁定
│           ├── providers/               # VideoProvider 抽象
│           │   ├── base.py
│           │   ├── mock.py
│           │   ├── kling.py
│           │   ├── seedance.py
│           │   └── registry.py
│           └── ...
├── frontend-next/
│   ├── src/
│   │   ├── app/workspace/               # 16 个页面
│   │   ├── components/
│   │   │   ├── ui/primitives/           # Glass 组件库
│   │   │   ├── workspace/               # 业务组件
│   │   │   ├── VirtualList.tsx          # 虚拟滚动
│   │   │   ├── Skeleton.tsx             # 骨架屏
│   │   │   ├── Toast.tsx                # Toast 提示
│   │   │   └── ErrorBoundary.tsx        # 错误边界
│   │   ├── hooks/useTabSync.ts          # 多标签同步 hook
│   │   ├── lib/api-client.ts            # API 客户端（含 token/缓存/SWR）
│   │   ├── lib/broadcast.ts             # BroadcastChannel 多标签同步
│   │   └── types/index.ts
│   └── package.json
└── docs/
```

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接 | `sqlite+aiosqlite:///./manju.db` |
| `DB_AUTO_CREATE` | 启动时自动建表 | `true` (dev) |
| `ENVIRONMENT` | 运行环境 | `development` |
| `CORS_ORIGINS` | CORS 白名单 | `http://localhost:3000` |
| `JWT_SECRET` | JWT 签名密钥 | `manju-dev-secret-change-in-production` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access Token 有效期 | `60` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh Token 有效期 | `7` |
| `MANJU_ADMIN_EMAIL` | 初始管理员邮箱 | — |
| `MANJU_ADMIN_PASSWORD` | 初始管理员密码 | — |
| `AUTH_PROTECTED_PREFIXES` | 鉴权保护路径（逗号分隔，空=不保护） | 主要业务路由 |
| `CACHE_TTL_SECONDS` | 缓存 TTL | `300` |
| `MAX_UPLOAD_BYTES` | 上传大小限制 | `104857600` (100MB) |
| `LOG_LEVEL` | 日志级别 | `INFO` |
| `NEXT_PUBLIC_API_BASE_URL` | 前端 API 地址 | `/api` |
| `MINIO_ENDPOINT` | MinIO 地址 | — |
| `MINIO_ACCESS_KEY` | MinIO AK | — |
| `MINIO_SECRET_KEY` | MinIO SK | — |

---

## 已知限制 & 后续计划

- 🔜 真实 Provider API 字段验证（Kling/Seedance contract test）
- 🔜 MinIO 生产环境接入
- 🔜 自动化测试覆盖
- 🔜 Redis 缓存（当前内存缓存，Redis 作为可选升级）
- 🔜 Token 黑名单（logout 当前为 stub）
- 🔜 前端登录页面 UI
- 🔜 多列网格虚拟滚动（当前 assets 页为单列）
- 🔜 pipeline config 迁移到集中配置模块

---

## PostgreSQL 迁移指南

> **状态：准备就绪，可随时切换。** 代码已预留 PG 支持，`asyncpg` 驱动已在 requirements.txt 中。

### 1. 前置条件

当前依赖已就绪，无需额外安装：

| 依赖 | 版本要求 | 当前状态 |
|------|---------|----------|
| `asyncpg` | >=0.29.0 | ✅ 已在 requirements.txt |
| `alembic` | >=1.13.0 | ✅ 已在 requirements.txt |
| `sqlalchemy[asyncio]` | >=2.0.0 | ✅ 已在 requirements.txt |
| `aiosqlite` | >=0.20.0 | ✅ 已在 requirements.txt（切换后可移除） |

### 2. DATABASE_URL 格式变更

修改 `.env` 或环境变量即可：

```bash
# SQLite（当前）
DATABASE_URL=sqlite+aiosqlite:///./manju.db

# PostgreSQL（切换后）
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/manju
```

代码 `database/connection.py` 已根据 URL 前缀自动判断是否添加 SQLite 特有参数（`check_same_thread=False`），**无需修改连接代码**。

`config.py` 默认值仍为 SQLite，生产环境通过 `.env` 覆盖即可。

### 3. Alembic 迁移步骤

Alembic 的 `env.py` 已从 `.env` 读取 `DATABASE_URL`，无需改动。

```bash
cd backend

# 1. 确保 DATABASE_URL 指向 PostgreSQL
export DATABASE_URL="postgresql+asyncpg://user:password@localhost:5432/manju"

# 2. 如果从 SQLite 迁移，先查看当前迁移版本
sqlite3 manju.db "SELECT version_num FROM alembic_version;"

# 3. 在 PG 中标记该版本（假设版本为 0008）
alembic stamp 0008

# 4. 后续增量迁移正常执行
alembic upgrade head
```

### 4. 数据迁移（SQLite → PostgreSQL）

Alembic 只管 schema，数据迁移需要额外工具：

```bash
# 方案 A：pgloader（推荐，一行命令）
pgloader sqlite:///./manju.db postgresql://user:password@localhost:5432/manju

# 方案 B：pg_dump + 手动导入（小数据量可用）
sqlite3 manju.db .dump > dump.sql
# 手动编辑 dump.sql 修正 SQLite 特有语法后导入 psql
```

### 5. 兼容性检查结论

| 检查项 | 结论 |
|--------|------|
| **AUTOINCREMENT** | ✅ 未使用。所有主键为 `String(32)` + 应用层 UUID，PG 完全兼容 |
| **JSON 字段** | ✅ SQLAlchemy `JSON` → PG 自动映射为 `JSONB`，功能更强 |
| **DateTime** | ✅ `DateTime` 无时区标注 → PG `TIMESTAMP WITHOUT TIME ZONE`，与应用层 UTC 一致 |
| **Text vs VARCHAR** | ✅ `String(N)` / `Text` 均兼容 |
| **Foreign Key** | ✅ 标准 `ForeignKey()` + `ondelete`，PG 支持 |
| **复合主键** | ✅ `CharacterEpisode`、`SceneCharacter` 标准复合 PK |
| **Boolean** | ✅ SQLAlchemy `Boolean`，PG 原生支持 |
| **raw SQL** | ✅ 未发现 `text()` / `execute()`，全部 ORM |
| **SQLite 特有语法** | ✅ 无 `rowid`、`sqlite_` 函数、`AUTOINCREMENT` |
| **连接池** | ⚠️ 未显式配置，切换 PG 后建议添加 `pool_size` / `max_overflow` |

### 6. 生产环境建议

```python
# database/connection.py — 建议为 PG 添加的配置
if DATABASE_URL.startswith("postgresql"):
    async_engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=300,
    )
else:
    async_engine = create_async_engine(DATABASE_URL, echo=False, connect_args=connect_args)
```

### 7. 测试建议

1. **单元测试**：`pytest` + `pytest-asyncio`，测试库用 SQLite（fixture 覆盖 `DATABASE_URL`）
2. **集成测试**：CI 中 Docker Compose 起 PG，验证完整迁移流程
3. **回归重点**：
   - 34 张表 CRUD
   - JSON 字段读写（`prompt_bundle`、`metadata_json`）
   - 关联查询（Project → Episode → Scene）
   - 软删除（`SoftDeleteMixin`）
   - 并发写入（Job/JobStep 高频更新）

---

*最后更新：2026-05-01*
