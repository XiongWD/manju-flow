# Manju Production OS

短视频批量生产操作系统 —— 从剧本到发布的一站式自动化流水线。

## 概览

Manju 是一个面向短剧/短视频团队的生产管理系统，覆盖从项目创建、剧本拆分、AI 生成、质量检测到多平台发布的完整链路。

### 核心能力

- **Tier 分级流水线**：A / S / SS / SSS 四级质量体系，支持自动降级 fallback（SSS → SS → S → A_FALLBACK）
- **版本链管理**：scene_version 全生命周期，锁定/解锁/切换/回退，版本 diff 可视化
- **音频增强**：TTS（ElevenLabs / Fish Audio）+ BGM 混音，参数级配置继承
- **规则引擎**：平台合规自动检查 + 人工审核边界，C2PA/水印合规标注资产化
- **交付打包**：多平台变体（TikTok/抖音/YouTube），publish job 状态机
- **后期剪辑**：字幕编辑、音频混音编辑、导出后重验、delivery 链回写
- **数据回流**：analytics snapshot + knowledge 沉淀，支持项目级经验积累

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | FastAPI + SQLAlchemy (async) + SQLite/PostgreSQL |
| 前端 | Next.js 16 + React 19 + Tailwind CSS 4 |
| 存储 | MinIO (S3 兼容) |
| 实时通信 | WebSocket 进度推送 |
| 数据库迁移 | Alembic |

## 项目结构

```
manju/
├── backend/                  # FastAPI 后端
│   ├── main.py              # 入口，WebSocket 广播
│   ├── database/
│   │   ├── models.py        # 20 个 ORM 模型
│   │   └── connection.py    # 异步数据库连接
│   ├── routers/             # API 路由（14 个模块）
│   │   ├── projects.py      # 项目 CRUD
│   │   ├── episodes.py      # 剧集管理
│   │   ├── scenes.py        # 场景 + 版本 + 返修 + 剪辑
│   │   ├── publish.py       # 发布 + 导出重验
│   │   ├── qa.py            # QA 检查
│   │   └── ...
│   ├── services/
│   │   ├── pipeline/        # 流水线核心（16 个模块）
│   │   │   ├── orchestrator.py   # 调度编排 + fallback 链
│   │   │   ├── tier_config.py    # Tier 分级配置
│   │   │   ├── version_lock.py   # 版本锁定/解锁
│   │   │   ├── rules.py          # 规则定义
│   │   │   ├── rule_executor.py  # 规则执行器
│   │   │   ├── audio.py          # 音频生成（TTS + BGM）
│   │   │   ├── video.py          # 视频合成
│   │   │   ├── delivery.py       # 交付包构建
│   │   │   ├── publish.py        # 发布状态机
│   │   │   ├── analytics.py      # 数据回流
│   │   │   ├── knowledge.py      # 知识沉淀
│   │   │   ├── export_recheck.py # 导出重验
│   │   │   └── ...
│   │   └── storage/         # MinIO 客户端
│   └── schemas/             # Pydantic schema
├── frontend-next/            # Next.js 前端
│   └── src/
│       ├── app/workspace/   # 页面路由
│       │   ├── projects/    # 项目列表 + 详情
│       │   ├── render/      # 渲染监控
│       │   ├── qa/          # QA 面板
│       │   ├── delivery/    # 交付面板
│       │   ├── analytics/   # 数据分析
│       │   └── settings/    # 系统设置
│       ├── components/      # UI 组件（Glass 设计体系）
│       ├── lib/             # API 客户端 + 工具
│       └── types/           # TypeScript 类型定义
└── scripts/                 # 启动/测试脚本
```

## 数据模型

20 个核心表：

`projects` · `project_configs` · `story_bibles` · `characters` · `character_assets` · `episodes` · `scenes` · `scene_versions` · `assets` · `asset_links` · `jobs` · `job_steps` · `qa_runs` · `qa_issues` · `publish_jobs` · `publish_variants` · `analytics_snapshots` · `knowledge_items` · `api_keys` · `delivery_packages`

## 快速开始

### 前置依赖

- Python 3.11+
- Node.js 22+
- MinIO（可选，默认本地文件存储）

### 后端

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # 填入 API Key
python main.py              # 启动在 localhost:8000
```

### 前端

```bash
cd frontend-next
npm install
npm run dev                 # 启动在 localhost:3000
```

### 一键启动

```bash
bash scripts/manju.sh
```

## 当前状态

### ✅ 已完成（Phase 0-5）

- Phase 0：项目骨架 + 20 表数据模型
- Phase 1：A级 Demo 流水线 + 生产调度面板
- Phase 2：SSS 级流水线 + Tier 管理 + 版本链 + fallback
- Phase 3：音频增强 + QA 证据 + 前端面板
- Phase 4a：规则引擎 + 合规标注
- Phase 4b：交付打包 + 发布链 + analytics 回流
- Phase 5：后期剪辑中心（返修/字幕/混音/导出重验）

### 🚧 待完成

- 真实第三方平台 API 接入（TikTok / 抖音 / YouTube）
- 真实 GPU 训练 / LoRA 部署
- 真实 ffmpeg 深度检查
- 复杂时间线编辑器
- Alembic migration 实际执行
- 全项目 build + 端到端联调

## License

Private — All rights reserved.
